import { CwdBreadcrumb } from "./CwdBreadcrumb";

type Props = {
  cwd: string | null;
  filePath?: string | null;
  home: string | null;
  onCd: (path: string) => void;
};

export function StatusBar({
  cwd,
  filePath,
  home,
  onCd,
}: Props) {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-border bg-card/80 px-3 text-[11px]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CwdBreadcrumb cwd={cwd} filePath={filePath} home={home} onCd={onCd} />
      </div>
    </footer>
  );
}
