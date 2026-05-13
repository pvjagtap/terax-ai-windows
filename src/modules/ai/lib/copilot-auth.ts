/**
 * GitHub Copilot OAuth Device-Flow authentication & session-token management.
 *
 * Flow:
 *  1. `startDeviceFlow()` — kicks off the device-code grant and returns
 *     the `user_code` + `verification_uri` the user needs to visit.
 *  2. `pollForOAuthToken()` — polls GitHub until the user authorises.
 *  3. The resulting *OAuth token* is persisted in the OS keyring
 *     (same `keyring.ts` infra used by other providers).
 *  4. `getCopilotSession()` — exchanges the OAuth token for a short-lived
 *     Copilot session token (and caches it until it expires).
 *     The session response also carries the API endpoint to use.
 */

import { invoke } from "@tauri-apps/api/core";
import { KEYRING_SERVICE } from "../config";
import { proxyFetch } from "./proxyFetch";

// ── Known Copilot OAuth constants ──────────────────────────────────────────
// This is the client-id used by VS Code's Copilot extension for the
// device-code OAuth flow.  It is a *public* client id – not a secret.
const COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL =
  "https://api.github.com/copilot_internal/v2/token";

// Keyring account for the long-lived OAuth refresh token.
export const COPILOT_KEYRING_ACCOUNT = "github-copilot-oauth-token";

// ── Types ──────────────────────────────────────────────────────────────────
export type DeviceFlowInfo = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

export type CopilotSession = {
  token: string;
  expiresAt: number; // unix seconds
  endpoints: {
    api: string;
    [k: string]: string;
  };
};

// ── Device Flow ────────────────────────────────────────────────────────────
export async function startDeviceFlow(): Promise<DeviceFlowInfo> {
  const res = await proxyFetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: COPILOT_CLIENT_ID,
      scope: "copilot",
    }),
  });
  if (!res.ok) {
    throw new Error(`Device flow start failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

/**
 * Poll GitHub's OAuth endpoint until the user authorises.
 * Resolves with the long-lived OAuth access-token.
 * The caller should persist this in the keyring.
 */
export async function pollForOAuthToken(
  deviceCode: string,
  interval: number,
  signal?: AbortSignal,
): Promise<string> {
  const pollMs = Math.max(interval, 5) * 1000; // at least 5 s
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new Error("Cancelled");
    await sleep(pollMs);
    if (signal?.aborted) throw new Error("Cancelled");

    const res = await proxyFetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: COPILOT_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    if (!res.ok) {
      throw new Error(`OAuth poll failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      access_token?: string;
      error?: string;
    };
    if (body.access_token) {
      return body.access_token;
    }
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") {
      await sleep(5000); // extra backoff
      continue;
    }
    if (body.error === "expired_token") {
      throw new Error("Device code expired — please try again.");
    }
    if (body.error === "access_denied") {
      throw new Error("Authorization was denied.");
    }
    throw new Error(`Unexpected OAuth error: ${body.error ?? "unknown"}`);
  }
}

// ── OAuth token persistence (OS keyring) ───────────────────────────────────
export async function saveOAuthToken(token: string): Promise<void> {
  await invoke("secrets_set", {
    service: KEYRING_SERVICE,
    account: COPILOT_KEYRING_ACCOUNT,
    password: token,
  });
}

