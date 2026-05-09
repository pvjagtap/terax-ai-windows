import { platform } from "@tauri-apps/plugin-os";

const PLATFORM = (() => {
  try {
    return platform();
  } catch {
    return "";
  }
})();

export const IS_MAC = PLATFORM === "macos";
export const IS_LINUX = PLATFORM === "linux";
export const IS_WINDOWS = PLATFORM === "windows";

/** Custom window controls (min/max/close) are rendered by us only on
 * Linux — macOS keeps the native traffic lights via the overlay title bar,
 * and Windows keeps the native caption buttons via the overlay title bar. */
export const USE_CUSTOM_WINDOW_CONTROLS = IS_LINUX;
