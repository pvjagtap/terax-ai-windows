---
applyTo: '**'
---

# Coding Preferences
- Use Tailwind CSS with oklch color tokens
- Follow existing shadcn component patterns
- Keep light/dark themes cohesive (same hue families, no rainbow)
- Use pnpm as the package manager

# Project Architecture
- Tauri 2 desktop app (Rust backend + React/Vite frontend)
- Version is tracked in 3 places: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
- Windows build uses NSIS installer; targets set in tauri.conf.json bundle.targets
- Theme tokens live in src/styles/globals.css (:root for light, .dark for dark)
- Terminal theme built dynamically from CSS tokens via src/styles/terminalTheme.ts

# On-Completion Process
After finishing any task:
1. **Increment version** (major.minor.bugfix) in ALL 3 files:
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
2. **Build for Windows**:
   ```
   pnpm tauri build --target x86_64-pc-windows-msvc
   ```
   This produces the .exe installer in `src-tauri/target/release/bundle/nsis/`

# Solutions Repository
- Light theme muted-foreground was too faint at oklch(0.48) — fixed to oklch(0.395) for ~5.5:1 contrast ratio
- Avoid /70 opacity on muted-foreground in light mode — it's already a secondary color
- Borders at oklch(0.845) were invisible on light bg — use oklch(0.795)
