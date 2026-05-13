import { readAppTokens } from "@/styles/tokens";
import type { ITheme } from "@xterm/xterm";

/**
 * xterm.js ITheme is 18 colors: bg/fg/cursor/cursorAccent/selection + ANSI 16.
 *
 * Chrome colors (background, foreground, cursor, selection) come from shadcn's
 * globals.css tokens so the terminal visually fuses with the app. ANSI 16
 * stays curated — globals.css is grayscale, it has no semantic color palette.
 */

/** Curated ANSI 16 palette, tuned for shadcn's dark surface. */
const darkAnsi = {
  black: "#18181b",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#e4e4e7",

  brightBlack: "#52525b",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#fafafa",
} as const;

/** Light-mode ANSI palette — darker, saturated tones for warm light bg.
 *  Key: white/brightWhite are flipped to dark tones (like VS Code Light+)
 *  so that shell prompts using ANSI white stay readable on a light surface. */
const lightAnsi = {
  black: "#1c1917",
  red: "#b91c1c",
  green: "#15803d",
  yellow: "#a16207",
  blue: "#1d4ed8",
  magenta: "#7c3aed",
  cyan: "#0e7490",
  white: "#57534e",

  brightBlack: "#78716c",
  brightRed: "#dc2626",
  brightGreen: "#16a34a",
  brightYellow: "#ca8a04",
  brightBlue: "#2563eb",
  brightMagenta: "#8b5cf6",
  brightCyan: "#0891b2",
  brightWhite: "#292524",
} as const;

/** Semantic palette reused by the code editor. Kept in one place so the
 *  terminal's ANSI colors and syntax highlighting stay visually coherent. */
export const syntaxPalette = {
  comment: darkAnsi.brightBlack,
  keyword: darkAnsi.blue,
  string: darkAnsi.green,
  number: darkAnsi.yellow,
  constant: darkAnsi.magenta,
  fn: darkAnsi.cyan,
  type: darkAnsi.brightCyan,
  tag: darkAnsi.red,
  punctuation: "#a1a1aa",
  invalid: darkAnsi.red,
  link: darkAnsi.blue,
} as const;

/** Light-mode syntax palette for the code editor. */
export const lightSyntaxPalette = {
  comment: lightAnsi.brightBlack,
  keyword: lightAnsi.blue,
  string: lightAnsi.green,
  number: lightAnsi.yellow,
  constant: lightAnsi.magenta,
  fn: lightAnsi.cyan,
  type: lightAnsi.cyan,
  tag: lightAnsi.red,
  punctuation: "#57534e",
  invalid: lightAnsi.red,
  link: lightAnsi.blue,
} as const;

/**
 * Builds an xterm theme at runtime from the current app tokens. Must be
 * called after the DOM is ready (after first paint); globals.css variables
 * are resolved via getComputedStyle.
 *
 * @param bgOpacity  0–1 opacity for the terminal background. Pass < 1 when
 *                   a background image is active so the image shows through.
 */
export function buildTerminalTheme(bgOpacity = 1): ITheme {
  const t = readAppTokens();
  const isDark = document.documentElement.classList.contains("dark");
  const ansi = isDark ? darkAnsi : lightAnsi;

  let background = t.background;
  if (bgOpacity < 1) {
    // Convert resolved rgb(...) to rgba with requested opacity
    const m = background.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      background = `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${bgOpacity})`;
    }
  }

  return {
    background,
    foreground: t.foreground,
    cursor: t.foreground,
    cursorAccent: t.background,
    selectionBackground: isDark ? "rgba(250, 204, 21, 0.30)" : "rgba(202, 138, 4, 0.25)",
    selectionForeground: undefined,
    ...ansi,
  };
}
