import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { FileExplorer } from "@/modules/explorer";
import { GitPanel } from "@/modules/git";

export type SidebarTab = "explorer" | "git";

type Props = {
  rootPath: string | null;
  onOpenFile: (path: string, pin?: boolean) => void;
  onPathRenamed?: (from: string, to: string) => void;
  onPathDeleted?: (path: string) => void;
  onRevealInTerminal?: (path: string) => void;
};

export function SidebarPanel({
  rootPath,
  onOpenFile,
  onPathRenamed,
  onPathDeleted,
  onRevealInTerminal,
}: Props) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("explorer");

  return (
    <div className="flex h-full flex-col">
      {/* Tab switcher */}
      <div className="flex h-8 shrink-0 items-center border-b border-border/60">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("explorer")}
              className={cn(
                "flex h-full flex-1 items-center justify-center gap-1 border-b-2 text-[11px] font-medium transition-colors",
                activeTab === "explorer"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/70",
              )}
            >
              {/* Folder icon */}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
              </svg>
              <span className="hidden min-[200px]:inline">Explorer</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            File Explorer
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("git")}
              className={cn(
                "flex h-full flex-1 items-center justify-center gap-1 border-b-2 text-[11px] font-medium transition-colors",
                activeTab === "git"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/70",
              )}
            >
              {/* Git branch icon */}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path
                  fillRule="evenodd"
                  d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"
                />
              </svg>
              <span className="hidden min-[200px]:inline">Git</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Source Control
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Panel content */}
      <div className="min-h-0 flex-1">
        {activeTab === "explorer" ? (
          <FileExplorer
            rootPath={rootPath}
            onOpenFile={onOpenFile}
            onPathRenamed={onPathRenamed}
            onPathDeleted={onPathDeleted}
            onRevealInTerminal={onRevealInTerminal}
          />
        ) : (
          <GitPanel rootPath={rootPath} />
        )}
      </div>
    </div>
  );
}
