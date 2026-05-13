import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtShortcut, MOD_KEY } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { fileIconUrl } from "@/modules/explorer/lib/iconResolver";
import {
  Cancel01Icon,
  ComputerTerminal02Icon,
  Globe02Icon,
  IncognitoIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import type { EditorTab, Tab } from "./lib/useTabs";

type Props = {
  tabs: Tab[];
  activeId: number;
  expanded: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onNewPrivate: () => void;
  onNewPreview: () => void;
  onNewEditor: () => void;
  onClose: (id: number) => void;
  onPin: (id: number) => void;
};

export function VerticalTabBar({
  tabs,
  activeId,
  expanded,
  onSelect,
  onNew,
  onNewPrivate,
  onNewPreview,
  onNewEditor,
  onClose,
  onPin,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeId, tabs.length]);

  return (
    <div className={cn(
      "flex h-full flex-col border-r border-border/60 bg-card transition-[width] duration-150",
      expanded ? "w-44" : "w-10",
    )}>
      <div
        ref={scrollRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          expanded ? "items-stretch px-1.5" : "items-center",
        )}
      >
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          const isPreview = t.kind === "editor" && (t as EditorTab).preview;
          const label = labelFor(t);

          const btn = (
            <button
              data-tab-id={t.id}
              onClick={() => onSelect(t.id)}
              onDoubleClick={() => isPreview && onPin(t.id)}
              className={cn(
                "group relative flex shrink-0 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground/80",
                isActive && "bg-accent text-foreground",
                expanded ? "h-7 gap-2 px-2" : "size-7 justify-center",
              )}
            >
              <TabIcon tab={t} />
              {expanded && (
                <span className="flex-1 truncate text-left text-xs">{label}</span>
              )}
              {t.kind === "editor" && t.dirty && (
                <span className={cn(
                  "absolute size-1.5 rounded-full bg-foreground/70",
                  expanded ? "top-1/2 right-1.5 -translate-y-1/2" : "top-0.5 right-0.5",
                )} />
              )}
              {tabs.length > 1 && (
                <span
                  role="button"
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(t.id);
                  }}
                  className={cn(
                    "absolute flex size-3.5 items-center justify-center rounded-full bg-card shadow-sm transition-opacity group-hover:opacity-100",
                    expanded
                      ? "top-1/2 right-0.5 -translate-y-1/2 opacity-0"
                      : "-top-0.5 -right-0.5 opacity-0",
                  )}
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={8}
                    strokeWidth={2.5}
                  />
                </span>
              )}
            </button>
          );

          // In collapsed mode, wrap in tooltip; in expanded mode, label is visible
          if (expanded) {
            return <div key={t.id}>{btn}</div>;
          }

          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>{btn}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className={cn(
        "flex flex-col gap-1 border-t border-border/60 py-2",
        expanded ? "items-stretch px-1.5" : "items-center",
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={expanded ? "sm" : "icon"}
              className={cn(
                "shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
                expanded ? "h-7 justify-start gap-2 px-2 text-xs" : "size-7",
              )}
              title="New tab"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
              {expanded && <span>New tab</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="min-w-44">
            <DropdownMenuItem onSelect={() => onNew()}>
              <HugeiconsIcon
                icon={ComputerTerminal02Icon}
                size={14}
                strokeWidth={1.75}
              />
              <span className="flex-1">Terminal</span>
              <span className="text-xs text-muted-foreground">
                {fmtShortcut(MOD_KEY, "T")}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNewPrivate()}>
              <HugeiconsIcon
                icon={IncognitoIcon}
                size={14}
                strokeWidth={1.75}
              />
              <span className="flex-1">Privacy</span>
              <span className="text-xs text-muted-foreground">
                {fmtShortcut(MOD_KEY, "R")}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNewEditor()}>
              <HugeiconsIcon
                icon={PencilEdit02Icon}
                size={14}
                strokeWidth={1.75}
              />
              <span className="flex-1">Editor</span>
              <span className="text-xs text-muted-foreground">
                {fmtShortcut(MOD_KEY, "E")}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNewPreview()}>
              <HugeiconsIcon
                icon={Globe02Icon}
                size={14}
                strokeWidth={1.75}
              />
              <span className="flex-1">Preview</span>
              <span className="text-xs text-muted-foreground">
                {fmtShortcut(MOD_KEY, "P")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  if (tab.kind === "editor") {
    const url = fileIconUrl(tab.title);
    return url ? (
      <img src={url} alt="" className="size-4 shrink-0" />
    ) : (
      <HugeiconsIcon
        icon={PencilEdit02Icon}
        size={16}
        strokeWidth={1.75}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "preview") {
    return (
      <HugeiconsIcon
        icon={Globe02Icon}
        size={16}
        strokeWidth={1.75}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "terminal" && tab.private) {
    return (
      <HugeiconsIcon
        icon={IncognitoIcon}
        size={16}
        strokeWidth={1.75}
        className="shrink-0 text-amber-600 dark:text-amber-400"
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={ComputerTerminal02Icon}
      size={16}
      strokeWidth={1.75}
      className="shrink-0"
    />
  );
}

function labelFor(t: Tab): string {
  if (t.kind === "editor") return t.title;
  if (t.kind === "preview") return t.title;
  if (!t.cwd) return t.title;
  const parts = t.cwd.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}