export async function getOAuthToken(): Promise<string | null> {
  try {
    const v = await invoke<string | null>("secrets_get", {
      service: KEYRING_SERVICE,
      account: COPILOT_KEYRING_ACCOUNT,
    });
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function clearOAuthToken(): Promise<void> {
  try {
    await invoke("secrets_delete", {
      service: KEYRING_SERVICE,
      account: COPILOT_KEYRING_ACCOUNT,
    });
  } catch {
    // already absent
  }
}

// ── Session token (short-lived, exchanged from OAuth token) ────────────────
let cachedSession: CopilotSession | null = null;

/**
 * Get a valid Copilot session token.
 * Automatically refreshes when expired (or nearly expired).
 * The `oauthToken` can be omitted — it will be read from the keyring.
 */
export async function getCopilotSession(
  oauthToken?: string,
): Promise<CopilotSession> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedSession && cachedSession.expiresAt > now + 60) {
    return cachedSession;
  }

  const token = oauthToken ?? (await getOAuthToken());
  if (!token) {
    throw new Error(
      "Not signed in to GitHub Copilot. Open Settings → Models to sign in.",
    );
  }

  const res = await proxyFetch(COPILOT_TOKEN_URL, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/json",
      "Editor-Version": "Terax/1.0.0",
      "Editor-Plugin-Version": "terax-copilot/1.0.0",
    },
  });
  if (res.status === 401) {
    // OAuth token expired or revoked
    cachedSession = null;
    throw new Error(
      "GitHub Copilot session expired. Please sign in again in Settings → Models.",
    );
  }
  if (res.status === 403) {
    // 403 can mean: no Copilot subscription, org requires SAML SSO
    // authorization, or the OAuth app hasn't been approved by the org.
    let detail = "";
    try {
      const errBody = await res.text();
      detail = errBody;
      // GitHub sends JSON like {"message":"...", "documentation_url":"..."}
      const parsed = JSON.parse(errBody) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch { /* non-JSON body */ }

    const ssoHint = detail.toLowerCase().includes("sso")
      || detail.toLowerCase().includes("saml")
      || detail.toLowerCase().includes("organization");

    if (ssoHint) {
      throw new Error(
        `Your organization requires SSO authorization for Copilot. ` +
        `Visit https://github.com/settings/connections/applications/${COPILOT_CLIENT_ID} ` +
        `and click "Authorize" next to your organization, then try again.`,
      );
    }

    throw new Error(
      `Copilot token exchange failed (403): ${detail || "Forbidden"}. ` +
      `Ensure your GitHub account has an active Copilot subscription. ` +
      `If your org uses SSO, authorize at: https://github.com/settings/connections/applications/${COPILOT_CLIENT_ID}`,
    );
  }
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`Copilot token exchange failed: ${res.status} ${detail}`.trim());
  }

  const body = (await res.json()) as {
    token: string;
    expires_at: number;
    endpoints?: { api?: string; [k: string]: string | undefined };
  };

  cachedSession = {
    token: body.token,
    expiresAt: body.expires_at,
    endpoints: {
      api:
        body.endpoints?.api ?? "https://api.individual.githubcopilot.com",
      ...Object.fromEntries(
        Object.entries(body.endpoints ?? {}).filter(
          ([, v]) => typeof v === "string",
        ),
      ),
    } as CopilotSession["endpoints"],
  };
  return cachedSession;
}

/** Invalidate the cached session so the next call forces a refresh. */
export function invalidateCopilotSession(): void {
  cachedSession = null;
}

/**
 * Check whether the user is currently signed in to Copilot
 * (has a stored OAuth token).
 */
export async function isCopilotSignedIn(): Promise<boolean> {
  const t = await getOAuthToken();
  return !!t;
}

// ── Dynamic model discovery ────────────────────────────────────────────────
export type CopilotModelEntry = {
  id: string;
  name: string;
  version: string;
  capabilities?: {
    family?: string;
    type?: string;
    limits?: {
      max_prompt_tokens?: number;
      max_output_tokens?: number;
    };
  };
  model_picker_enabled?: boolean;
};

/**
 * Fetch the list of models available to this Copilot subscription.
 * Requires an active session (call `getCopilotSession()` first or pass one).
 */
export async function fetchCopilotModels(
  session?: CopilotSession,
): Promise<CopilotModelEntry[]> {
  const s = session ?? (await getCopilotSession());
  const res = await proxyFetch(`${s.endpoints.api}/models`, {
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: "application/json",
      "Copilot-Integration-Id": "vscode-chat",
      "Editor-Version": "Terax/1.0.0",
      "Editor-Plugin-Version": "terax-copilot/1.0.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Copilot models: ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: CopilotModelEntry[];
    models?: CopilotModelEntry[];
  };
  // GitHub's response uses either `data` or `models` array.
  return body.data ?? body.models ?? [];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
