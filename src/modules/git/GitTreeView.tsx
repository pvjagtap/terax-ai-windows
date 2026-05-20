import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitStatusEntry } from "./lib/api";
import { GitFileItem } from "./GitFileItem";

// Collapse folders by default when entry count exceeds this
const LARGE_TREE_THRESHOLD = 200;

type TreeNode = {
  name: string;
  path: string; // full relative path of the folder
  children: TreeNode[];
  files: GitStatusEntry[];
};

type Props = {
  entries: GitStatusEntry[];
  section: "staged" | "unstaged";
  onAction: (path: string) => void;
  onDiscard?: (path: string) => void;
  onGitignore?: (path: string) => void;
  rootPath: string;
  expandSignal: number; // positive = expand all, negative = collapse all
  selectedFiles?: Set<string>;
  onSelect?: (path: string, checked: boolean) => void;
};

function buildTree(entries: GitStatusEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [], files: [] };

  for (const entry of entries) {
    const parts = entry.path.split("/");
    let node = root;

    // Navigate/create folder nodes for all but the last part (filename)
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === folderName);
      if (!child) {
        child = { name: folderName, path: folderPath, children: [], files: [] };
        node.children.push(child);
      }
      node = child;
    }

    node.files.push(entry);
  }

  // Sort: folders first (alphabetical), then files (alphabetical)
  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => {
      const aName = a.path.split("/").pop() ?? "";
      const bName = b.path.split("/").pop() ?? "";
      return aName.localeCompare(bName);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

export function GitTreeView({
  entries,
  section,
  onAction,
  onDiscard,
  onGitignore,
  rootPath,
  expandSignal,
  selectedFiles,
  onSelect,
}: Props) {
  const tree = useMemo(() => buildTree(entries), [entries]);
  const isLargeTree = entries.length > LARGE_TREE_THRESHOLD;

  return (
    <div>
      {tree.children.map((child) => (
        <TreeFolder
          key={child.path}
          node={child}
          depth={0}
          section={section}
          onAction={onAction}
          onDiscard={onDiscard}
          onGitignore={onGitignore}
          rootPath={rootPath}
          expandSignal={expandSignal}
          selectedFiles={selectedFiles}
          onSelect={onSelect}
          defaultCollapsed={isLargeTree}
        />
      ))}
      {tree.files.map((entry) => (
        <GitFileItem
          key={`${section}-${entry.path}`}
          entry={entry}
          section={section}
          onAction={() => onAction(entry.path)}
          onDiscard={onDiscard ? () => onDiscard(entry.path) : undefined}
          onGitignore={onGitignore}
          rootPath={rootPath}
          selected={selectedFiles?.has(entry.path)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

type TreeFolderProps = {
  node: TreeNode;
  depth: number;
  section: "staged" | "unstaged";
  onAction: (path: string) => void;
  onDiscard?: (path: string) => void;
  onGitignore?: (path: string) => void;
  rootPath: string;
  expandSignal: number;
  selectedFiles?: Set<string>;
  onSelect?: (path: string, checked: boolean) => void;
  defaultCollapsed?: boolean;
};

function TreeFolder({
  node,
  depth,
  section,
  onAction,
  onDiscard,
  onGitignore,
  rootPath,
  expandSignal,
  selectedFiles,
  onSelect,
  defaultCollapsed,
}: TreeFolderProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const prevSignalRef = useRef(expandSignal);

  // React to global expand/collapse signals
  useEffect(() => {
    if (expandSignal !== prevSignalRef.current) {
      if (expandSignal > prevSignalRef.current) {
        setExpanded(true);
      } else {
        setExpanded(false);
      }
      prevSignalRef.current = expandSignal;
    }
  }, [expandSignal]);

  const totalFiles =
    node.files.length + node.children.reduce((sum, c) => sum + countFiles(c), 0);

  // Collect all file paths under this folder for selection
  const folderFilePaths = useMemo(() => collectFilePaths(node), [node]);
  const selectedCount = selectedFiles
    ? folderFilePaths.filter((p) => selectedFiles.has(p)).length
    : 0;
  const allSelected = selectedCount === folderFilePaths.length && folderFilePaths.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < folderFilePaths.length;

  const handleFolderCheckbox = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onSelect) return;
      if (allSelected) {
        // Deselect all
        for (const p of folderFilePaths) {
          onSelect(p, false);
        }
      } else {
        // Select all
        for (const p of folderFilePaths) {
          onSelect(p, true);
        }
      }
    },
    [onSelect, allSelected, folderFilePaths],
  );

  return (
    <div>
      <div
        className="group flex h-6 w-full items-center gap-1 px-2 text-[12px] hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Folder checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onClick={handleFolderCheckbox}
            onChange={() => {}}
            className="h-3 w-3 shrink-0 cursor-pointer accent-primary"
            title={`Select all ${folderFilePaths.length} files in ${node.name}`}
          />
        )}

        {/* Chevron + folder row (clickable for expand/collapse) */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-1"
        >
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={cn(
            "shrink-0 transition-transform",
            expanded ? "rotate-90" : "rotate-0",
          )}
        >
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" />
        </svg>

        {/* Folder icon */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="shrink-0 text-muted-foreground"
        >
          {expanded ? (
            <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3H13.5a2 2 0 0 1 1.983 1.738l-3.155.02A2.5 2.5 0 0 0 9.874 6.2L.54 3.87zm12.01 1.613a.5.5 0 0 0-.588-.404l-9.636 1.699a.5.5 0 0 0-.404.588l.96 5.444A2 2 0 0 0 4.842 14h6.316a2 2 0 0 0 1.97-1.658l.96-5.444a.5.5 0 0 0-.538-.592z" />
          ) : (
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
          )}
        </svg>

        {/* Folder name */}
        <span className="flex-1 truncate text-left text-foreground/90">
          {node.name}
        </span>

        {/* File count badge */}
        <span className="text-[10px] text-muted-foreground/60">{totalFiles}</span>
        </button>
      </div>

      {expanded && (
        <div>
          {node.children.map((child) => (
            <TreeFolder
              key={child.path}
              node={child}
              depth={depth + 1}
              section={section}
              onAction={onAction}
              onDiscard={onDiscard}
              onGitignore={onGitignore}
              rootPath={rootPath}
              expandSignal={expandSignal}
              selectedFiles={selectedFiles}
              onSelect={onSelect}
              defaultCollapsed={defaultCollapsed}
            />
          ))}
          {node.files.map((entry) => (
            <div key={`${section}-${entry.path}`} style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
              <GitFileItem
                entry={entry}
                section={section}
                onAction={() => onAction(entry.path)}
                onDiscard={onDiscard ? () => onDiscard(entry.path) : undefined}
                onGitignore={onGitignore}
                rootPath={rootPath}
                showFilenameOnly
                selected={selectedFiles?.has(entry.path)}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function countFiles(node: TreeNode): number {
  return node.files.length + node.children.reduce((sum, c) => sum + countFiles(c), 0);
}

function collectFilePaths(node: TreeNode): string[] {
  const paths: string[] = node.files.map((f) => f.path);
  for (const child of node.children) {
    paths.push(...collectFilePaths(child));
  }
  return paths;
}
