import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  LinkSquare01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { ProviderIcon } from "./ProviderIcon";
import {
  startDeviceFlow,
  pollForOAuthToken,
  saveOAuthToken,
  clearOAuthToken,
  isCopilotSignedIn,
  invalidateCopilotSession,
} from "@/modules/ai/lib/copilot-auth";

type Props = {
  /** Whether a key / OAuth token is currently stored for this provider. */
  signedIn: boolean;
  /** Called after a successful sign-in or sign-out so the parent can
   *  refresh its key state. */
  onAuthChange: () => Promise<void>;
};

type FlowState =
  | { step: "idle" }
  | { step: "code"; userCode: string; verificationUri: string }
  | { step: "polling" }
  | { step: "done" }
  | { step: "error"; message: string };

export function CopilotSignInCard({ signedIn, onAuthChange }: Props) {
  const [flow, setFlow] = useState<FlowState>({ step: "idle" });
  const [checking, setChecking] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(signedIn);

  // Sync with parent's signedIn prop and also verify on mount.
  useEffect(() => {
    setIsSignedIn(signedIn);
    void isCopilotSignedIn()
      .then((v) => {
        setIsSignedIn(v);
        setChecking(false);
      })
      .catch(() => {
        // Keyring read failed — treat as not signed in.
        setChecking(false);
      });
  }, [signedIn]);

  const startSignIn = async () => {
    try {
      setFlow({ step: "code", userCode: "…", verificationUri: "" });
      const info = await startDeviceFlow();
      setFlow({
        step: "code",
        userCode: info.userCode,
        verificationUri: info.verificationUri,
      });
      // Open the verification page in the browser.
      void openUrl(info.verificationUri);

      setFlow((prev) =>
        prev.step === "code" ? { ...prev, step: "code" } : prev,
      );

      // Start polling.
      const oauthToken = await pollForOAuthToken(
        info.deviceCode,
        info.interval,
      );
      await saveOAuthToken(oauthToken);
      setIsSignedIn(true);
      setFlow({ step: "done" });
      await onAuthChange();
    } catch (e) {
      setFlow({ step: "error", message: String(e) });
    }
  };

  const signOut = async () => {
    invalidateCopilotSession();
    await clearOAuthToken();
    setIsSignedIn(false);
    setFlow({ step: "idle" });
    await onAuthChange();
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-3">
        <Spinner className="size-3.5" />
        <span className="text-[11.5px] text-muted-foreground">
          Checking Copilot status…
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <ProviderIcon provider="github-copilot" size={15} />
        <span className="text-[12.5px] font-medium">
          GitHub Copilot (Enterprise)
        </span>
        {isSignedIn ? (
          <Badge
            variant="outline"
            className="ml-1 h-4 gap-1 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300"
          >
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={9}
              strokeWidth={2}
            />
            Signed in
          </Badge>
        ) : null}
      </div>

      {/* Signed-in state: show sign-out button */}
      {isSignedIn && flow.step !== "code" ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[10.5px] text-muted-foreground">
            Authenticated via GitHub Copilot. Models are available from your
            enterprise subscription.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void signOut()}
            className="h-7 gap-1 px-2 text-[10.5px] text-muted-foreground hover:text-destructive"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.75} />
            Sign out
          </Button>
        </div>
      ) : null}

      {/* Idle: show sign-in button */}
      {!isSignedIn && flow.step === "idle" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] leading-relaxed text-muted-foreground">
            Sign in with your GitHub account to use Copilot models included with
            your enterprise subscription.
          </span>
          <Button
            size="sm"
            onClick={() => void startSignIn()}
            className="h-8 gap-1.5 self-start px-3 text-[11px]"
          >
            <HugeiconsIcon
              icon={LinkSquare01Icon}
              size={13}
              strokeWidth={1.75}
            />
            Sign in with GitHub
          </Button>
        </div>
      ) : null}

      {/* Device code step: show code and "waiting for auth" */}
      {flow.step === "code" ? (
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] leading-relaxed text-muted-foreground">
            A browser window has opened. Enter this code on GitHub:
          </span>
          <div className="flex items-center gap-2">
            <code className="rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-base font-semibold tracking-widest">
              {flow.userCode}
            </code>
            <Spinner className="size-3.5" />
            <span className="text-[10.5px] text-muted-foreground">
              Waiting for authorization…
            </span>
          </div>
          {flow.verificationUri ? (
            <button
              type="button"
              onClick={() => void openUrl(flow.verificationUri)}
              className="self-start text-[10.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Open github.com/login/device again ↗
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Done */}
      {flow.step === "done" ? (
        <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400">
          ✓ Successfully signed in to GitHub Copilot.
        </span>
      ) : null}

      {/* Error */}
      {flow.step === "error" ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] text-destructive">
            {flow.message}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void startSignIn()}
            className="h-7 self-start px-2 text-[10.5px]"
          >
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
