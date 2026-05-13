import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  MODELS,
  PROVIDERS,
  getAutocompleteEligibleModels,
  getModel,
  getProvider,
  providerNeedsKey,
  providerSupportsKey,
  type ModelId,
  type ProviderId,
} from "@/modules/ai/config";
import { clearKey, getAllKeys, setKey } from "@/modules/ai/lib/keyring";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  emitKeysChanged,
  setAutocompleteEnabled,
  setAutocompleteModelId,
  setAutocompleteProvider,
  setDefaultModel,
  setAzureOpenaiEndpoint,
  setAzureClaudeEndpoint,
} from "@/modules/settings/store";
import {
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";
import { ProviderIcon } from "../components/ProviderIcon";
import { ProviderKeyCard } from "../components/ProviderKeyCard";
import { CopilotSignInCard } from "../components/CopilotSignInCard";
import { SectionHeader } from "../components/SectionHeader";

type KeysMap = Record<ProviderId, string | null>;

export function ModelsSection() {
  const [keys, setKeys] = useState<KeysMap | null>(null);
  const defaultModel = usePreferencesStore((s) => s.defaultModelId);

  useEffect(() => {
    void getAllKeys().then(setKeys);
  }, []);

  const onSave = async (provider: ProviderId, value: string) => {
    await setKey(provider, value);
    setKeys((prev) => (prev ? { ...prev, [provider]: value } : prev));
    await emitKeysChanged();
  };

  const onClear = async (provider: ProviderId) => {
    await clearKey(provider);
    setKeys((prev) => (prev ? { ...prev, [provider]: null } : prev));
    await emitKeysChanged();
  };

  if (!keys) {
    return <div className="text-[12px] text-muted-foreground">Loading…</div>;
  }

  const configuredCount = PROVIDERS.filter((p) => !!keys[p.id]).length;

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        title="Models"
        description="Configure your Azure and GitHub Copilot endpoints. Keys live in your OS keychain."
      />

      <DefaultModelBlock
        defaultModel={defaultModel}
        keys={keys}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label>Providers</Label>
          <span className="text-[10.5px] text-muted-foreground">
            {configuredCount} of {PROVIDERS.length} configured
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) =>
            p.id === "github-copilot" ? (
              <CopilotSignInCard
                key={p.id}
                signedIn={!!keys[p.id]}
                onAuthChange={async () => {
                  const fresh = await getAllKeys();
                  setKeys(fresh);
                  await emitKeysChanged();
                }}
              />
            ) : (
              <ProviderKeyCard
                key={p.id}
                provider={p}
                currentKey={keys[p.id]}
                onSave={(v) => onSave(p.id, v)}
                onClear={() => onClear(p.id)}
              />
            ),
          )}
        </div>
      </div>

      <AzureEndpointsBlock />

      <AutocompleteBlock keys={keys} />
    </div>
  );
}

