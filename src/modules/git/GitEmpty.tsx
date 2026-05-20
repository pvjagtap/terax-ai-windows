import type { ReactNode } from "react";

type Props = {
  message: string;
  children?: ReactNode;
};

export function GitEmpty({ message, children }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      >
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
        <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
      </svg>
      <div className="text-xs text-muted-foreground">{message}</div>
      {children}
    </div>
  );
}
