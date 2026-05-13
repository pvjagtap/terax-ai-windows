import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type UIMessage,
} from "ai";
import {
  DEFAULT_MODEL_ID,
  getModel,
  getModelContextLimit,
  AZURE_OPENAI_DEFAULT_ENDPOINT,
  MAX_AGENT_STEPS,
  providerNeedsKey,
  selectSystemPrompt,
  type ModelId,
  type ProviderId,
} from "../config";
import type { ProviderKeys } from "./keyring";
import { getCopilotSession } from "./copilot-auth";
import { proxyFetch } from "./proxyFetch";
import { buildTools, type ToolContext } from "../tools/tools";
import { compactModelMessages } from "./compact";

const TOOL_LABELS: Record<string, (input: Record<string, unknown>) => string> = {
  read_file: (i) => `Reading ${shortPath(i.path)}`,
  list_directory: (i) => `Listing ${shortPath(i.path)}`,
  grep: (i) => `Grepping ${ellipsize(String(i.pattern ?? ""), 40)}`,
  glob: (i) => `Globbing ${ellipsize(String(i.pattern ?? ""), 40)}`,
  edit: (i) => `Editing ${shortPath(i.path)}`,
  multi_edit: (i) => `Editing ${shortPath(i.path)}`,
  write_file: (i) => `Writing ${shortPath(i.path)}`,
  create_directory: (i) => `Creating ${shortPath(i.path)}`,
  bash_run: (i) => `Running ${ellipsize(String(i.command ?? ""), 60)}`,
  bash_background: (i) =>
    `Spawning ${ellipsize(String(i.command ?? ""), 60)}`,
  bash_logs: () => `Reading logs`,
  bash_list: () => `Listing background processes`,
  bash_kill: () => `Stopping background process`,
  suggest_command: (i) =>
    `Suggesting ${ellipsize(String(i.command ?? ""), 60)}`,
  todo_write: (i) =>
    `Updating plan (${Array.isArray(i.todos) ? i.todos.length : 0} items)`,
  run_subagent: (i) => `Spawning ${String(i.type ?? "subagent")} subagent`,
};

