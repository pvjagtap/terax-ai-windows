import {
  DEFAULT_AUTOCOMPLETE_MODEL,
  AZURE_OPENAI_DEFAULT_ENDPOINT,
  type AutocompleteProviderId,
} from "@/modules/ai/config";
import { buildLanguageModel } from "@/modules/ai/lib/agent";
import { EMPTY_PROVIDER_KEYS } from "@/modules/ai/lib/keyring";
import { generateText } from "ai";
import {
  buildUserPrompt,
  COMPLETION_SYSTEM_PROMPT,
  type CompletionRequest,
} from "./prompt";

export type CompletionDeps = {
  provider: AutocompleteProviderId;
  modelId: string;
  /** API key for the configured provider. */
  apiKey: string | null;
  azureOpenaiEndpoint: string;
};

const MAX_OUTPUT_TOKENS_DEFAULT = 128;

export async function requestCompletion(
  req: CompletionRequest,
  deps: CompletionDeps,
  signal: AbortSignal,
): Promise<string> {
  const modelId =
    deps.modelId.trim() || DEFAULT_AUTOCOMPLETE_MODEL[deps.provider] || "";
  if (!modelId) {
    throw new Error(
      `No autocomplete model id set for ${deps.provider}.`,
    );
  }
  const keys = { ...EMPTY_PROVIDER_KEYS, [deps.provider]: deps.apiKey };
  const model = await buildLanguageModel(deps.provider, keys, modelId, {
    azureOpenaiEndpoint: deps.azureOpenaiEndpoint || AZURE_OPENAI_DEFAULT_ENDPOINT,
  });

  const { text } = await generateText({
    model,
    system: COMPLETION_SYSTEM_PROMPT,
    prompt: buildUserPrompt(req),
    maxOutputTokens: MAX_OUTPUT_TOKENS_DEFAULT,
    maxRetries: 0,
    abortSignal: signal,
    temperature: 0.2,
  });

  return cleanCompletion(text);
}

function cleanCompletion(raw: string): string {
  let t = raw;
  const fence = t.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```\s*$/);
  if (fence) t = fence[1];
  t = t.replace(/^<\|cursor\|>/, "");
  return t;
}
