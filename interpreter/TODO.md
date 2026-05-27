# Interpreter — TODO

<!-- STATUS: in-progress -->

## Block Engine (Phase 3 tasks 1-10)

- [x] Vite + TypeScript project scaffolding (`interpreter/` directory)
- [x] BlockManager: flat block tree, add/remove/reorder/nest, change events
- [x] Block tree diff: `computeDiff()`, `minimalDomDiff()`, snapshot/restore
- [x] Block lifecycle: mount, update, destroy with state machine
- [x] Plugin API: `registerBlockPlugin()`, `unregisterBlockPlugin()`, registry with section-type/code-tag indexes
- [x] Fallback block: default renderer registered as plugin (eats own API)
- [x] Drag-to-reorder: drag handle, blue drop indicator, auto-scroll, touch support
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
- [x] Media block: native video/audio players, YouTube/Vimeo embed
- [ ] Gantt block: timeline with draggable bars (Mermaid gantt tag covers this)

## Workspace (Phase 3 tasks 21-28)

- [x] Tab system: color-coded, context menu, Cmd+Shift+[/], Cmd+1-9, dirty dot, slide animation
- [x] Breadcrumb: clickable segments, right-click copy, aliases
- [x] File explorer: nested tree with expand/collapse, folder grouping, drag-reorder, .gitignore, Cmd+N, context menu (New File, New Folder, Rename, Delete, Copy Path)
- [x] Split view: Cmd+\, resizable divider, independent scroll
- [x] Workspace banner: configurable image/color/text via right-click context menu, localStorage persistence
- [x] Settings panel: editor, theme, AI, highlight menu, workspace, shortcuts
- [x] Storage adapter: TauriStorage, BrowserStorage (OPFS), MemoryStorage
- [x] Development: `npm run dev` with Vite HMR, `npm run build`, `npm test`

## Tests

- [x] BlockManager: mount, add, remove, move tests
- [x] Diff engine: add/remove/move detection
- [x] UndoManager: undo/redo/reversal/truncation
- [x] Plugin API: register, retrieve, resolve, fallback
- [x] MemoryStorage: read, write, list, exists, rename
- [x] BlockManager: keyboard navigation integration tests
- [x] BlockManager: undo/redo integration tests
- [x] BlockManager: diff + apply cycle test

## Canvas (Phase 4 tasks 1-4)

- [x] Canvas block plugin: drawing engine with freehand, shapes, color picker, eraser, clear, resize handle
- [x] Canvas: undo/redo (stroke snapshots, cap 100), zoom (0.25x–4x, Ctrl+scroll), pan (middle-click or Space+drag)
- [x] Canvas: snap grid (toggle, 10/20/50px), alignment guides (5px threshold)
- [x] Canvas: export PNG, SVG, Excalidraw-compatible JSON
- [x] Canvas: content serialization (JSON in code block), re-render on load
- [x] CSS: toolbar, color pickers, zoom badge, status bar, grid toggle
- [x] Tests: plugin resolution for CodeBlockTag.Draw, serialization round-trip, undo/redo strokes

## Flowchart + Kanban (Phase 4 tasks 5-6)

- [ ] Flowchart editor: 4 node types (process/decision/terminator/I/O), drag/resize/create/delete, edge creation via ports, bezier curves with arrows, edge labels, undo/redo, auto-layout (Sugiyama), pan/zoom, minimap, export PNG/SVG
- [ ] Kanban board: auto-generates from [task] sections, 4 columns (Backlog/To Do/In Progress/Done), status mapping, drag-to-change-status, search filter, collapsed/expanded view, WIP limits, card count badges, add card button
- [ ] CSS: flowchart toolbar/canvas/minimap/label-inputs/status-bar, kanban board/columns/cards/search/headers
- [ ] Tests: Flowchart plugin resolution (SectionType.Graph), serialization round-trip, Kanban plugin resolution (CodeBlockTag.Kanban), status-to-column mapping
