import { Fragment } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { SearchAddon } from "@xterm/addon-search";
import { TerminalPane, type TerminalPaneHandle } from "./TerminalPane";
import type { PaneNode } from "./lib/panes";

export type TerminalContextAction =
  | "copy"
  | "paste"
  | "selectAll"
  | "clear"
  | "splitRight"
  | "splitDown"
  | "closePane";

type LeafBundle = {
  setRef: (h: TerminalPaneHandle | null) => void;
  onSearch: (addon: SearchAddon) => void;
  onCwd: (cwd: string) => void;
  onExit: (code: number) => void;
};

type Props = {
  node: PaneNode;
  tabVisible: boolean;
  activeLeafId: number;
  onFocusLeaf: (leafId: number) => void;
  getBundle: (leafId: number) => LeafBundle;
  onContextAction?: (leafId: number, action: TerminalContextAction) => void;
};

export function PaneTreeView({
  node,
  tabVisible,
  activeLeafId,
  onFocusLeaf,
  getBundle,
  onContextAction,
}: Props) {
  if (node.kind === "leaf") {
    const focused = node.id === activeLeafId;
    const b = getBundle(node.id);
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onMouseDownCapture={() => {
              if (!focused) onFocusLeaf(node.id);
            }}
            onFocus={() => {
              if (!focused) onFocusLeaf(node.id);
            }}
            data-pane-leaf={node.id}
            className="relative h-full w-full"
          >
            <TerminalPane
              leafId={node.id}
              visible={tabVisible}
              focused={focused}
              initialCwd={node.cwd}
              ref={b.setRef}
              onSearchReady={(_id, addon) => b.onSearch(addon)}
              onCwd={(_id, cwd) => b.onCwd(cwd)}
              onExit={(_id, code) => b.onExit(code)}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "copy")}>
            Copy
            <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "paste")}>
            Paste
            <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "selectAll")}>
            Select All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "clear")}>
            Clear Terminal
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "splitRight")}>
            Split Right
            <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "splitDown")}>
            Split Down
            <ContextMenuShortcut>Ctrl+Shift+D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onContextAction?.(node.id, "closePane")} variant="destructive">
            Close Pane
            <ContextMenuShortcut>Ctrl+W</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <ResizablePanelGroup
      orientation={node.dir === "row" ? "horizontal" : "vertical"}
    >
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && <ResizableHandle />}
          <ResizablePanel id={`pane-${child.id}`} minSize="10%">
            <PaneTreeView
              node={child}
              tabVisible={tabVisible}
              activeLeafId={activeLeafId}
              onFocusLeaf={onFocusLeaf}
              getBundle={getBundle}
              onContextAction={onContextAction}
            />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}
