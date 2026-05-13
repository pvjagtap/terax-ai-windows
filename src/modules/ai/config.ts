export const KEYRING_SERVICE = "terax-ai";

export type ProviderId =
  | "azure-openai"
  | "github-copilot"
  | "azure-claude";

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  keyringAccount: string;
  keyPrefix: string | null;
  consoleUrl: string;
  /** Provider accepts (but does not require) an API key. */
  keyOptional?: boolean;
};

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    keyringAccount: "azure-openai-api-key",
    keyPrefix: null,
    consoleUrl: "https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI",
  },
  {
    id: "github-copilot",
    label: "GitHub Copilot (Enterprise)",
    keyringAccount: "github-copilot-token",
    keyPrefix: null,
    consoleUrl: "https://github.com/settings/personal-access-tokens/new",
  },
  {
    id: "azure-claude",
    label: "Azure Claude",
    keyringAccount: "azure-claude-api-key",
    keyPrefix: null,
    consoleUrl: "https://ai.azure.com",
  },
] as const;

export function getProvider(id: ProviderId): ProviderInfo {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

/** 1 (lowest) – 5 (highest). For `cost`, higher = cheaper. */
export type CapabilityScore = 1 | 2 | 3 | 4 | 5;

export type ModelCapabilities = {
  intelligence: CapabilityScore;
  speed: CapabilityScore;
  cost: CapabilityScore;
};

export type ModelTag = "vision" | "reasoning" | "tools" | "coding";

export type ModelInfo = {
  id: string;
  provider: ProviderId;
  label: string;
  /** One short word for the dropdown trigger. */
  hint: string;
  /** One-line marketing-style description shown under the label. */
  description: string;
  capabilities: ModelCapabilities;
  tags?: readonly ModelTag[];
};

export const MODELS = [
  // ── Azure OpenAI ──────────────────────────────────────────────────────────
  {
    id: "gpt-4o",
    provider: "azure-openai",
    label: "GPT-4o",
    hint: "Flagship",
    description: "OpenAI's flagship multimodal model on Azure.",
    capabilities: { intelligence: 5, speed: 3, cost: 2 },
    tags: ["vision", "reasoning", "tools", "coding"],
  },
  {
    id: "gpt-4o-mini",
    provider: "azure-openai",
    label: "GPT-4o mini",
    hint: "Fast",
    description: "Fast and cost-effective on Azure.",
    capabilities: { intelligence: 4, speed: 5, cost: 4 },
    tags: ["vision", "tools"],
  },
  {
    id: "gpt-4-turbo",
    provider: "azure-openai",
    label: "GPT-4 Turbo",
    hint: "Stable",
    description: "Production-stable GPT-4 on Azure.",
    capabilities: { intelligence: 4, speed: 3, cost: 2 },
    tags: ["vision", "tools", "coding"],
  },
  {
    id: "o1-preview",
    provider: "azure-openai",
    label: "o1-preview",
    hint: "Reasoning",
    description: "Advanced reasoning model on Azure.",
    capabilities: { intelligence: 5, speed: 2, cost: 1 },
    tags: ["reasoning", "tools", "coding"],
  },
  {
    id: "o1-mini",
    provider: "azure-openai",
    label: "o1-mini",
    hint: "Fast Reasoning",
    description: "Lightweight reasoning model on Azure.",
    capabilities: { intelligence: 4, speed: 4, cost: 3 },
    tags: ["reasoning", "tools", "coding"],
  },
  {
    id: "o3-mini",
    provider: "azure-openai",
    label: "o3-mini",
    hint: "Latest Reasoning",
    description: "Latest small reasoning model on Azure.",
    capabilities: { intelligence: 5, speed: 4, cost: 3 },
    tags: ["reasoning", "tools", "coding"],
  },

  // ── GitHub Copilot (Enterprise) ─────────────────────────────────────────
  {
    id: "openai/gpt-4.1",
    provider: "github-copilot",
    label: "GPT-4.1",
    hint: "Flagship",
    description: "OpenAI GPT-4.1 via GitHub Copilot Enterprise.",
    capabilities: { intelligence: 5, speed: 3, cost: 2 },
    tags: ["vision", "reasoning", "tools", "coding"],
  },
  {
    id: "openai/gpt-5-mini",
    provider: "github-copilot",
    label: "GPT-5 mini",
    hint: "Fast",
    description: "Fast, cost-effective GPT-5 mini via Copilot Enterprise.",
    capabilities: { intelligence: 4, speed: 5, cost: 4 },
    tags: ["vision", "tools", "coding"],
  },
  {
    id: "openai/gpt-5.4",
    provider: "github-copilot",
    label: "GPT-5.4",
    hint: "Latest",
    description: "Latest flagship GPT-5.4 via Copilot Enterprise.",
    capabilities: { intelligence: 5, speed: 3, cost: 1 },
    tags: ["vision", "reasoning", "tools", "coding"],
  },
  {
    id: "openai/gpt-5.4-mini",
    provider: "github-copilot",
    label: "GPT-5.4 mini",
    hint: "Latest Fast",
    description: "Latest fast GPT-5.4 mini via Copilot Enterprise.",
    capabilities: { intelligence: 4, speed: 5, cost: 3 },
    tags: ["vision", "tools", "coding"],
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    provider: "github-copilot",
    label: "Claude Sonnet 4.5",
    hint: "Balanced",
    description: "Anthropic Claude Sonnet 4.5 via Copilot Enterprise.",
    capabilities: { intelligence: 5, speed: 4, cost: 3 },
    tags: ["vision", "tools", "coding"],
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    provider: "github-copilot",
    label: "Claude Sonnet 4.6",
    hint: "Latest Sonnet",
    description: "Latest Claude Sonnet 4.6 via Copilot Enterprise.",
    capabilities: { intelligence: 5, speed: 4, cost: 3 },
    tags: ["vision", "tools", "coding"],
  },
  {
    id: "anthropic/claude-opus-4.6",
    provider: "github-copilot",
    label: "Claude Opus 4.6",
    hint: "Best Claude",
    description: "Claude Opus 4.6 — most capable Claude via Copilot Enterprise.",
    capabilities: { intelligence: 5, speed: 2, cost: 1 },
    tags: ["vision", "reasoning", "tools", "coding"],
  },
  {
    id: "google/gemini-2.5-pro",
    provider: "github-copilot",
    label: "Gemini 2.5 Pro",
    hint: "Google",
    description: "Google Gemini 2.5 Pro via Copilot Enterprise.",
    capabilities: { intelligence: 5, speed: 3, cost: 2 },
    tags: ["vision", "reasoning", "tools", "coding"],
  },

  // ── Azure Claude (Azure AI Foundry) ───────────────────────────────────────
  {
    id: "claude-3.5-sonnet",
    provider: "azure-claude",
    label: "Claude 3.5 Sonnet",
    hint: "Balanced",
    description: "Anthropic Claude 3.5 Sonnet on Azure AI Foundry.",
    capabilities: { intelligence: 5, speed: 4, cost: 3 },
    tags: ["vision", "tools", "coding"],
  },
  {
    id: "claude-3-opus",
    provider: "azure-claude",
    label: "Claude 3 Opus",
    hint: "Best",
    description: "Anthropic Claude 3 Opus on Azure AI Foundry.",
    capabilities: { intelligence: 5, speed: 2, cost: 1 },
    tags: ["vision", "reasoning", "tools", "coding"],
  },
  {
    id: "claude-3-haiku",
    provider: "azure-claude",
    label: "Claude 3 Haiku",
    hint: "Fast",
    description: "Fast Claude on Azure AI Foundry.",
    capabilities: { intelligence: 3, speed: 5, cost: 5 },
    tags: ["vision", "tools"],
  },
] as const satisfies readonly ModelInfo[];

export type ModelId = (typeof MODELS)[number]["id"];

export function getModel(id: ModelId): ModelInfo {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown model: ${id}`);
  return m;
}

export const DEFAULT_MODEL_ID: ModelId = "gpt-4o";

/** Approximate context window (in tokens) per model. */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "o1-preview": 128_000,
  "o1-mini": 128_000,
  "o3-mini": 200_000,
  "openai/gpt-4.1": 1_048_576,
  "openai/gpt-5-mini": 1_048_576,
  "openai/gpt-5.4": 1_048_576,
  "openai/gpt-5.4-mini": 1_048_576,
  "anthropic/claude-sonnet-4.5": 200_000,
  "anthropic/claude-sonnet-4.6": 200_000,
  "anthropic/claude-opus-4.6": 200_000,
  "google/gemini-2.5-pro": 1_000_000,
  "claude-3.5-sonnet": 200_000,
  "claude-3-opus": 200_000,
  "claude-3-haiku": 200_000,
};

export function getModelContextLimit(modelId: string | undefined): number {
  if (!modelId) return 128_000;
  return MODEL_CONTEXT_LIMITS[modelId] ?? 128_000;
}

export type ModelPricing = {
  input: number;
  output: number;
  cacheRead?: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Azure OpenAI (pay-per-token via Azure subscription)
  "gpt-4o": { input: 2.5, output: 10, cacheRead: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "o1-preview": { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },
  "o3-mini": { input: 1.1, output: 4.4 },
  // GitHub Copilot Enterprise (premium-request based, costs are approximate)
  "openai/gpt-4.1": { input: 2, output: 8, cacheRead: 0.5 },
  "openai/gpt-5-mini": { input: 0.3, output: 1.2, cacheRead: 0.075 },
  "openai/gpt-5.4": { input: 2.5, output: 10, cacheRead: 0.6 },
  "openai/gpt-5.4-mini": { input: 0.3, output: 1.2, cacheRead: 0.075 },
  "anthropic/claude-sonnet-4.5": { input: 3, output: 15, cacheRead: 0.3 },
  "anthropic/claude-sonnet-4.6": { input: 3, output: 15, cacheRead: 0.3 },
  "anthropic/claude-opus-4.6": { input: 15, output: 75, cacheRead: 1.5 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10 },
  // Azure Claude (pay-per-token via Azure subscription)
  "claude-3.5-sonnet": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-3-opus": { input: 15, output: 75, cacheRead: 1.5 },
  "claude-3-haiku": { input: 0.25, output: 1.25, cacheRead: 0.03 },
};

export function estimateCost(
  modelId: string | undefined,
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number },
): number | null {
  if (!modelId) return null;
  const p = MODEL_PRICING[modelId];
  if (!p) return null;
  const fresh = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const cached = usage.cachedInputTokens;
  return (
    (fresh * p.input + cached * (p.cacheRead ?? p.input) + usage.outputTokens * p.output) /
    1_000_000
  );
}

/** All providers require an API key / token. */
export function providerNeedsKey(_id: ProviderId): boolean {
  return true;
}

/** All providers support API keys. */
export function providerSupportsKey(_id: ProviderId): boolean {
  return true;
}

/** Any provider can power the editor's inline autocomplete. */
export type AutocompleteProviderId = ProviderId;

/** Sensible default model id per provider for inline autocomplete. */
export const DEFAULT_AUTOCOMPLETE_MODEL: Partial<Record<ProviderId, string>> = {
  "azure-openai": "gpt-4o-mini",
  "github-copilot": "openai/gpt-5-mini",
  "azure-claude": "claude-3-haiku",
};

/** Curated list of fast models suitable for inline completion (speed ≥ 4). */
export function getAutocompleteEligibleModels(): readonly ModelInfo[] {
  return MODELS.filter((m) => m.capabilities.speed >= 4);
}

export const AZURE_OPENAI_DEFAULT_ENDPOINT = "";
export const AZURE_CLAUDE_DEFAULT_ENDPOINT = "";
export const GITHUB_MODELS_BASE_URL = "https://models.github.ai/inference";
export const MAX_AGENT_STEPS = 24;
export const TERMINAL_BUFFER_LINES = 300;

export const SYSTEM_PROMPT = `You are Terax, an AI assistant embedded in a developer terminal emulator.

# Environment
Every turn carries a short <env> block: workspace_root, active_terminal_cwd, optionally active_file. Treat it as ground truth — never ask the user where they are. The terminal scrollback is NOT auto-injected; call get_terminal_output only when the user references "this error" / "the last command" or you genuinely need to interpret recent output.

# Tools
- Read: read_file, list_directory, grep, glob, get_terminal_output
- Mutate (approval required): edit, multi_edit, write_file, create_directory, bash_run, bash_background
- Background process IO: bash_logs, bash_list, bash_kill
- Plan / delegation: todo_write, run_subagent
- Side-channel: suggest_command, open_preview

# Tool budget — read these before acting
- Don't re-read a file you read earlier this session unless you wrote to it; if you do, read_file returns {unchanged: true} and you pay the round-trip for nothing.
- One focused grep beats three list_directory calls. Use grep for "where is X?", glob for "what files match path Y?", list_directory for "show me this folder".
- read_file defaults to the first 25KB / 2000 lines. Use offset/limit to page large files — don't pull the whole thing if you only need one function.
- Before five or more tool calls in a row without speaking to the user, write a one-line plan via todo_write so they can see your trajectory.
- Skip todo_write for single-step asks (one read, one command, one tiny edit).

# Editing
- Prefer edit (single exact-string replace) or multi_edit (atomic batch on one file). Both require a prior read_file on the path in this session.
- old_string must be unique in the file unless replace_all: true. If it's not, expand context until it is — don't lower your standard.
- write_file is for brand-new files or full replacement of tiny ones. Never use it as a proxy for a targeted change.

# Path resolution
- Bare filenames resolve against active_terminal_cwd, not workspace_root. Never write to /notes.md.
- "create X" with no path → active_terminal_cwd, else workspace_root, else ask once.
- "edit/fix this file" with no path → active_file when present.
- Before write_file or create_directory, list_directory the parent to confirm it exists.

# Shell
- bash_run for short-lived commands you need to complete the task (lint, test, search, install). cwd persists across calls in the session shell. Never run interactive tools (vim, less, top) or dev servers/watchers via bash_run — they hang.
- bash_background for dev servers, watchers, log tailers. Read output via bash_logs, terminate via bash_kill.
- BEFORE spawning any dev server (pnpm dev, next dev, vite, cargo watch, ...) call bash_list. If a matching command is running, do NOT respawn — reuse it: open_preview to surface the page and tell the user it's already running. Only restart on explicit user request (bash_kill the old handle first).
- After editing files in a project whose dev server is already up, tell the user "should hot-reload" — don't respawn.
- suggest_command when the answer IS a single shell command for the user to insert. Don't also paste it in prose.

# Output style
- Concise. No filler, no apologies, no restating the question.
- Code blocks always carry a language fence.
- State *why* in one sentence before any mutation tool call.
- Refused reads on sensitive files (.env, .ssh, credentials) are final — don't retry.`;

export const SYSTEM_PROMPT_LITE = `You are Terax, an AI assistant embedded in a developer terminal emulator. Each turn carries an <env> block with workspace_root, active_terminal_cwd, optional active_file — treat as ground truth.

Tools: read_file, list_directory, grep, glob, get_terminal_output, edit, multi_edit, write_file, create_directory, bash_run, bash_background, bash_logs, bash_list, bash_kill, suggest_command, open_preview.

Rules:
- Bare filenames resolve to active_terminal_cwd, not workspace_root.
- Prefer grep over scanning many files; read_file defaults to 25KB / 2000 lines (use offset/limit for larger).
- edit/multi_edit need a prior read_file on the path. write_file for new/tiny files only.
- Mutations (edit, write_file, bash_*) require user approval — state why in one sentence first.
- bash_list before any dev server; reuse if already running.
- Concise. No filler.`;

const LITE_SYSTEM_PROMPT_MODEL_IDS = new Set<string>([
  "gpt-4o-mini",
  "github/gpt-4o-mini",
  "o1-mini",
  "github/o1-mini",
  "claude-3-haiku",
]);

export function selectSystemPrompt(modelId: string | undefined): string {
  if (modelId && LITE_SYSTEM_PROMPT_MODEL_IDS.has(modelId)) {
    return SYSTEM_PROMPT_LITE;
  }
  return SYSTEM_PROMPT;
}