function DefaultModelBlock({
  defaultModel,
  keys,
}: {
  defaultModel: ModelId;
  keys: KeysMap;
}) {
  const m = getModel(defaultModel);

  const isAvailable = (_modelId: string, providerId: ProviderId): boolean => {
    // Copilot uses OAuth — check if OAuth token is present in keyring.
    if (providerId === "github-copilot") return !!keys[providerId];
    return providerNeedsKey(providerId) ? !!keys[providerId] : true;
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Default model</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 justify-between gap-2 px-2.5 text-[12px]"
          >
            <span className="flex items-center gap-2">
              <ProviderIcon provider={m.provider} size={14} />
              <span>{m.label}</span>
              <span className="text-muted-foreground">· {m.hint}</span>
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={12}
              strokeWidth={2}
              className="opacity-70"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[28rem] min-w-[280px] overflow-y-auto"
        >
          {PROVIDERS.map((p) => {
            const models = MODELS.filter((x) => x.provider === p.id);
            if (models.length === 0) return null;
            const hasKey =
              p.id === "github-copilot"
                ? !!keys[p.id]
                : providerNeedsKey(p.id)
                  ? !!keys[p.id]
                  : true;
            return (
              <div key={p.id} className="px-1 pt-1.5 first:pt-1">
                <div className="mb-0.5 flex items-center gap-1.5 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  <ProviderIcon provider={p.id} size={11} />
                  <span>{p.label}</span>
                  {!hasKey ? (
                    <span className="ml-auto text-[9.5px] normal-case tracking-normal text-muted-foreground/70">
                      {p.id === "github-copilot" ? "not signed in" : "no key"}
                    </span>
                  ) : null}
                </div>
                {models.map((mod) => {
                  const available = isAvailable(mod.id, p.id);
                  return (
                    <DropdownMenuItem
                      key={mod.id}
                      disabled={!available}
                      onSelect={() =>
                        available && void setDefaultModel(mod.id as ModelId)
                      }
                      className={cn(
                        "flex items-start gap-2 text-[12px]",
                        mod.id === defaultModel && "bg-accent/50",
                      )}
                    >
                      <span className="flex flex-1 flex-col">
                        <span>{mod.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {mod.description}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AzureEndpointsBlock() {
  const azureEndpoint = usePreferencesStore((s) => s.azureOpenaiEndpoint);
  const claudeEndpoint = usePreferencesStore((s) => s.azureClaudeEndpoint);
  const [azureDraft, setAzureDraft] = useState(azureEndpoint);
  const [claudeDraft, setClaudeDraft] = useState(claudeEndpoint);

  useEffect(() => setAzureDraft(azureEndpoint), [azureEndpoint]);
  useEffect(() => setClaudeDraft(claudeEndpoint), [claudeEndpoint]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Label>Endpoint configuration</Label>
        <span className="text-[10.5px] leading-relaxed text-muted-foreground">
          Set the base URLs for your Azure OpenAI and Azure Claude deployments.
          GitHub Copilot uses the GitHub Models endpoint automatically.
        </span>
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
        <FieldRow label="Azure OpenAI">
          <Input
            value={azureDraft}
            onChange={(e) => setAzureDraft(e.target.value)}
            onBlur={() => {
              const v = azureDraft.trim();
              if (v !== azureEndpoint) void setAzureOpenaiEndpoint(v);
            }}
            placeholder="https://myresource.openai.azure.com"
            spellCheck={false}
            className="h-8 flex-1 font-mono text-[11.5px]"
          />
        </FieldRow>

        <FieldRow label="Azure Claude">
          <Input
            value={claudeDraft}
            onChange={(e) => setClaudeDraft(e.target.value)}
            onBlur={() => {
              const v = claudeDraft.trim();
              if (v !== claudeEndpoint) void setAzureClaudeEndpoint(v);
            }}
            placeholder="https://myresource.services.ai.azure.com/models"
            spellCheck={false}
            className="h-8 flex-1 font-mono text-[11.5px]"
          />
        </FieldRow>
      </div>
    </div>
  );
}

function AutocompleteBlock({ keys }: { keys: KeysMap }) {
  const enabled = usePreferencesStore((s) => s.autocompleteEnabled);
  const provider = usePreferencesStore((s) => s.autocompleteProvider);
  const modelId = usePreferencesStore((s) => s.autocompleteModelId);
  const eligible = useMemo(() => getAutocompleteEligibleModels(), []);

  const currentModel = useMemo(
    () =>
      MODELS.find((m) => m.provider === provider && m.id === modelId) ??
      MODELS.find((m) => m.id === modelId) ??
      eligible[0],
    [eligible, provider, modelId],
  );

  const setModel = (id: string, providerId: ProviderId) => {
    void setAutocompleteProvider(providerId);
    void setAutocompleteModelId(id);
  };

  const hasKey = providerSupportsKey(provider)
    ? providerNeedsKey(provider)
      ? !!keys[provider]
      : true
    : true;

  // Group eligible models by provider for the dropdown.
  const grouped = useMemo(() => {
    const map = new Map<ProviderId, (typeof eligible)[number][]>();
    for (const m of eligible) {
      const arr = map.get(m.provider) ?? [];
      arr.push(m);
      map.set(m.provider, arr);
    }
    return map;
  }, [eligible]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label>Editor autocomplete</Label>
          <span className="text-[10.5px] leading-relaxed text-muted-foreground">
            Inline ghost-text suggestions in the code editor. Pick a fast model
            (LPU/wafer-scale, local, or a small cloud tier).
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => void setAutocompleteEnabled(v)}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
        <FieldRow label="Model">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-8 flex-1 justify-between gap-2 px-2.5 text-[11.5px]"
              >
                <span className="flex items-center gap-2 truncate">
                  <ProviderIcon provider={currentModel.provider} size={12} />
                  <span className="truncate">{currentModel.label}</span>
                  <span className="text-muted-foreground">
                    · {currentModel.hint}
                  </span>
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={11}
                  strokeWidth={2}
                  className="opacity-70"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[24rem] min-w-[280px] overflow-y-auto"
            >
              {PROVIDERS.map((p) => {
                const list = grouped.get(p.id);
                if (!list || list.length === 0) return null;
                const pHasKey =
                  p.id === "github-copilot"
                    ? !!keys[p.id]
                    : providerNeedsKey(p.id)
                      ? !!keys[p.id]
                      : true;
                return (
                  <div key={p.id} className="px-1 pt-1.5 first:pt-1">
                    <div className="mb-0.5 flex items-center gap-1.5 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      <ProviderIcon provider={p.id} size={11} />
                      <span>{p.label}</span>
                      {!pHasKey ? (
                        <span className="ml-auto text-[9.5px] normal-case tracking-normal text-muted-foreground/70">
                          no key
                        </span>
                      ) : null}
                    </div>
                    {list.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        disabled={!pHasKey}
                        onSelect={() => pHasKey && setModel(m.id, p.id)}
                        className={cn(
                          "text-[11.5px]",
                          m.id === modelId && "bg-accent/50",
                        )}
                      >
                        <span className="flex flex-col">
                          <span>{m.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {m.description}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </FieldRow>

        {!hasKey ? (
          <span className="text-[10.5px] text-amber-500">
            No API key configured for {getProvider(provider).label}. Add one
            above.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] tracking-tight text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
      {children}
    </span>
  );
}
