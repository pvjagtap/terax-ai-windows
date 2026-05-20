import { useCallback, useMemo, useState } from "react";
import { gitGitignoreAdd } from "./lib/api";

type Props = {
  files: string[]; // file paths to potentially ignore
  rootPath: string;
  onClose: () => void;
  onDone: () => void; // refresh after adding
};

type IgnoreMode = "file" | "extension" | "directory";

export function GitIgnoreDialog({ files, rootPath, onClose, onDone }: Props) {
  const [mode, setMode] = useState<IgnoreMode>("file");
  const [customPattern, setCustomPattern] = useState("");
  const [loading, setLoading] = useState(false);

  // Derive possible patterns
  const extensions = useMemo(() => {
    const exts = new Set<string>();
    for (const f of files) {
      const dot = f.lastIndexOf(".");
      if (dot > 0 && dot < f.length - 1) {
        exts.add("*" + f.slice(dot));
      }
    }
    return Array.from(exts).sort();
  }, [files]);

  const directories = useMemo(() => {
    const dirs = new Set<string>();
    for (const f of files) {
      const slash = f.lastIndexOf("/");
      if (slash > 0) {
        dirs.add(f.slice(0, slash) + "/");
      }
    }
    return Array.from(dirs).sort();
  }, [files]);

  const patterns = useMemo(() => {
    switch (mode) {
      case "file":
        return files;
      case "extension":
        return extensions;
      case "directory":
        return directories;
    }
  }, [mode, files, extensions, directories]);

  const [selected, setSelected] = useState<Set<string>>(new Set(files));

  // Reset selection when mode changes
  const handleModeChange = useCallback(
    (newMode: IgnoreMode) => {
      setMode(newMode);
      if (newMode === "file") setSelected(new Set(files));
      else if (newMode === "extension") setSelected(new Set(extensions));
      else setSelected(new Set(directories));
    },
    [files, extensions, directories],
  );

  const handleToggle = useCallback((pattern: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pattern)) next.delete(pattern);
      else next.add(pattern);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const toAdd =
      customPattern.trim()
        ? [customPattern.trim()]
        : Array.from(selected);
    if (toAdd.length === 0) return;

    setLoading(true);
    try {
      await gitGitignoreAdd(rootPath, toAdd);
      onDone();
    } catch (e) {
      console.error("Failed to add to .gitignore:", e);
    } finally {
      setLoading(false);
      onClose();
    }
  }, [customPattern, selected, rootPath, onDone, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[340px] rounded-md border border-border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold text-foreground">Add to .gitignore</h3>

        {/* Mode tabs */}
        <div className="mb-3 flex gap-1 rounded bg-accent/40 p-0.5">
          {(
            [
              ["file", "Files"],
              ["extension", "Extensions"],
              ["directory", "Directories"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleModeChange(key)}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                mode === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pattern list */}
        <div className="mb-3 max-h-[200px] overflow-y-auto rounded border border-border/50 bg-accent/20 p-1.5">
          {patterns.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-muted-foreground">
              No {mode === "extension" ? "extensions" : "directories"} found
            </div>
          ) : (
            patterns.map((pattern) => (
              <label
                key={pattern}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-[11px] hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(pattern)}
                  onChange={() => handleToggle(pattern)}
                  className="h-3 w-3 accent-primary"
                />
                <span className="truncate font-mono text-foreground/90">{pattern}</span>
              </label>
            ))
          )}
        </div>

        {/* Custom pattern input */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Or enter custom pattern
          </label>
          <input
            type="text"
            value={customPattern}
            onChange={(e) => setCustomPattern(e.target.value)}
            placeholder="e.g. *.log, build/, secret.txt"
            className="w-full rounded border border-border bg-accent/30 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (selected.size === 0 && !customPattern.trim())}
            className="rounded bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add to .gitignore"}
          </button>
        </div>
      </div>
    </div>
  );
}
