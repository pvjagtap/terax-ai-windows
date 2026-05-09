export type Segment = {
  label: string;
  fullPath: string;
  isHome: boolean;
};

export function segmentsFromCwd(cwd: string, home: string | null): Segment[] {
  // Normalize to forward slashes for consistent handling.
  const normCwd = cwd.replace(/\\/g, "/");
  const normHome = home?.replace(/\\/g, "/") ?? null;

  const usingHome = normHome !== null && (normCwd === normHome || normCwd.startsWith(normHome + "/"));
  const tail = usingHome
    ? normCwd.slice(normHome.length).replace(/^\//, "")
    : normCwd.replace(/^[A-Za-z]:\//, "").replace(/^\//, "");
  const parts = tail === "" ? [] : tail.split("/").filter(Boolean);

  const segments: Segment[] = [];
  if (usingHome) {
    segments.push({ label: "~", fullPath: home!, isHome: true });
  } else {
    // On Windows, use the drive root (e.g. "C:/") as the root label.
    const driveMatch = normCwd.match(/^([A-Za-z]):\//);
    const rootLabel = driveMatch ? `${driveMatch[1]}:` : "/";
    const rootPath = driveMatch ? `${driveMatch[1]}:/` : "/";
    segments.push({ label: rootLabel, fullPath: rootPath, isHome: false });
  }

  let acc = segments[0].fullPath;
  for (const part of parts) {
    acc = acc.endsWith("/") ? `${acc}${part}` : `${acc}/${part}`;
    segments.push({ label: part, fullPath: acc, isHome: false });
  }
  return segments;
}
