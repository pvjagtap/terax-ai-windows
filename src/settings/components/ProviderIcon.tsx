import type { ProviderId } from "@/modules/ai/config";
import {
  CloudIcon,
  ChatGptIcon,
  ClaudeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const ICON_BY_PROVIDER = {
  "azure-openai": CloudIcon,
  "github-copilot": ChatGptIcon,
  "azure-claude": ClaudeIcon,
} as const satisfies Record<ProviderId, typeof ChatGptIcon>;

type Props = {
  provider: ProviderId;
  size?: number;
  className?: string;
};

export function ProviderIcon({ provider, size = 14, className }: Props) {
  return (
    <HugeiconsIcon
      icon={ICON_BY_PROVIDER[provider]}
      size={size}
      strokeWidth={1.75}
      className={className}
    />
  );
}
