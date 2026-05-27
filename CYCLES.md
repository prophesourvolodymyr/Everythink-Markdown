# CYCLES.md

<!-- STATUS: Phase 1 — Foundation — COMPLETE --><!-- STATUS: Phase 2 — Tooling — COMPLETE --><!-- STATUS: Phase 3 — Interpreter Core — COMPLETE -->
<!-- LAST_UPDATED: 2026-04-30 -->

## Status Key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Phase 1 — Foundation  [x] Done
> Goal: EMD parser, validator, WASM — usable from TypeScript
**Features:** F1-Fa (Parser), F1-Fb (Validator), F1-Fc (WasmTarget)

| # | Task | Status |
|---|------|--------|
| 1 | `emd` crate scaffolding (Cargo.toml, src/lib.rs, modules) | [x] |
| 2 | Lexer: logos-based tokenizer (SectionHeader, LinkArrow, CodeFence, Text) | [x] |
| 3 | Parser: extend pulldown-cmark, produce EmdDocument AST | [x] |
| 4 | All 17 section types supported | [x] |
| 5 | All 6 status modifiers supported | [x] |
| 6 | All 20+ link relation types supported | [x] |
| 7 | All 17 code block tags supported | [x] |
| 8 | Wiki-link + transclusion parsing | [x] |
| 9 | Metadata comment parsing | [x] |
| 10 | Error recovery: never return null AST | [x] |
| 11 | Under 5ms for 500-section file | [x] |
| 12 | Round-trip test: parse → serialize → parse identical | [x] |
| 13 | Validator: cross-file link resolution | [x] |
| 14 | Validator: status consistency checks | [x] |
| 15 | Validator: section context validation | [x] |
| 16 | Validator: graph validation | [x] |
| 17 | wasm-pack build for browser target | [x] |
| 18 | npm package `@everthink/emd` published | [x] |
| 19 | WASM init + parse works in Chrome/Firefox/Safari | [x] |

**Checkpoint:** `npm install @everthink/emd` → `parse("## [task|done] Hello")` returns valid AST ✅

---

## Phase 2 — Tooling  [x] Done
> Goal: CLI, LSP, context loader, agent runtime
**Features:** F1-Fd (CliToolchain), F1-Fe (ContextLoader), F1-Ff (LspServer), F1-Fg (GraphExecutor)

| # | Task | Status |
|---|------|--------|
| 1 | ContextLoader: EmdIndex from walkdir traversal | [x] |
| 2 | ContextLoader: load_summaries(), load_by_type(), load_by_status() | [x] |
| 3 | ContextLoader: load_for_task(), resolve_context() | [x] |
| 4 | ContextLoader: token budget enforcement (tiktoken-rs) | [x] |
| 5 | ContextLoader: caching with file-change invalidation | [x] |
| 6 | CLI: `emd check ./project` — validate, exit non-zero on errors | [x] |
| 7 | CLI: `emd check --strict` — warnings become errors | [x] |
| 8 | CLI: `emd fmt file.emd` — idempotent formatting | [x] |
| 9 | CLI: `emd query "tasks|pending"` — JSON output | [x] |
| 10 | CLI: `emd graph ./project` — DOT + JSON export | [x] |
| 11 | CLI: `emd export file.emd --html --json --md` | [x] |
| 12 | CLI: `emd new project` — scaffold with template | [x] |
| 13 | CLI: `emd lsp` — start LSP server | [x] |
| 14 | LSP: diagnostics on open + debounced change | [x] |
| 15 | LSP: hover (section type, status, link info) | [x] |
| 16 | LSP: go-to-def (follow links + wiki-links) | [x] |
| 17 | LSP: completion (section types, link relations, statuses, tags) | [x] |
| 18 | LSP: format on save | [x] |
| 19 | LSP: code actions (fix broken link, add status) | [x] |
| 20 | VS Code extension published | [~] |
| 21 | emd-graph crate: AgentConfig + GraphTopology from AST | [x] |
| 22 | emd-graph: ReActAgent + ToolAgent implementations | [x] |
| 23 | emd-graph: graph executor (sequential, edge conditions, END) | [x] |
| 24 | emd-graph: result write-back to .emd files | [x] |
| 25 | emd-graph: safety (max-iterations, timeout, confirmation) | [x] |
| 26 | `emd` binary published on GitHub Releases (macOS/Linux/Windows) | [~] |
| 27 | `emd` crate published on crates.io v0.1.0 | [~] |

**Checkpoint:** `emd check ./project` works in CI. Editor has EMD diagnostics. ✅

---

## Phase 3 — Interpreter Core [x] Done
> Goal: Block engine + core blocks + workspace shell — a working editor
> Started: 2026-05-05 — Completed: 2026-05-20
**Features:** F2-Fa (BlockEngine), F2-Fb (CoreBlocks), F2-Fc (Workspace)

