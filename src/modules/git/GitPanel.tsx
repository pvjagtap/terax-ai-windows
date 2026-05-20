import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { useCallback, useState } from "react";
import { GitChanges } from "./GitChanges";
import type { ViewMode } from "./GitChanges";
import { GitCommitInput } from "./GitCommitInput";
import { GitBranchBar } from "./GitBranchBar";
import { GitLogView } from "./GitLogView";
import { GitEmpty } from "./GitEmpty";
import { useGitStatus } from "./lib/useGitStatus";
import {
  gitCommit,
  gitInit,
  gitStage,
  gitStageAll,
  gitUnstage,
  gitUnstageAll,
  gitDiscardFile,
  gitDiscardAll,
} from "./lib/api";

type Props = {
  rootPath: string | null;
};

type View = "changes" | "log";

export function GitPanel({ rootPath }: Props) {
  const gitEnabled = usePreferencesStore((s) => s.gitEnabled);
  const { status, isRepo, loading: _loading, error, refresh } = useGitStatus(rootPath);
  const [view, setView] = useState<View>("changes");
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [expandSignal, setExpandSignal] = useState(0);

  const handleStage = useCallback(
    async (files: string[]) => {
      if (!rootPath) return;
      await gitStage(rootPath, files);
      await refresh();
    },
    [rootPath, refresh],
  );

  const handleUnstage = useCallback(
    async (files: string[]) => {
      if (!rootPath) return;
      await gitUnstage(rootPath, files);
      await refresh();
    },
    [rootPath, refresh],
  );

  const handleStageAll = useCallback(async () => {
    if (!rootPath) return;
    await gitStageAll(rootPath);
    await refresh();
  }, [rootPath, refresh]);

  const handleUnstageAll = useCallback(async () => {
    if (!rootPath) return;
    await gitUnstageAll(rootPath);
    await refresh();
  }, [rootPath, refresh]);

  const handleDiscard = useCallback(
    async (filePath: string) => {
      if (!rootPath) return;
      await gitDiscardFile(rootPath, filePath);
      await refresh();
    },
    [rootPath, refresh],
  );

  const handleDiscardAll = useCallback(async () => {
    if (!rootPath) return;
    await gitDiscardAll(rootPath);
    await refresh();
  }, [rootPath, refresh]);

  const handleCommit = useCallback(async () => {
    if (!rootPath || !commitMessage.trim()) return;
    setCommitting(true);
    try {
      await gitCommit(rootPath, commitMessage.trim());
      setCommitMessage("");
      await refresh();
    } catch (e) {
      console.error("Commit failed:", e);
    } finally {
      setCommitting(false);
    }
  }, [rootPath, commitMessage, refresh]);

  const handleInit = useCallback(async () => {
    if (!rootPath) return;
    try {
      await gitInit(rootPath);
      await refresh();
    } catch (e) {
      console.error("Git init failed:", e);
    }
  }, [rootPath, refresh]);

  if (!rootPath) {
    return <GitEmpty message="No directory open" />;
  }

  if (!gitEnabled) {
    return <GitEmpty message="Git integration is disabled" />;
  }

  if (!isRepo) {
    return (
      <GitEmpty message="Not a git repository">
        <Button
          size="sm"
          variant="secondary"
          className="mt-2 text-xs"
          onClick={handleInit}
        >
          Initialize Repository
        </Button>
      </GitEmpty>
    );
  }

  if (error) {
    return <GitEmpty message={`Error: ${error}`} />;
  }

  const stagedFiles = status?.entries.filter((e) => e.staged) ?? [];
  const unstagedFiles = status?.entries.filter((e) => e.working_tree) ?? [];
  const hasStagedChanges = stagedFiles.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Branch bar */}
      <GitBranchBar
        rootPath={rootPath}
        branch={status?.branch ?? null}
        remoteBranch={status?.remote_branch ?? null}
        ahead={status?.ahead ?? 0}
        behind={status?.behind ?? 0}
        isRebasing={status?.is_rebasing ?? false}
        isMerging={status?.is_merging ?? false}
        onRefresh={refresh}
      />

      {/* View toggle */}
      <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/60 px-2">
        <button
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
            view === "changes"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setView("changes")}
        >
          Changes
          {(stagedFiles.length + unstagedFiles.length > 0) && (
            <span className="ml-1 text-[10px] opacity-70">
              {stagedFiles.length + unstagedFiles.length}
            </span>
          )}
        </button>
        <button
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
            view === "log"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setView("log")}
        >
          Log
        </button>
      </div>

      {view === "changes" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Commit input */}
          <GitCommitInput
            value={commitMessage}
            onChange={setCommitMessage}
            onCommit={handleCommit}
            disabled={!hasStagedChanges || committing}
            loading={committing}
          />

          {/* View mode toolbar — OUTSIDE ScrollArea so always visible */}
          <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border bg-background px-2">
            {/* Left: expand/collapse (tree mode only) */}
            {viewMode === "tree" && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setExpandSignal((s) => s + 1)}
                  className="flex h-5 w-5 items-center justify-center rounded border border-border text-foreground hover:bg-accent"
                  title="Expand all"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8zm4-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 5 5zm0 6a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 5 11z" />
                  </svg>
                </button>
                <button
                  onClick={() => setExpandSignal((s) => s - 1)}
                  className="flex h-5 w-5 items-center justify-center rounded border border-border text-foreground hover:bg-accent"
                  title="Collapse all"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Spacer */}
            <span className="flex-1" />

            {/* Right: list/tree toggle — always visible */}
            <div className="flex items-center overflow-hidden rounded border border-border">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-5 w-6 items-center justify-center text-foreground transition-colors",
                  viewMode === "list" ? "bg-accent" : "hover:bg-accent/50",
                )}
                title="List view"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 4zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 12z" />
                </svg>
              </button>
              <span className="h-4 w-px bg-border" />
              <button
                onClick={() => setViewMode("tree")}
                className={cn(
                  "flex h-5 w-6 items-center justify-center text-foreground transition-colors",
                  viewMode === "tree" ? "bg-accent" : "hover:bg-accent/50",
                )}
                title="Tree view"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .5.5v1A.5.5 0 0 1 2 3H.5a.5.5 0 0 1-.5-.5v-1zM4 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM4 7.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM4 11.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM0 5.5A.5.5 0 0 1 .5 5H2a.5.5 0 0 1 .5.5v1A.5.5 0 0 1 2 7H.5a.5.5 0 0 1-.5-.5v-1zM0 9.5A.5.5 0 0 1 .5 9H2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-1z" />
                </svg>
              </button>
            </div>
          </div>

          {/* File changes — scrollable */}
          <ScrollArea className="min-h-0 flex-1">
            <GitChanges
              rootPath={rootPath}
              staged={stagedFiles}
              unstaged={unstagedFiles}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
              onDiscard={handleDiscard}
              onDiscardAll={handleDiscardAll}
              viewMode={viewMode}
              expandSignal={expandSignal}
            />
          </ScrollArea>
        </div>
      ) : (
        <GitLogView rootPath={rootPath} />
      )}
    </div>
  );
}
