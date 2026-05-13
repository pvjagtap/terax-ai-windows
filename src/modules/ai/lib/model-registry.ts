/**
 * Dynamic model registry.
 *
 * Merges the static models from config.ts with models fetched at runtime
 * from the GitHub Copilot API. Provides a Zustand store so React
 * components re-render when the model list changes.
 */

import { create } from "zustand";
import {
  STATIC_MODELS,
  type ModelInfo,
  type ProviderId,
} from "../config";
import {
  fetchCopilotModels,
  getCopilotSession,
  type CopilotModelEntry,
} from "./copilot-auth";

// ── Helpers: map Copilot API response to ModelInfo ─────────────────────────

/** The endpoint our SDK sends to — models must support this. */
const CHAT_COMPLETIONS = "/chat/completions";

/** Check if a model can be used via /chat/completions. */
function supportsChatCompletions(entry: CopilotModelEntry): boolean {
  // If supported_endpoints is absent/empty, assume the old-style model is OK.
  if (!entry.supported_endpoints || entry.supported_endpoints.length === 0)
    return true;
  return entry.supported_endpoints.includes(CHAT_COMPLETIONS);
}

function buildHint(entry: CopilotModelEntry): string {
  // Use model_picker_category when available
  if (entry.model_picker_category === "lightweight") return "Fast";
  if (entry.model_picker_category === "powerful") return "Best";
  if (entry.model_picker_category === "versatile") return "Versatile";
  // Fall back to name-based inference
  const n = ((entry.name || "") + " " + entry.id).toLowerCase();
  if (n.includes("opus")) return "Best";
  if (n.includes("sonnet")) return "Balanced";
  if (n.includes("haiku")) return "Fast";
  if (n.includes("mini")) return "Fast";
  if (n.includes("pro")) return "Pro";
  if (n.includes("flash")) return "Flash";
  return "Copilot";
}

function inferCapabilities(id: string, name: string): ModelInfo["capabilities"] {
  const n = (name + " " + id).toLowerCase();
  if (n.includes("opus") || n.includes("o1") || n.includes("o3"))
    return { intelligence: 5, speed: 2, cost: 1 };
  if (n.includes("mini") || n.includes("haiku") || n.includes("flash"))
    return { intelligence: 4, speed: 5, cost: 4 };
  return { intelligence: 5, speed: 3, cost: 2 };
}

function inferTags(id: string, name: string): ModelInfo["tags"] {
  const n = (name + " " + id).toLowerCase();
  const tags: ("vision" | "reasoning" | "tools" | "coding")[] = [];
  tags.push("tools", "coding");
  if (n.includes("vision") || n.includes("gpt") || n.includes("gemini"))
    tags.push("vision");
  if (n.includes("o1") || n.includes("o3") || n.includes("reason") || n.includes("opus"))
    tags.push("reasoning");
  return tags;
}

function copilotEntryToModelInfo(entry: CopilotModelEntry): ModelInfo {
  const label = entry.name || entry.id;
  const vendorTag = entry.vendor ? ` (${entry.vendor})` : "";
  const multiplierTag =
    entry.billing?.multiplier != null ? ` · ${entry.billing.multiplier}x` : "";
  return {
    id: entry.id,
    provider: "github-copilot" as ProviderId,
    label,
    hint: `${buildHint(entry)}${multiplierTag}`,
    description: `${label}${vendorTag} via GitHub Copilot.`,
    capabilities: inferCapabilities(entry.id, label),
    tags: inferTags(entry.id, label),
  };
}

// ── Zustand store ──────────────────────────────────────────────────────────

type ModelRegistryState = {
  /** Models fetched from the Copilot API (empty until fetched). */
  copilotModels: ModelInfo[];
  /** Whether a Copilot model fetch is in progress. */
  loading: boolean;
  /** Last fetch error, if any. */
  error: string | null;
  /** Unix-ms timestamp of last successful fetch. */
  lastFetchedAt: number | null;

  // ── Actions ──
  /**
   * Fetch models from the Copilot API and store them.
   * No-ops if already loading. Silently catches errors.
   */
  refreshCopilotModels: () => Promise<void>;
  /** Clear dynamic copilot models (e.g. on sign-out). */
  clearCopilotModels: () => void;
};

export const useModelRegistry = create<ModelRegistryState>((set, get) => ({
  copilotModels: [],
  loading: false,
  error: null,
  lastFetchedAt: null,

  refreshCopilotModels: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const session = await getCopilotSession();
      const raw = await fetchCopilotModels(session);
      // Only include models that:
      //  1) Are shown in the model picker
      //  2) Have capabilities.type === "chat" (not embeddings/completion)
      //  3) Support the /chat/completions endpoint our SDK uses
      const eligible = raw.filter(
        (m) =>
          m.model_picker_enabled !== false &&
          (m.capabilities?.type === "chat" || !m.capabilities?.type) &&
          supportsChatCompletions(m),
      );
      const models = eligible.map(copilotEntryToModelInfo);
      set({ copilotModels: models, loading: false, lastFetchedAt: Date.now() });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  clearCopilotModels: () => {
    set({ copilotModels: [], lastFetchedAt: null, error: null });
  },
}));

// ── Selectors ──────────────────────────────────────────────────────────────

/**
 * Get all models: static (Azure OpenAI, Azure Claude) merged with
 * dynamically-fetched Copilot models.
 *
 * If Copilot models have been fetched, they *replace* the hardcoded
 * Copilot entries in STATIC_MODELS. If not yet fetched, the static
 * fallback entries are used.
 */
export function getAllModels(copilotModels: ModelInfo[]): readonly ModelInfo[] {
  if (copilotModels.length === 0) return STATIC_MODELS;
  // Keep non-copilot static models, then append dynamic copilot models.
  const nonCopilot = STATIC_MODELS.filter(
    (m) => m.provider !== "github-copilot",
  );
  return [...nonCopilot, ...copilotModels];
}

/**
 * React hook returning the merged (static + dynamic) model list.
 * Components should use this instead of importing MODELS directly.
 */
export function useAllModels(): readonly ModelInfo[] {
  const copilotModels = useModelRegistry((s) => s.copilotModels);
  return getAllModels(copilotModels);
}
