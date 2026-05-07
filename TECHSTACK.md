# TECHSTACK.md — EMD & Visual Interpreter

## Languages

| Language | Role | Why |
|----------|------|-----|
| **Rust** | EMD parser, validator, ContextLoader, CLI, LSP server, graph executor (`emd` + `emd-graph` crates) | Performance (<5ms parse), single binary deploy, WASM compilation, zero runtime for consumers |
| **TypeScript** | Visual Interpreter UI (web components, block renderers, AI integration, storage adapter) | Universal web platform, frameworkless embeddability, npm distribution, CodeMirror/Mermaid/KaTeX ecosystem |

## Rust Crates

| Crate | Purpose | Key Dependencies |
|-------|---------|-----------------|
| `emd` | Parser, validator, ContextLoader, LSP | pulldown-cmark, logos, regex, serde, tower-lsp, tiktoken-rs, walkdir, thiserror, miette |
| `emd-graph` | Agent graph executor | reqwest, serde_json, tokio, emd |
| `emd-cli` | CLI binary | clap, emd, emd-graph |
| `everthink-webview` | wry wrapper for Rust embeds | wry, emd |

## TypeScript Libraries

| Library | Purpose | Bundle Impact |
|---------|---------|---------------|
| CodeMirror 6 | Markdown text editing, code blocks with syntax highlighting | Core, always loaded |
| Mermaid.js | Diagram rendering (flowchart, sequence, ER, etc.) | Lazy-loaded on `[mermaid]` |
| KaTeX | LaTeX math rendering | Lazy-loaded on `[katex]` |
| Three.js | 3D model viewer (V2) | Lazy-loaded on `[3d]` |
| Vega-Lite | Data visualization charts (V2) | Lazy-loaded on `[vega]` |
| Handsontable | Interactive spreadsheet-grade tables | Lazy-loaded on table |
| Excalidraw (patterns only) | Drawing canvas toolbar/logic reference | Built from scratch on Canvas 2D |

## Desktop Shell

| Technology | Purpose |
|------------|---------|
| **Tauri v2** | Desktop app shell (macOS/Linux/Windows), native fs, menus, auto-updater, Apple Pencil events |
| **wry** | Thin WebView for pure Rust embedding (no Node.js) |

## Build Tooling

| Tool | Purpose |
|------|---------|
| **wasm-pack** | Compile `emd` crate to WASM for web/npm |
| **Vite** | TypeScript bundler, dev server with HMR |
| **cargo** | Rust build system, crate publishing |
| **npm** | Package distribution for web components |
| **GitHub Actions** | CI: build, test, lint, publish (crates.io + npm) |

## Distribution Targets

| Target | Distribution | Build |
|--------|-------------|-------|
| npm | `@everthink/interpreter` | Vite → bundle web components + WASM |
| Tauri desktop | macOS `.dmg`, Windows `.msi`, Linux `.AppImage` | `cargo tauri build` |
| Standalone web | `emd.dev` (static HTML + WASM + SW) | Vite → static build |
| Rust embed | `everthink-webview` crate (crates.io) | `cargo publish` |
| CLI | `emd` binary (crates.io, GitHub Releases) | `cargo build --release` |

## Storage

| Environment | Backend | Technology |
|-------------|---------|------------|
| Tauri desktop | Native filesystem | Tauri FS IPC → `std::fs` |
| wry Rust embed | Native filesystem | `std::fs` injected into WebView |
| Browser/npm | Origin Private File System | OPFS API |
| Standalone HTML | In-memory | JavaScript Map (reset on refresh) |

## Conventions

- **Rust**: `rustfmt` + `clippy -- -D warnings`, modules follow crate conventions
- **TypeScript**: `prettier` + `eslint`, strict mode, no framework (plain CustomElement web components)
- **File naming**: kebab-case for files, PascalCase for web components, snake_case for Rust
- **Error handling**: `thiserror` + `miette` in Rust, typed error boundaries in TypeScript
- **Testing**: `cargo test` for Rust, Vitest for TypeScript, Playwright for E2E
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)

## Performance Targets

- EMD parser: <5ms for 500-section file
- Block engine: 60fps with 1000 blocks
- Canvas: 60fps with 500 FreeHand strokes
- Tauri app startup: <300ms cold, <100ms warm
- Bundle size: editor <500KB gzipped, viewer <200KB gzipped

## Security

- API keys stored in OS keychain (never in `.emd` files or git)
- HTML preview in sandboxed `<iframe>` with `sandbox="allow-scripts"` (no same-origin, no top navigation)
- Plugin permissions: read-file, write-file, network, LLM-call — declared per-plugin, user-approved
- No telemetry, no analytics, no external CDN in V1 (all assets bundled)