function shortPath(p: unknown): string {
  if (typeof p !== "string") return "";
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

function ellipsize(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export type BuildModelOptions = {
  modelIdOverride?: string;
  azureOpenaiEndpoint?: string;
  azureClaudeEndpoint?: string;
};

const modelCache = new Map<string, LanguageModel>();

export async function buildLanguageModel(
  provider: ProviderId,
  keys: ProviderKeys,
  resolvedModelId: string,
  options: BuildModelOptions = {},
): Promise<LanguageModel> {
  // github-copilot uses OAuth device-flow; the keyring value is the OAuth
  // token (may be null when not signed in).  Other providers need a plain key.
  if (provider !== "github-copilot" && providerNeedsKey(provider) && !keys[provider]) {
    throw new Error(
      `No API key configured for ${provider}. Open Settings → AI to add one.`,
    );
  }
  const key = keys[provider] ?? "";
  const azureEndpoint = options.azureOpenaiEndpoint ?? AZURE_OPENAI_DEFAULT_ENDPOINT;
  const azureClaudeEndpoint = options.azureClaudeEndpoint ?? "";

  // Don't cache copilot models — the session token rotates every ~30 min.
  if (provider !== "github-copilot") {
    const cacheKey = `${provider} ${key} ${resolvedModelId} ${azureEndpoint} ${azureClaudeEndpoint}`;
    const hit = modelCache.get(cacheKey);
    if (hit) return hit;
  }

  let built: LanguageModel;
  switch (provider) {
    case "azure-openai": {
      if (!azureEndpoint) {
        throw new Error(
          "Azure OpenAI: no endpoint URL configured. Set it in Settings → Models.",
        );
      }
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      built = createOpenAICompatible({
        name: "azure-openai",
        baseURL: `${azureEndpoint.replace(/\/$/, "")}/openai/deployments`,
        apiKey: key,
        headers: { "api-key": key },
        queryParams: { "api-version": "2024-08-01-preview" },
        fetch: proxyFetch,
      })(resolvedModelId);
      break;
    }
    case "github-copilot": {
      // Exchange the OAuth token (stored in keyring) for a short-lived
      // Copilot session token.  The session also tells us which API
      // endpoint to hit (enterprise vs individual).
      const session = await getCopilotSession(key || undefined);
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      built = createOpenAICompatible({
        name: "github-copilot",
        baseURL: session.endpoints.api,
        apiKey: session.token,
        headers: {
          "Copilot-Integration-Id": "vscode-chat",
          "Editor-Version": "Terax/1.0.0",
          "Editor-Plugin-Version": "terax-copilot/1.0.0",
        },
        fetch: proxyFetch,
      })(resolvedModelId);
      break;
    }
    case "azure-claude": {
      if (!azureClaudeEndpoint) {
        throw new Error(
          "Azure Claude: no endpoint URL configured. Set it in Settings → Models.",
        );
      }
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      built = createOpenAICompatible({
        name: "azure-claude",
        baseURL: azureClaudeEndpoint.replace(/\/$/, ""),
        apiKey: key,
        fetch: proxyFetch,
      })(resolvedModelId);
      break;
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive as ProviderId}`);
    }
  }
  if (provider !== "github-copilot") {
    const cacheKey = `${provider} ${key} ${resolvedModelId} ${azureEndpoint} ${azureClaudeEndpoint}`;
    modelCache.set(cacheKey, built);
  }
  return built;
}

function buildModel(
  modelId: ModelId,
  keys: ProviderKeys,
  azureOpenaiEndpoint?: string,
  azureClaudeEndpoint?: string,
): Promise<LanguageModel> {
  const m = getModel(modelId);
  const resolvedId: string = m.id;
  return buildLanguageModel(m.provider, keys, resolvedId, {
    azureOpenaiEndpoint,
    azureClaudeEndpoint,
  });
}

const PLAN_MODE_PROMPT = `## PLAN MODE — ACTIVE
Mutating tools (write_file, edit, multi_edit, create_directory) will queue their changes for the user to review as a single diff. Do NOT execute bash_run or bash_background while plan mode is active — restrict yourself to reads (read_file, grep, glob, list_directory) and the queued mutations. After queueing the full set of edits, stop and return a brief summary; do not continue acting until the user has accepted/rejected.`;

function buildStableSystem(
  modelId: ModelId,
  persona: { name: string; instructions: string } | null,
  customInstructions: string | undefined,
  projectMemory: string | null,
): string {
  const base = selectSystemPrompt(getModel(modelId).id);
  const personaBlock = persona?.instructions.trim()
    ? `\n\n## ACTIVE AGENT — ${persona.name}\n${persona.instructions.trim()}`
    : "";
  const customBlock = customInstructions?.trim()
    ? `\n\n## USER CUSTOM INSTRUCTIONS — follow unless they conflict with safety rules above\n${customInstructions.trim()}`
    : "";
  const memoryBlock =
    projectMemory && projectMemory.trim().length > 0
      ? `\n\n## PROJECT — TERAX.md\n${projectMemory.trim()}`
      : "";
  return `${base}${memoryBlock}${personaBlock}${customBlock}`;
}

// Azure-hosted Claude behind OpenAI-compatible API does not use Anthropic's
// cache breakpoints, so we skip explicit markers for all providers.
function applyCacheBreakpoints(
  messages: ModelMessage[],
  _provider: ProviderId,
): ModelMessage[] {
  return messages;
}

export type AgentUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

const EMPTY_USAGE: AgentUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
};

export type RunAgentOptions = {
  keys: ProviderKeys;
  modelId?: ModelId;
  customInstructions?: string;
  agentPersona?: { name: string; instructions: string } | null;
  toolContext: ToolContext;
  onStep?: (step: string | null) => void;
  onUsage?: (delta: AgentUsage) => void;
  azureOpenaiEndpoint?: string;
  azureClaudeEndpoint?: string;
  planMode?: boolean;
  projectMemory?: string | null;
  envBlock?: string | null;
  uiMessages: UIMessage[];
  abortSignal?: AbortSignal;
};

export async function runAgentStream(opts: RunAgentOptions) {
  const modelId = opts.modelId ?? DEFAULT_MODEL_ID;
  const model = await buildModel(
    modelId,
    opts.keys,
    opts.azureOpenaiEndpoint,
    opts.azureClaudeEndpoint,
  );
  const provider = getModel(modelId).provider;

  const stableSystem = buildStableSystem(
    modelId,
    opts.agentPersona ?? null,
    opts.customInstructions,
    opts.projectMemory ?? null,
  );

  const history = await convertToModelMessages(opts.uiMessages);
  const compactedHistory = compactModelMessages(
    history,
    getModelContextLimit(getModel(modelId).id),
  );

  const messages: ModelMessage[] = [
    { role: "system", content: stableSystem },
  ];
  if (opts.envBlock?.trim()) {
    messages.push({ role: "system", content: opts.envBlock });
  }
  if (opts.planMode) {
    messages.push({ role: "system", content: PLAN_MODE_PROMPT });
  }
  messages.push(...compactedHistory);

  const finalMessages = applyCacheBreakpoints(messages, provider);

  return streamText({
    model,
    messages: finalMessages,
    tools: buildTools(opts.toolContext),
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      if (opts.onStep) {
        const last = step.toolCalls?.[step.toolCalls.length - 1];
        if (last) {
          const label = TOOL_LABELS[last.toolName];
          opts.onStep(
            label
              ? label((last.input ?? {}) as Record<string, unknown>)
              : `Calling ${last.toolName}`,
          );
        } else if (step.text) {
          opts.onStep("Writing");
        }
      }
      if (opts.onUsage && step.usage) {
        const u = step.usage;
        opts.onUsage({
          inputTokens: u.inputTokens ?? 0,
          outputTokens: u.outputTokens ?? 0,
          cachedInputTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
        });
      }
    },
    onFinish: () => {
      opts.onStep?.(null);
    },
  });
}

export { EMPTY_USAGE };
