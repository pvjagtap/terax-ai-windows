import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { gitLog, type GitLogEntry } from "./lib/api";

type Props = {
  rootPath: string;
};

export function GitLogView({ rootPath }: Props) {
  const [entries, setEntries] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    gitLog(rootPath, 50)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rootPath]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
        No commits yet
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="py-1">
        {entries.map((entry) => (
          <div
            key={entry.hash}
            className="group flex flex-col gap-0 px-2 py-1.5 hover:bg-accent/40"
          >
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 rounded bg-accent px-1 py-0 text-[10px] font-mono text-muted-foreground">
                {entry.short_hash}
              </span>
              <span className="flex-1 truncate text-[11px] text-foreground/90">
                {entry.message}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-[42px] text-[10px] text-muted-foreground/70">
              <span className="truncate">{entry.author}</span>
              <span>·</span>
              <span className="shrink-0">{formatRelativeDate(entry.date)}</span>
              {entry.refs.length > 0 && (
                <span className="flex gap-0.5">
                  {entry.refs.map((r) => (
                    <span
                      key={r}
                      className="rounded bg-primary/15 px-1 text-[9px] font-medium text-primary"
                    >
                      {r}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatRelativeDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return isoDate;
  }
}
