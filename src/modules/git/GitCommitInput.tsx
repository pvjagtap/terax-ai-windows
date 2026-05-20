import { useCallback, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  disabled: boolean;
  loading: boolean;
};

export function GitCommitInput({ value, onChange, onCommit, disabled, loading }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!disabled) onCommit();
      }
    },
    [disabled, onCommit],
  );

  return (
    <div className="shrink-0 border-b border-border/60 p-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message"
          rows={2}
          className="w-full resize-none rounded border border-border/80 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
        />
      </div>
      <button
        onClick={onCommit}
        disabled={disabled}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-50 hover:opacity-90"
      >
        {loading ? (
          <svg className="size-3 animate-spin" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 0 0-8 8h1.5A6.5 6.5 0 0 1 8 1.5V0z" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"
            />
          </svg>
        )}
        Commit
      </button>
    </div>
  );
}
