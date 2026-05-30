import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WindowControls } from "@/components/WindowControls";
import { IS_MAC, KEY_SEP, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  getBindingTokens,
  SHORTCUTS,
  type ShortcutId,
} from "@/modules/shortcuts/shortcuts";
import {
  GridViewIcon,
  KeyboardIcon,
  LayoutTwoColumnIcon,
  LayoutTwoRowIcon,
  Settings01Icon,
  SidebarLeftIcon,
  SidebarRightIcon,
  TvSmartIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  SearchInline,
  type SearchInlineHandle,
  type SearchTarget,
} from "./SearchInline";

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type Props = {
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onSplit: (dir: "row" | "col") => void;
  canSplit: boolean;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  searchTarget: SearchTarget;
  searchRef: RefObject<SearchInlineHandle | null>;
};

const COMPACT_WIDTH = 720;

export function Header({
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onSplit,
  canSplit,
  onOpenShortcuts,
  onOpenSettings,
  searchTarget,
  searchRef,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [wallpaperMode, setWallpaperMode] = useState(false);
  const userShortcuts = usePreferencesStore((s) => s.shortcuts);
  const now = useClock();

  const toggleWallpaperMode = async () => {
    const next = !wallpaperMode;
    try {
      await invoke("set_wallpaper_mode", { enable: next });
      setWallpaperMode(next);
    } catch (err) {
      console.error("Wallpaper mode failed:", err);
    }
  };

  // Listen for global hotkey toggle from backend (Ctrl+Alt+W)
  useEffect(() => {
    const unlisten = listen<boolean>("wallpaper-mode-changed", (event) => {
      setWallpaperMode(event.payload);
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  const tokensFor = (id: ShortcutId): string => {
    const s = SHORTCUTS.find((s) => s.id === id);
    if (!s) return "";
    const bindings = userShortcuts[id] || s.defaultBindings;
    if (!bindings || bindings.length === 0) return "";
    return getBindingTokens(bindings[0]).join(KEY_SEP);
  };

  const shortcutLabel = useMemo(() => {
    const tokens = tokensFor("shortcuts.open");
    return tokens ? `Keyboard shortcuts (${tokens})` : "Keyboard shortcuts";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userShortcuts]);

  const splitRightTokens = tokensFor("pane.splitRight");
  const splitDownTokens = tokensFor("pane.splitDown");

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setCompact(w < COMPACT_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shortcutsButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={onOpenShortcuts}
      title={shortcutLabel}
    >
      <HugeiconsIcon icon={KeyboardIcon} size={16} strokeWidth={1.75} />
    </Button>
  );

  const settingsButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={onOpenSettings}
      title="Settings"
    >
      <HugeiconsIcon icon={Settings01Icon} size={15} strokeWidth={1.75} />
    </Button>
  );

  return (
    <div
      ref={rootRef}
      data-tauri-drag-region
      className={`flex h-10 shrink-0 items-center gap-2 border-b border-border/60 bg-card select-none ${
        IS_MAC ? "pr-2 pl-20" : "pr-0 pl-2"
      }`}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          onClick={onToggleLeftSidebar}
          title="Toggle left sidebar"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={18} strokeWidth={1.75} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Split terminal"
              disabled={!canSplit}
            >
              <HugeiconsIcon icon={GridViewIcon} size={16} strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuItem onSelect={() => onSplit("row")}>
              <HugeiconsIcon
                icon={LayoutTwoColumnIcon}
                size={14}
                strokeWidth={1.75}
              />
              <span className="flex-1">Split right</span>
              {splitRightTokens && (
                <span className="text-xs text-muted-foreground">
                  {splitRightTokens}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSplit("col")}>
              <HugeiconsIcon
                icon={LayoutTwoRowIcon}
                size={14}
                strokeWidth={1.75}
              />
              <span className="flex-1">Split down</span>
              {splitDownTokens && (
                <span className="text-xs text-muted-foreground">
                  {splitDownTokens}
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!IS_MAC && shortcutsButton}
      </div>

      {!IS_MAC && <span className="mx-1 h-5 w-px shrink-0 bg-border" />}

      {IS_MAC && <span className="mr-1 h-full w-px shrink-0 bg-border" />}

      <div
        className="flex min-w-0 flex-1 items-center justify-center gap-2"
        data-tauri-drag-region
      >
        <span
          data-tauri-drag-region
          className="pointer-events-none font-mono text-[13px] font-medium text-black dark:text-yellow-400"
        >
          {now.toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          {now.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      <SearchInline ref={searchRef} target={searchTarget} compact={compact} />

      {IS_MAC && (
        <>
          {shortcutsButton}
          {settingsButton}
        </>
      )}

      {!IS_MAC && settingsButton}

      <Button
        onClick={() => void toggleWallpaperMode()}
        title={wallpaperMode ? "Exit wallpaper mode" : "Wallpaper mode"}
        variant="ghost"
        size="icon-sm"
        className={`shrink-0 rounded-md hover:bg-accent hover:text-foreground ${
          wallpaperMode ? "text-yellow-400" : "text-muted-foreground"
        }`}
      >
        <HugeiconsIcon icon={TvSmartIcon} size={16} strokeWidth={1.75} />
      </Button>

      <Button
        onClick={onToggleRightSidebar}
        title="Toggle file explorer"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <HugeiconsIcon icon={SidebarRightIcon} size={18} strokeWidth={1.75} />
      </Button>

      {USE_CUSTOM_WINDOW_CONTROLS && (
        <>
          <span className="ml-1 h-5 w-px shrink-0 bg-border" />
          <WindowControls />
        </>
      )}
    </div>
  );
}
