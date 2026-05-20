import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallback, useEffect, useState } from "react";
import {
  gitBranches,
  gitCheckoutBranch,
  type GitBranch,
} from "./lib/api";

type Props = {
  rootPath: string;
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  isRebasing: boolean;
  isMerging: boolean;
  onRefresh: () => void;
};

export function GitBranchBar({
  rootPath,
  branch,
  remoteBranch: _remoteBranch,
  ahead,
  behind,
  isRebasing,
  isMerging,
  onRefresh,
}: Props) {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);

  useEffect(() => {
    if (branchMenuOpen) {
      gitBranches(rootPath).then(setBranches).catch(console.error);
    }
  }, [branchMenuOpen, rootPath]);

  const handleCheckout = useCallback(
    async (name: string) => {
      try {
        await gitCheckoutBranch(rootPath, name);
        onRefresh();
      } catch (e) {
        console.error("Checkout failed:", e);
      }
    },
    [rootPath, onRefresh],
  );

  const stateLabel = isRebasing
    ? "REBASING"
    : isMerging
      ? "MERGING"
      : null;

  return (
    <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border/60 px-2">
      <DropdownMenu open={branchMenuOpen} onOpenChange={setBranchMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-foreground/80 hover:bg-accent">
            {/* Git branch icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="shrink-0 opacity-70"
            >
              <path
                fillRule="evenodd"
                d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"
              />
            </svg>
            <span className="truncate max-w-[100px]">{branch ?? "HEAD"}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 min-w-48 overflow-y-auto">
          {branches
            .filter((b) => !b.is_remote)
            .map((b) => (
              <DropdownMenuItem
                key={b.name}
                onSelect={() => handleCheckout(b.name)}
                className="text-xs"
              >
                <span className="flex-1 truncate">{b.name}</span>
                {b.is_current && (
                  <span className="ml-2 text-[10px] text-muted-foreground">current</span>
                )}
              </DropdownMenuItem>
            ))}
          {branches.some((b) => b.is_remote) && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                Remote
              </div>
              {branches
                .filter((b) => b.is_remote)
                .map((b) => (
                  <DropdownMenuItem
                    key={b.name}
                    onSelect={() => handleCheckout(b.name)}
                    className="text-xs"
                  >
                    <span className="truncate">{b.name}</span>
                  </DropdownMenuItem>
                ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sync indicators */}
      {(ahead > 0 || behind > 0) && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          {ahead > 0 && <span>↑{ahead}</span>}
          {behind > 0 && <span>↓{behind}</span>}
        </span>
      )}

      {stateLabel && (
        <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
          {stateLabel}
        </span>
      )}

      <span className="flex-1" />

      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-muted-foreground hover:text-foreground"
        onClick={onRefresh}
        title="Refresh"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
          />
          <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
        </svg>
      </Button>
    </div>
  );
}
