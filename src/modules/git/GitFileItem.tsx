import { cn } from "@/lib/utils";
import { useCallback, useRef, useState } from "react";
import type { GitStatusEntry } from "./lib/api";

type Props = {
  entry: GitStatusEntry;
  section: "staged" | "unstaged";
  onAction: () => void;
  onDiscard?: () => void;
  onGitignore?: (path: string) => void;
  rootPath: string;
  showFilenameOnly?: boolean;
  selected?: boolean;
  onSelect?: (path: string, checked: boolean) => void;
};

const STATUS_COLORS: Record<string, string> = {
  modified: "text-amber-500",
  new: "text-green-500",
  deleted: "text-red-500",
  renamed: "text-blue-500",
  conflicted: "text-red-600",
  typechange: "text-purple-500",
  unknown: "text-muted-foreground",
};

const STATUS_LETTERS: Record<string, string> = {
  modified: "M",
  new: "U",
  deleted: "D",
  renamed: "R",
  conflicted: "C",
  typechange: "T",
  unknown: "?",
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

export function GitFileItem({ entry, section, onAction, onDiscard, onGitignore, rootPath: _rootPath, showFilenameOnly, selected, onSelect }: Props) {
  const color = STATUS_COLORS[entry.status] ?? STATUS_COLORS.unknown;
  const letter = STATUS_LETTERS[entry.status] ?? "?";
  const fileName = basename(entry.path);
  const dir = showFilenameOnly ? "" : dirname(entry.path);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  return (
    <>
      <div
        className="group flex h-6 items-center gap-1 px-2 text-[12px] hover:bg-accent/50"
        onContextMenu={handleContextMenu}
      >
      {/* Checkbox for multi-select */}
      {onSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(e) => onSelect(entry.path, e.target.checked)}
          className="h-3 w-3 shrink-0 cursor-pointer accent-primary"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Status indicator */}
      <span className={cn("w-3 shrink-0 text-center text-[10px] font-bold", color)}>
        {letter}
      </span>

      {/* File name */}
      <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
        <span className="truncate text-foreground/90">{fileName}</span>
        {dir && (
          <span className="truncate text-[10px] text-muted-foreground/70">{dir}</span>
        )}
      </span>

      {/* Action buttons */}
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {section === "unstaged" && onDiscard && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            title="Discard changes"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0V5zm3 0a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0V5z" />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          title={section === "staged" ? "Unstage" : "Stage"}
        >
          {section === "staged" ? (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.354 3.354a.5.5 0 1 0-.708-.708l-3 3a.5.5 0 0 0 0 .708l3 3a.5.5 0 0 0 .708-.708L3.207 6.5H11.5a.5.5 0 0 0 0-1H3.207l2.147-2.146z" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z" />
            </svg>
          )}
        </button>
      </span>
    </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div
            ref={ctxRef}
            className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-lg"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              onClick={() => { onAction(); closeMenu(); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] text-foreground hover:bg-accent"
            >
              {section === "staged" ? "Unstage" : "Stage"}
            </button>
            {section === "unstaged" && onDiscard && (
              <button
                onClick={() => { onDiscard(); closeMenu(); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] text-foreground hover:bg-accent hover:text-destructive"
              >
                Discard Changes
              </button>
            )}
            {onGitignore && (
              <>
                <div className="my-1 h-px bg-border/60" />
                <button
                  onClick={() => { onGitignore(entry.path); closeMenu(); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-[11px] text-foreground hover:bg-accent"
                >
                  Add to .gitignore
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
