import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ThemePref } from "@/modules/settings/store";
import {
  EDITOR_THEME_LABELS,
  EDITOR_THEMES,
  TERMINAL_FONT_SIZES,
  setAutostart,
  setBackgroundImage,
  setEditorTheme,
  setRestoreWindowState,
  setShowHidden,
  setTerminalFontSize,
  setTerminalWebglEnabled,
  setVimMode,
  type BackgroundImageConfig,
  type BackgroundImageMode,
  type EditorThemeId,
} from "@/modules/settings/store";
import { useTheme } from "@/modules/theme";
import {
  ArrowDown01Icon,
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useRef } from "react";
import { SectionHeader } from "../components/SectionHeader";
import { SettingRow } from "../components/SettingRow";

const APPEARANCE: {
  id: ThemePref;
  label: string;
  icon: typeof ComputerIcon;
}[] = [
  { id: "system", label: "System", icon: ComputerIcon },
  { id: "light", label: "Light", icon: Sun03Icon },
  { id: "dark", label: "Dark", icon: Moon02Icon },
];

export function GeneralSection() {
  const { theme, setTheme } = useTheme();
  const editorTheme = usePreferencesStore((s) => s.editorTheme);
  const autostart = usePreferencesStore((s) => s.autostart);
  const restoreWindowState = usePreferencesStore((s) => s.restoreWindowState);
  const vimMode = usePreferencesStore((s) => s.vimMode);
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const terminalWebglEnabled = usePreferencesStore(
    (s) => s.terminalWebglEnabled,
  );
  const terminalFontSize = usePreferencesStore((s) => s.terminalFontSize);
  const backgroundImage = usePreferencesStore((s) => s.backgroundImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reconcile autostart pref with the actual OS state on mount — the user may
  // have toggled it from System Settings.
  useEffect(() => {
    let alive = true;
    void isEnabled()
      .then((on) => {
        if (!alive) return;
        if (on !== usePreferencesStore.getState().autostart) {
          void setAutostart(on);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const onToggleAutostart = async (next: boolean) => {
    try {
      if (next) await enable();
      else await disable();
      await setAutostart(next);
    } catch (e) {
      console.error("autostart toggle failed", e);
    }
  };

  const onPickEditor = (id: EditorThemeId) => void setEditorTheme(id);

  const onToggleTerminalWebgl = (next: boolean) => {
    void setTerminalWebglEnabled(next).catch((e) =>
      console.error("terminal WebGL preference update failed", e),
    );
  };

  const onPickTerminalFontSize = (size: number) => void setTerminalFontSize(size);

  const onPickBackgroundImage = () => fileInputRef.current?.click();

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const config: BackgroundImageConfig = {
        dataUrl,
        fileName: file.name,
        mode: backgroundImage?.mode ?? "cover",
        opacity: backgroundImage?.opacity ?? 15,
        size: backgroundImage?.size ?? 100,
      };
      void setBackgroundImage(config);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const onRemoveBackgroundImage = () => void setBackgroundImage(null);

  const onChangeBackgroundMode = (mode: BackgroundImageMode) => {
    if (!backgroundImage) return;
    void setBackgroundImage({ ...backgroundImage, mode });
  };

  const onChangeBackgroundOpacity = (value: number[]) => {
    if (!backgroundImage) return;
    void setBackgroundImage({ ...backgroundImage, opacity: value[0] });
  };

  const onChangeBackgroundSize = (value: number[]) => {
    if (!backgroundImage) return;
    void setBackgroundImage({ ...backgroundImage, size: value[0] });
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="General"
        description="Appearance, editor, and startup."
      />

      <div className="flex flex-col gap-2">
        <Label>Appearance</Label>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCE.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setTheme(o.id)}
              className={cn(
                "group flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card transition-all",
                theme === o.id
                  ? "border-foreground/60 ring-1 ring-foreground/20"
                  : "border-border/60 hover:border-border",
              )}
            >
              <HugeiconsIcon icon={o.icon} size={18} strokeWidth={1.5} />
              <span className="text-[11.5px]">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Editor theme</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 justify-between gap-2 px-2.5 text-[12px]"
            >
              <span>{EDITOR_THEME_LABELS[editorTheme]}</span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={12}
                strokeWidth={2}
                className="opacity-70"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px]">
            {EDITOR_THEMES.map((t) => (
              <DropdownMenuItem
                key={t}
                onSelect={() => onPickEditor(t)}
                className={cn(
                  "text-[12px]",
                  t === editorTheme && "bg-accent/50",
                )}
              >
                {EDITOR_THEME_LABELS[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <SettingRow
          title="Vim mode"
          description="Enable Vim keybindings in the code editor."
        >
          <Switch
            checked={vimMode}
            onCheckedChange={(v) => void setVimMode(v)}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Explorer</Label>
        <SettingRow
          title="Show hidden files"
          description="Include dot-prefixed files and folders (.env, .gitignore, .config) in the file explorer and search."
        >
          <Switch
            checked={showHidden}
            onCheckedChange={(v) => void setShowHidden(v)}
          />
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Terminal</Label>
        <SettingRow
          title={
            <span className="inline-flex items-center gap-1.5">
              Use WebGL renderer
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="cursor-help text-[11px] text-muted-foreground leading-none"
                      aria-label="More info about WebGL renderer"
                    >
                      ⓘ
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-[11px]">
                    xterm's WebGL renderer caches glyphs in a GPU texture atlas. On some macOS setups (especially with Nerd Fonts), the atlas corrupts and terminal text becomes unreadable. Turn this off as a fallback — performance dips slightly, but text renders correctly via the DOM renderer.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          }
          description="Hardware-accelerated rendering. Turn off if text shows corruption or blank tiles."
        >
          <Switch
            checked={terminalWebglEnabled}
            onCheckedChange={onToggleTerminalWebgl}
          />
        </SettingRow>
        <SettingRow
          title="Font size"
          description="Terminal text size."
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-8 justify-between gap-2 rounded-none px-2.5 text-[12px]"
              >
                <span>{terminalFontSize} px</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={12}
                  strokeWidth={2}
                  className="opacity-70"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[80px] rounded-none border border-border bg-popover p-0 shadow-none ring-0"
            >
              {TERMINAL_FONT_SIZES.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onSelect={() => onPickTerminalFontSize(size)}
                  className={cn(
                    "rounded-none px-3 py-1.5 text-[12px]",
                    size === terminalFontSize && "bg-accent/50",
                  )}
                >
                  {size} px
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingRow>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Background image</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileSelected}
        />
        <div className="flex flex-col gap-2">
          {backgroundImage ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
                <div
                  className="h-10 w-16 shrink-0 rounded border border-border/40 bg-cover bg-center"
                  style={{ backgroundImage: `url(${backgroundImage.dataUrl})` }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[12px] font-medium">{backgroundImage.fileName}</span>
                  <span className="text-[10.5px] text-muted-foreground">Click "Change" to replace</span>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={onPickBackgroundImage}>
                    Change
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px] text-destructive" onClick={onRemoveBackgroundImage}>
                    Remove
                  </Button>
                </div>
              </div>

              <SettingRow title="Display mode" description="How the image fills the background.">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 justify-between gap-2 rounded-none px-2.5 text-[12px]">
                      <span className="capitalize">{backgroundImage.mode}</span>
                      <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2} className="opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[120px] rounded-none border border-border bg-popover p-0 shadow-none ring-0">
                    {(["cover", "contain", "center"] as BackgroundImageMode[]).map((m) => (
                      <DropdownMenuItem
                        key={m}
                        onSelect={() => onChangeBackgroundMode(m)}
                        className={cn("rounded-none px-3 py-1.5 text-[12px] capitalize", m === backgroundImage.mode && "bg-accent/50")}
                      >
                        {m}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SettingRow>

              <SettingRow
                title={`Opacity — ${backgroundImage.opacity}%`}
                description="Transparency of the background image."
              >
                <Slider
                  value={[backgroundImage.opacity]}
                  onValueChange={onChangeBackgroundOpacity}
                  min={1}
                  max={100}
                  step={1}
                  className="w-32"
                />
              </SettingRow>

              {backgroundImage.mode === "center" && (
                <SettingRow
                  title={`Size — ${backgroundImage.size}%`}
                  description="Scale of the centered image."
                >
                  <Slider
                    value={[backgroundImage.size]}
                    onValueChange={onChangeBackgroundSize}
                    min={5}
                    max={100}
                    step={1}
                    className="w-32"
                  />
                </SettingRow>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-card/40 px-3 py-4">
              <span className="text-[12px] text-muted-foreground">No background image set</span>
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={onPickBackgroundImage}>
                Choose image
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Startup</Label>
        <div className="flex flex-col gap-2">
          <SettingRow
            title="Launch at login"
            description="Open Terax automatically when you sign in."
          >
            <Switch
              checked={autostart}
              onCheckedChange={(v) => void onToggleAutostart(v)}
            />
          </SettingRow>
          <SettingRow
            title="Restore window position & size"
            description="Reopen the main window where you left it. Applies on next launch."
          >
            <Switch
              checked={restoreWindowState}
              onCheckedChange={(v) => void setRestoreWindowState(v)}
            />
          </SettingRow>
        </div>
      </div>
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