| # | Task | Status |
|---|------|--------|
| 1 | Vite + TypeScript project scaffolding | [x] |
| 2 | BlockManager class: block tree, add/remove/reorder/nest | [x] |
| 3 | Block tree diff: AST change → minimal DOM updates | [x] |
| 4 | Block lifecycle: mount, update, destroy | [x] |
| 5 | Plugin API: registerBlockPlugin(), unregisterBlockPlugin() | [x] |
| 6 | Core blocks registered as plugins (eat own API) | [x] |
| 7 | Drag-to-reorder with visual drop indicator | [x] |
| 8 | Undo/redo stack (content + structural, depth 100) | [x] |
| 9 | Keyboard navigation: arrows, Enter, Escape, Tab | [x] |
| 10 | Lazy loading: dynamic import() for block renderers | [x] |
| 11 | Markdown text block: CodeMirror 6 with EMD language mode | [x] |
| 12 | Code block: language selector, syntax highlighting, preview toggle | [x] |
| 13 | HTML/CSS block: sandboxed iframe, auto-reload, pop-out | [x] |
| 14 | Mermaid block: auto-render, zoom, export SVG/PNG | [x] |
| 15 | LaTeX block: KaTeX, inline + display, auto-render | [x] |
| 16 | Image block: resize, drag-insert, clipboard paste + hosting endpoint | [x] |
| 17 | Table block: Handsontable, sort, filter, CSV export | [x] |
| 18 | Diff block: side-by-side, apply button | [x] |
| 19 | Task checklist block: toggle, progress bar, strikethrough | [x] |
| 20 | Media + Gantt blocks | [x] |
| 21 | Tab system: color-coded, scrollable, Cmd+W, dirty indicator | [x] |
| 22 | Breadcrumb path: clickable segments, right-click copy, aliases | [x] |
| 23 | File explorer: nested tree, expand/collapse, .gitignore, drag-reorder, Cmd+N, context menu | [x] |
| 24 | Split view: Cmd+\, resizable divider, independent scroll | [x] |
| 25 | Workspace banner: configurable image/color/text, right-click menu, localStorage | [x] |
| 26 | Settings panel: editor, theme, AI, highlight menu, workspace, shortcuts | [x] |
| 27 | Storage adapter: TauriStorage (native FS), BrowserStorage (OPFS), MemoryStorage | [x] |
| 28 | Development: `npm run dev` opens in browser, hot reload | [x] |

**Checkpoint:** Open `.emd` file → text edits, code previews, Mermaid renders, tables sort. Tabs work.

---

## Phase 4 — Interpreter Advanced
> Goal: Canvas, AI, distribution — the full product
**Features:** F2-Fd (Canvas), F2-Fe (AiIntegration), F2-Ff (Distribution)

| # | Task | Status |
|---|------|--------|
| 1 | Drawing canvas: Canvas 2D engine, all shapes, toolbar | [x] |
| 2 | Canvas: undo/redo, zoom/pan, snap grid, alignment guides | [x] |
| 3 | Canvas: Apple Pencil pressure → width, tilt → angle (Tauri) | [ ] |
| 4 | Canvas: export SVG + PNG, Excalidraw-compatible JSON | [x] |
| 5 | Flowchart editor: 4 node types, drag-nodes-edges-redraw | [ ] |
| 6 | Kanban board: auto-gen from [task] sections, drag → update file | [ ] |
| 7 | Highlight menu: 3 rows (formatting, turn-into, AI) | [ ] |
| 8 | Inline AI popup: streaming, edit-inline, replace, promote to chat | [ ] |
| 9 | AI chat panel: context-aware, @-mentions, code Apply button | [ ] |
| 10 | LLM providers: OpenAI, Anthropic, plugin API | [ ] |
| 11 | Agent runner: Run button → terminal stream, write-back | [ ] |
| 12 | Proactive AI suggestions: banners on [task|pending], [verify], [graph] | [ ] |
| 13 | Settings → AI: providers, keys, prompts, budget, suggestions | [ ] |
| 14 | Highlight menu: user-customizable via settings | [ ] |
| 15 | npm package `@everthink/interpreter`: <emd-editor>, <emd-viewer> | [ ] |
| 16 | npm: <500KB editor, <200KB viewer gzipped | [ ] |
| 17 | Tauri desktop: macOS .dmg, signed + notarized | [ ] |
| 18 | Tauri desktop: Windows .msi, Linux .AppImage + .deb | [ ] |
| 19 | Tauri auto-updater: GitHub Releases, silent download | [ ] |
| 20 | Standalone web: static HTML + WASM + service worker, offline | [ ] |
| 21 | wry crate `everthink-webview`: embed in pure Rust apps | [ ] |
| 22 | Theme system: light, dark, high-contrast, CSS variables | [ ] |
| 23 | `<emd-viewer>` read-only component, <200KB gzipped | [ ] |
| 24 | Keyboard shortcuts overlay (Cmd+K Cmd+S) | [ ] |
| 25 | `emd.dev` deployed | [ ] |

