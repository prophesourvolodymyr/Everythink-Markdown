# Feature: Rust Interpreter — Distribution & Ecosystem

<!-- STATUS: designed -->
<!-- DEPENDS_ON: all rust-interpreter features -->
<!-- PARENT: rust-interpreter -->

## What This Is

Four distribution channels for the Visual Interpreter: npm package (`@everthink/interpreter`), Tauri desktop app (macOS/Linux/Windows with auto-update), standalone web (`emd.dev` with offline support), and the `everthink-webview` Rust crate for embedding in pure Rust apps. Plus ecosystem features: `<emd-viewer>` read-only component, theme system (light/dark/high-contrast), template gallery, collaboration preview, diff/history view, and language bindings generator.

## Distribution Channels

### npm: `@everthink/interpreter`
Exports `<emd-editor>` and `<emd-viewer>` web components, `emd` WASM parser, and plugin registration functions (`defineBlockPlugin`, `defineLLMProvider`). Bundle targets: editor <500KB gzipped, viewer <200KB gzipped. Works in React/Next.js/Vue/Svelte or plain HTML via `<script>` tag. TypeScript types included.

### Tauri Desktop
Platform installers: macOS `.dmg` (signed + notarized), Windows `.msi` (code signed), Linux `.AppImage` + `.deb`. Auto-updater checks GitHub Releases, downloads silently, installs on restart. Native features: file dialogs, app menu (File/Edit/View/Window/Help), Apple Pencil events, system tray, global shortcuts, fullscreen/split screen. App identity: "emd" (lowercase), EMD logo icon.

### Standalone Web: `emd.dev`
Static HTML + WASM + service worker. Offline: all assets cached after first visit. OPFS storage with upload/download bridge. URL routing: `emd.dev/{username}/{project}` loads workspace from OPFS. Deployable to any static host (Netlify, Vercel, GitHub Pages). Limitations: no native file dialogs, no Apple Pencil pressure, OPFS storage limits.

### wry Crate: `everthink-webview`
Thin Rust crate wrapping `wry` WebView. Bundles web assets. API: `EmdWindow::open("file.emd")`. Overhead: ~1MB. Published to crates.io. For pure Rust apps that want EMD editing without Tauri's Node.js layer.

## Ecosystem Features

### `<emd-viewer>` Read-Only
Stripped-down version: no edit, no AI, no agent runner. Renders `.emd` files as interactive blocks (read-only). `<iframe>` embeddable with sandbox. Inherits CSS variables from parent page for seamless integration. Use cases: documentation sites, blog posts, project READMEs, live preview links.

### Theme System
V1 built-in: Light, Dark, High contrast. CSS variable API (40+ variables controlling background, text, accent, block hover/selection, code background, borders, badges). Theme switching: instant CSS variable swap, no reload. System theme detection (`prefers-color-scheme`). Plugin themes via block plugin API.

### Template Gallery (V1.5)
`emd new --template` CLI. In-app gallery: browse, preview, install. Community submissions via GitHub. Templates: `project-starter`, `autonomous-builder`, `daily-standup`, `architecture-review`, `bug-report`, `api-docs`, `kanban-project`.

### Collaboration Preview (V1.5)
Share button → static HTML export via `emd export --static ./project`. Self-hosted: deploy static version, files read-only. No server needed.

### Diff & History View (V1.5)
Git-backed history panel. Auto-commit on parse errors + manual save. Timeline with author (human/agent), changed sections. Side-by-side diff on click.

### Language Bindings Generator (V2)
`emd generate --lang typescript|python|go|rust` reads `[api]` sections → type-safe clients.

## Integration
All features (F1-F6) bundled and distributed through this layer. `emd` crate published to crates.io, WASM bundled in npm. Storage adapter enables multi-target distribution.

## Known Limitations
- wry: Windows requires WebView2 runtime (bundled Win 11, separate install Win 10)
- Standalone: OPFS limits, no Apple Pencil
- Tauri macOS: code signing requires Apple Developer account
- Templates: community submissions via GitHub PRs

## V2
- In-app plugin marketplace
- Cloud sync (GitHub)
- Collaborative editing (CRDT)
- Mobile (iOS/Android via Tauri mobile or Capacitor)
