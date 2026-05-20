import { useCallback, useState } from "react";
import type { GitStatusEntry } from "./lib/api";
import { GitFileItem } from "./GitFileItem";
import { GitIgnoreDialog } from "./GitIgnoreDialog";
import { GitTreeView } from "./GitTreeView";

export type ViewMode = "list" | "tree";

type Props = {
  rootPath: string;
  staged: GitStatusEntry[];
  unstaged: GitStatusEntry[];
  onStage: (files: string[]) => void;
  onUnstage: (files: string[]) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscard: (file: string) => void;
  onDiscardAll: () => void;
  viewMode: ViewMode;
  expandSignal: number;
};

export function GitChanges({
  rootPath,
  staged,
  unstaged,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onDiscard,
  onDiscardAll,
  viewMode,
  expandSignal,
}: Props) {
  // Multi-select state
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());
  // Gitignore dialog state
  const [gitignoreFiles, setGitignoreFiles] = useState<string[] | null>(null);

  const handleGitignore = useCallback((files: string[]) => {
    setGitignoreFiles(files);
  }, []);

  const handleSelectUnstaged = useCallback((path: string, checked: boolean) => {
    setSelectedUnstaged((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const handleSelectStaged = useCallback((path: string, checked: boolean) => {
    setSelectedStaged((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const handleStageSelected = useCallback(() => {
    if (selectedUnstaged.size === 0) return;
    onStage(Array.from(selectedUnstaged));
    setSelectedUnstaged(new Set());
  }, [selectedUnstaged, onStage]);

  const handleUnstageSelected = useCallback(() => {
    if (selectedStaged.size === 0) return;
    onUnstage(Array.from(selectedStaged));
    setSelectedStaged(new Set());
  }, [selectedStaged, onUnstage]);

  const handleSelectAllUnstaged = useCallback(() => {
    if (selectedUnstaged.size === unstaged.length) {
      setSelectedUnstaged(new Set());
    } else {
      setSelectedUnstaged(new Set(unstaged.map((e) => e.path)));
    }
  }, [unstaged, selectedUnstaged.size]);

  const handleSelectAllStaged = useCallback(() => {
    if (selectedStaged.size === staged.length) {
      setSelectedStaged(new Set());
    } else {
      setSelectedStaged(new Set(staged.map((e) => e.path)));
    }
  }, [staged, selectedStaged.size]);

  if (staged.length === 0 && unstaged.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
        No changes detected
      </div>
    );
  }

  return (
    <div>
      {/* Staged section */}
      {staged.length > 0 && (
        <div className="border-b border-border/40">
          {/* Section header — top-level tree node */}
          <div className="flex h-7 items-center gap-1.5 bg-accent/30 px-2">
            <input
              type="checkbox"
              checked={selectedStaged.size === staged.length && staged.length > 0}
              ref={(el) => {
                if (el) el.indeterminate = selectedStaged.size > 0 && selectedStaged.size < staged.length;
              }}
              onChange={handleSelectAllStaged}
              className="h-3 w-3 shrink-0 cursor-pointer accent-primary"
              title="Select all staged"
            />
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 text-muted-foreground">
              <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" />
            </svg>
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
              Staged ({staged.length})
            </span>
            {selectedStaged.size > 0 && (
              <button
                onClick={handleUnstageSelected}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                title={`Unstage ${selectedStaged.size} selected`}
              >
                Unstage {selectedStaged.size}
              </button>
            )}
            <button
              onClick={onUnstageAll}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Unstage all"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.354 3.354a.5.5 0 1 0-.708-.708l-3 3a.5.5 0 0 0 0 .708l3 3a.5.5 0 0 0 .708-.708L3.207 6.5H11.5a.5.5 0 0 0 0-1H3.207l2.147-2.146z" />
              </svg>
            </button>
          </div>
          {/* Sub-tree content indented under section */}
          <div className="pl-3">
            {viewMode === "list" ? (
              staged.map((entry) => (
                <GitFileItem
                  key={`staged-${entry.path}`}
                  entry={entry}
                  section="staged"
                  onAction={() => onUnstage([entry.path])}
                  onGitignore={(p) => handleGitignore([p])}
                  rootPath={rootPath}
                  selected={selectedStaged.has(entry.path)}
                  onSelect={handleSelectStaged}
                />
              ))
            ) : (
              <GitTreeView
                entries={staged}
                section="staged"
                onAction={(path) => onUnstage([path])}
                onGitignore={(p) => handleGitignore([p])}
                rootPath={rootPath}
                expandSignal={expandSignal}
                selectedFiles={selectedStaged}
                onSelect={handleSelectStaged}
              />
            )}
          </div>
        </div>
      )}

      {/* Separator between sections */}
      {staged.length > 0 && unstaged.length > 0 && (
        <div className="my-1 h-px bg-border/60" />
      )}

      {/* Unstaged section */}
      {unstaged.length > 0 && (
        <div className="border-b border-border/40">
          {/* Section header — top-level tree node */}
          <div className="flex h-7 items-center gap-1.5 bg-accent/30 px-2">
            <input
              type="checkbox"
              checked={selectedUnstaged.size === unstaged.length && unstaged.length > 0}
              ref={(el) => {
                if (el) el.indeterminate = selectedUnstaged.size > 0 && selectedUnstaged.size < unstaged.length;
              }}
              onChange={handleSelectAllUnstaged}
              className="h-3 w-3 shrink-0 cursor-pointer accent-primary"
              title="Select all changes"
            />
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 text-muted-foreground">
              <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" />
            </svg>
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
              Changes ({unstaged.length})
            </span>
            {selectedUnstaged.size > 0 && (
              <button
                onClick={handleStageSelected}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                title={`Stage ${selectedUnstaged.size} selected`}
              >
                Stage {selectedUnstaged.size}
              </button>
            )}
            {selectedUnstaged.size > 0 && (
              <button
                onClick={() => handleGitignore(Array.from(selectedUnstaged))}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Add selected to .gitignore"
              >
                .gitignore
              </button>
            )}
            <button
              onClick={onDiscardAll}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              title="Discard all changes"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"
                />
              </svg>
            </button>
            <button
              onClick={onStageAll}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Stage all"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z" />
              </svg>
            </button>
          </div>
          {/* Sub-tree content indented under section */}
          <div className="pl-3">
            {viewMode === "list" ? (
              unstaged.map((entry) => (
                <GitFileItem
                  key={`unstaged-${entry.path}`}
                  entry={entry}
                  section="unstaged"
                  onAction={() => onStage([entry.path])}
                  onDiscard={() => onDiscard(entry.path)}
                  onGitignore={(p) => handleGitignore([p])}
                  rootPath={rootPath}
                  selected={selectedUnstaged.has(entry.path)}
                  onSelect={handleSelectUnstaged}
                />
              ))
            ) : (
              <GitTreeView
                entries={unstaged}
                section="unstaged"
                onAction={(path) => onStage([path])}
                onDiscard={onDiscard}
                onGitignore={(p) => handleGitignore([p])}
                rootPath={rootPath}
                expandSignal={expandSignal}
                selectedFiles={selectedUnstaged}
                onSelect={handleSelectUnstaged}
              />
            )}
          </div>
        </div>
      )}

      {/* Gitignore dialog */}
      {gitignoreFiles && (
        <GitIgnoreDialog
          files={gitignoreFiles}
          rootPath={rootPath}
          onClose={() => setGitignoreFiles(null)}
          onDone={() => {
            setGitignoreFiles(null);
            setSelectedUnstaged(new Set());
            setSelectedStaged(new Set());
          }}
        />
      )}
    </div>
  );
}