**Checkpoint:** `npm install @everthink/interpreter` → `<emd-editor />` works. Desktop app auto-updates.

---

## Phase 5 — SDKs (Multi-Platform Distribution)
> Goal: Drop-in EMD editors for React, Rust native, and Apple platforms
> Fa-LiveMd: COMPLETE (see features/F2-ReactSdk/Fa-LiveMd/)
**Features:** F2-ReactSdk, F3-RustSdk, F4-SwiftSdk

| # | Task | Status |
|---|------|--------|
| 1 | F2-ReactSdk: Fa-LiveMd — CM6 ViewPlugin + 10 decoration sub-features + integration | [x] |
| 2 | F2-ReactSdk: Fb-Components — <EmdEditor> <EmdViewer> hooks plugin API | [x] |
| 3 | F2-ReactSdk: Fc-Playground — Vite dev app + sample files + block tester | [ ] |
| 4 | F2-ReactSdk: Fd-AiPanel — chat UI + context bridge + streaming + apply | [ ] |
| 5 | F3-RustSdk: Fa-GpuiEngine — GPU text rendering + 8 decoration sub-features | [ ] |
| 6 | F3-RustSdk: Fb-Components — EmdEditor entity + EmdViewer + plugin API | [ ] |
| 7 | F3-RustSdk: Fc-Playground — cargo example binary + sample files | [ ] |
| 8 | F3-RustSdk: Fd-AiPanel — chat entity + context + streaming + apply | [ ] |
| 9 | F4-SwiftSdk: Fa-SwiftUIEngine — NSAttributedString engine + 8 sub-features | [ ] |
| 10 | F4-SwiftSdk: Fb-Components — EmdEditorView + EmdViewerView + plugin API | [ ] |
| 11 | F4-SwiftSdk: Fc-Playground — Xcode project + sample files | [ ] |
| 12 | F4-SwiftSdk: Fd-AiPanel — chat view + context + streaming + apply | [ ] |
| 13 | npm: @everthink/react-emd published | [ ] |
| 14 | crate: emd-native published on crates.io | [ ] |
| 15 | SPM: EmdKit published | [ ] |

**Checkpoint:** `npm install @everthink/react-emd` → `<EmdEditor />` works in any React app.

---

## Phase 6 — Ecosystem (V1.5+)
> Goal: Templates, sharing, history, polish
**Features:** F10-Ecosystem (planned)

| # | Task | Status |
|---|------|--------|
| 1 | Template gallery: `emd new --list`, 7 built-in templates | [ ] |
| 2 | Collaboration preview: Share → static HTML export | [ ] |
| 3 | Diff & History panel: Git-backed, auto-commit, timeline | [ ] |
| 4 | Language bindings generator: `emd generate --lang ts|py|go|rs` | [ ] |
| 5 | Vega chart block | [ ] |
| 6 | 3D model block (Three.js glTF viewer) | [ ] |
| 7 | Full agent runner dashboard (visual timeline) | [ ] |
| 8 | In-app plugin marketplace | [ ] |
| 9 | egui native renderer (no WebView) | [ ] |
| 10 | Cloud sync (GitHub) | [ ] |

---

## Dependencies

```
Phase 1 (Parser + WASM)
    ↓
Phase 2 (CLI + LSP + Graph)
    ↓
Phase 3 (Block Engine + Core Blocks + Workspace)
    ↓
Phase 4 (Canvas + AI + Distribution)
    ↓                  ↓
Phase 5 (Ecosystem)    Phase 4 blocks 1-14 can start
                       once block-engine is stable
```

- Phase 3 blocks 1-10 (block-engine) must complete before 11-27 (blocks + workspace)
- Phase 4 blocks 1-6 (canvas) and 7-13 (AI) can build in parallel
- Phase 5 can start any time (independent of Phase 4 polish)

## Parallelization

| Group | Features | Can Start |
|-------|----------|-----------|
| A | Phase 1 all tasks | Immediately |
| B | Phase 2 CLI + LSP + Graph | After Phase 1 checkpoint |
| C | Phase 3 block-engine | After Phase 1 checkpoint (WASM) |
| D | Phase 3 blocks + workspace | After Phase 3 block-engine stable |
| E | Phase 4 canvas + AI | After Phase 3 block-engine stable |
| F | Phase 4 distribution | After Phase 4 core features stable |
| G | Phase 5 ecosystem | After Phase 4 checkpoint |
