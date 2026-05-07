# Distribution & Ecosystem — TODO

## npm Package
- [ ] Bundle web components + WASM parser
- [ ] Export: emd-editor, emd-viewer, emd WASM, defineBlockPlugin, defineLLMProvider
- [ ] TypeScript types
- [ ] Publish to npm
- [ ] Bundle: editor <500KB, viewer <200KB gzipped

## Tauri Desktop
- [ ] Tauri v2 shell with WebView
- [ ] macOS .dmg, Windows .msi, Linux .AppImage + .deb
- [ ] Auto-updater: GitHub Releases, silent download
- [ ] Native file dialogs, app menu, Apple Pencil, global shortcuts
- [ ] Signed + notarized (macOS), code signed (Windows)
- [ ] App icon + identity

## Standalone Web
- [ ] Static HTML + WASM + service worker
- [ ] Offline: all assets cached
- [ ] OPFS storage with upload/download bridge
- [ ] Deployable to static hosts

## wry Crate
- [ ] Thin Rust crate wrapping wry
- [ ] Bundle web assets
- [ ] Publish to crates.io
- [ ] Overhead ~1MB

## Viewer
- [ ] Read-only: no edit, no AI, no agent runner
- [ ] <200KB gzipped
- [ ] iframe embeddable
- [ ] Inherits CSS variables

## Theme System
- [ ] Light, Dark, High contrast
- [ ] CSS variable API (40+ vars)
- [ ] Instant switch, no reload
- [ ] prefers-color-scheme

## Templates (V1.5)
- [ ] emd new --template CLI
- [ ] In-app gallery
- [ ] GitHub community submissions
- [ ] 7 pre-built templates

## Preview (V1.5)
- [ ] Share button → static HTML
- [ ] emd export --static ./project

## History (V1.5)
- [ ] Git-backed history panel
- [ ] Auto-commit on parse errors + save
- [ ] Timeline with diff on click

## Bindings Generator (V2)
- [ ] emd generate --lang typescript|python|go|rust
