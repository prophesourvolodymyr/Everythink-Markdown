# Interpreter — TODO

<!-- STATUS: in-progress -->

## Block Engine (Phase 3 tasks 1-10)

- [x] Vite + TypeScript project scaffolding (`interpreter/` directory)
- [x] BlockManager: flat block tree, add/remove/reorder/nest, change events
- [x] Block tree diff: `computeDiff()`, `minimalDomDiff()`, snapshot/restore
- [x] Block lifecycle: mount, update, destroy with state machine
- [x] Plugin API: `registerBlockPlugin()`, `unregisterBlockPlugin()`, registry with section-type/code-tag indexes
- [x] Fallback block: default renderer registered as plugin (eats own API)
- [ ] Drag-to-reorder: drag handle, blue drop indicator, auto-scroll, touch support
- [x] UndoManager: content + structural undo/redo, depth 100, grouping
- [x] KeyboardManager: arrows, Enter, Escape, Tab bindings
- [x] Lazy loading: dynamic import() for block renderers (Mermaid, KaTeX loaded on demand)

## Core Blocks (Phase 3 tasks 11-20)

- [x] Markdown text block: CodeMirror 6 editor, history, line numbers, syntax highlighting
- [x] Code block: language selector (100+ langs), syntax highlight, preview toggle, copy button
- [x] HTML/CSS block: sandboxed iframe with srcdoc, CSS scoping, auto-reload (200ms debounce), pop-out
- [x] Mermaid block: Mermaid.js integration, all diagram types, auto-render, zoom/pan, export SVG/PNG
- [x] LaTeX block: KaTeX, inline $...$ and display $$...$$, auto-render, error display
- [x] Image block: markdown img + link extraction, resize (corner drag), drag-drop insert, clipboard paste
- [x] Table block: sortable columns, editable cells (dbl-click), add row/col, CSV export
- [x] Diff block: unified diff rendering, added/removed/hunk coloring, stats counter
- [x] Task checklist block: checkbox toggle, progress bar, filter (all/pending/done), clear completed
- [ ] Media block: native video/audio players, YouTube/Vimeo embed
- [ ] Gantt block: timeline with draggable bars (Mermaid gantt tag covers this)

## Workspace (Phase 3 tasks 21-28)

- [x] Tab system: color-coded tabs, close (Cmd+W), dirty indicator, slide animation (basic)
- [ ] Breadcrumb: clickable segments, right-click copy, aliases
- [x] File explorer: tree view, file open on click (basic)
- [ ] Split view: Cmd+\, resizable divider, independent scroll
- [ ] Workspace banner: upload image or hex color
- [ ] Settings panel: editor, theme, AI, highlight menu, workspace, shortcuts
- [x] Storage adapter: TauriStorage, BrowserStorage (OPFS), MemoryStorage
- [x] Development: `npm run dev` with Vite HMR, `npm run build`, `npm test`

## Tests

- [x] BlockManager: mount, add, remove, move tests
- [x] Diff engine: add/remove/move detection
- [x] UndoManager: undo/redo/reversal/truncation
- [x] Plugin API: register, retrieve, resolve, fallback
- [x] MemoryStorage: read, write, list, exists, rename
- [ ] BlockManager: keyboard navigation integration tests
- [ ] BlockManager: undo/redo integration tests
- [ ] BlockManager: diff + apply cycle test
