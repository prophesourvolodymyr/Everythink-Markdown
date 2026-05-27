# DIAGRAM.md — EMD Architecture Visual Breakdown

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      EMD (Everything MarkDown)                                ║
║            A typed, semantic superset of Markdown with a full ecosystem       ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 1. THE BIG PICTURE — Two Halves, One System

```
                                USER
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
               .emd file     CLI cmds     Editor UI
                    │            │            │
    ╔═══════════════╪════════════╪════════════╪═══════════════╗
    ║               ▼            ▼            ▼               ║
    ║  ┌──────────────────────────────────────────────┐      ║
    ║  │          🦀  F1-EmdCore  (RUST)              │      ║
    ║  │                                              │      ║
    ║  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  │      ║
    ║  │  │  PARSER  │  │ VALIDATOR │  │   WASM   │  │      ║
    ║  │  │ logos +  │──│ link-res  │──│ wasm-    │  │      ║
    ║  │  │ pulldown │  │ status    │  │ pack →   │  │      ║
    ║  │  │ -cmark   │  │ graph     │  │  npm pkg │  │      ║
    ║  │  └──────────┘  └───────────┘  └────┬─────┘  │      ║
    ║  │                                     │        │      ║
    ║  │  ┌──────────┐  ┌───────────┐       │        │      ║
    ║  │  │   CLI    │  │    LSP    │       │        │      ║
    ║  │  │ check    │  │ diag,     │       │        │      ║
    ║  │  │ fmt,query│  │ hover,    │       │        │      ║
    ║  │  │ export   │  │ complete  │       │        │      ║
    ║  │  └──────────┘  └───────────┘       │        │      ║
    ║  │                                     │        │      ║
    ║  │  ┌──────────┐  ┌───────────┐       │        │      ║
    ║  │  │ CONTEXT  │  │  GRAPH    │       │        │      ║
    ║  │  │ LOADER   │  │ EXECUTOR  │       │        │      ║
    ║  │  │ tiktoken │  │ ReAct +   │       │        │      ║
    ║  │  │ budget   │  │ ToolAgent │       │        │      ║
    ║  │  └──────────┘  └───────────┘       │        │      ║
    ║  │                                     │        │      ║
    ║  └─────────────────────────────────────┼────────┘      ║
    ║                                        │ npm           ║
    ║                           @everthink/emd              ║
    ║                                        │               ║
    ╚════════════════════════════════════════╪═══════════════╝
                                             │
    ╔════════════════════════════════════════╪═══════════════╗
    ║                                        ▼               ║
    ║  ┌──────────────────────────────────────────────┐      ║
    ║  │        🟦  F2-Interpreter  (TYPESCRIPT)      │      ║
    ║  │                                              │      ║
    ║  │  ┌───────────────┐  ┌──────────────────┐    │      ║
    ║  │  │ BLOCK ENGINE  │  │  CORE BLOCKS (11) │    │      ║
    ║  │  │               │  │                    │    │      ║
    ║  │  │ BlockManager  │  │ markdown   mermaid │    │      ║
    ║  │  │ Diff Engine   │  │ code       katex   │    │      ║
    ║  │  │ UndoManager   │  │ html       image   │    │      ║
    ║  │  │ Plugin API    │  │ table      diff    │    │      ║
    ║  │  │ KeyboardMgr   │  │ task       media   │    │      ║
    ║  │  │ Drag & Drop   │  │ canvas             │    │      ║
    ║  │  └───────┬───────┘  └────────┬─────────┘    │      ║
    ║  │          │                   │              │      ║
    ║  │  ┌───────┴───────────────────┴──────────┐   │      ║
    ║  │  │            WORKSPACE                 │   │      ║
    ║  │  │                                      │   │      ║
    ║  │  │  Tab System   File Explorer          │   │      ║
    ║  │  │  Breadcrumb   Split View             │   │      ║
    ║  │  │  Banner       Settings Panel         │   │      ║
    ║  │  │                                      │   │      ║
    ║  │  │  Storage: OPFS / Memory / Tauri      │   │      ║
    ║  │  └──────────────────────────────────────┘   │      ║
    ║  │                                              │      ║
    ║  │  ┌──────────────┐  ┌───────────────────┐    │      ║
    ║  │  │   ADVANCED   │  │  AI INTEGRATION   │    │      ║
    ║  │  │   (Phase 4)  │  │     (Phase 4)     │    │      ║
    ║  │  │              │  │                   │    │      ║
    ║  │  │ Canvas ✅    │  │ Highlight Menu    │    │      ║
    ║  │  │ Flowchart ⬜  │  │ Inline AI Popup   │    │      ║
    ║  │  │ Kanban ⬜     │  │ Chat Panel        │    │      ║
    ║  │  └──────────────┘  │ Agent Runner      │    │      ║
    ║  │                     └───────────────────┘    │      ║
    ║  └──────────────────────────────────────────────┘      ║
    ╚═════════════════════════════════════════════════════════╝
```

---

## 2. FEATURE TREE — F-Cycle Organization

```
features/
│
├── F1-EmdCore/                         🦀 Rust (Phases 1-2, ALL DONE)
│   │
│   ├── Fa-Parser/            Phase 1   ✅
│   │   ├── TODO.md                     logos lexer, pulldown-cmark parser
│   │   └── DOCS.md                     17 section types, 6 statuses, 20+ links
│   │
│   ├── Fb-Validator/         Phase 1   ✅
│   │   ├── TODO.md                     cross-file link resolution
│   │   └── DOCS.md                     status consistency, graph validation
│   │
│   ├── Fc-WasmTarget/        Phase 1   ✅
│   │   ├── TODO.md                     wasm-pack → @everthink/emd
│   │   └── DOCS.md                     383KB gzipped, works in 3 browsers
│   │
│   ├── Fd-CliToolchain/      Phase 2   ✅
│   │   ├── TODO.md                     emd check, fmt, query, graph, export, new, lsp
│   │   └── DOCS.md                     clap + miette, shell completions
│   │
│   ├── Fe-ContextLoader/     Phase 2   ✅
│   │   ├── TODO.md                     EmdIndex, token budget (tiktoken-rs)
│   │   └── DOCS.md                     load_summaries, load_for_task, caching
│   │
│   ├── Ff-LspServer/         Phase 2   ✅
│   │   ├── TODO.md                     tower-lsp, diagnostics, hover, goto-def
│   │   └── DOCS.md                     completion, format-on-save, code actions
│   │
│   └── Fg-GraphExecutor/     Phase 2   ✅
│       ├── TODO.md                     ReActAgent, ToolAgent, LLM providers
│       └── DOCS.md                     graph execution, safety, write-back
│
├── F2-Interpreter/                     🟦 TypeScript (Phases 3-4)
│   │
│   ├── Fa-BlockEngine/       Phase 3   ✅
│   │   ├── TODO.md                     BlockManager, DiffEngine, UndoManager
│   │   └── DOCS.md                     Plugin API, Keyboard, Drag/Drop, LazyLoad
│   │
│   ├── Fb-CoreBlocks/        Phase 3   ✅
│   │   ├── TODO.md                     11 visual block plugins
│   │   └── DOCS.md                     markdown, code, mermaid, katex, html,
│   │                                   image, table, diff, task, media, canvas
│   │
│   ├── Fc-Workspace/         Phase 3   ✅
│   │   ├── TODO.md                     tabs, explorer, split view, banner
│   │   └── DOCS.md                     breadcrumb, settings, 3 storage adapters
│   │
│   ├── Fd-Canvas/            Phase 4   ◐ in-progress
│   │   ├── TODO.md                     Drawing engine ✅, export ✅
│   │   └── DOCS.md                     Flowchart ⬜, Kanban ⬜
│   │
│   ├── Fe-AiIntegration/     Phase 4   ○ not started
│   │   ├── TODO.md                     Highlight menu, inline AI, chat panel
│   │   └── DOCS.md                     LLM providers, agent runner, settings
│   │
│   └── Ff-Distribution/      Phase 4   ○ not started
│       ├── TODO.md                     npm package, Tauri desktop, standalone web
│       └── DOCS.md                     wry crate, viewer, themes, templates
│
└── PROMPTS/                            Agent prompt chain
    └── F2-Interpreter/
        └── Fd-Canvas/
            ├── Phase-01-Canvas.md       (already executed)
            └── Phase-02-FlowchartKanban.md (next agent reads this)
```

---

## 3. THE EMD FILE FORMAT — What the Parser Sees

```
╔══════════════════════════════════════════════════════════════════╗
║                     📄 sample.emd                                ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  <!-- PROJECT: EMD Interpreter -->       ← metadata comment     ║
║                                                                  ║
║  ## [task|in-progress] Build Canvas      ← section header       ║
║  → depends: design.emd                   ← semantic link        ║
║  → blocks: design.emd#UX-Spec            ← anchored link       ║
║                                                                  ║
║  We need a full [[canvas-block]]         ← wiki-link            ║
║  with zoom, pan, and grid support.                               ║
║                                                                  ║
║  For reference see:                                             ║
║  ![[excalidraw-spec.emd]]                ← transclusion         ║
║                                                                  ║
║  ```draw                                ← typed code block      ║
║  {                                                               ║
║    "commands": [                                                 ║
║      {"type":"rect","x":10,"y":10,                               ║
║       "width":100,"height":50,...}                               ║
║    ]                                                             ║
║  }                                                               ║
║  ```                                                             ║
║                                                                  ║
║  ### [detail|done] Subtask Done          ← nested section       ║
║  Nested sections work too.                                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

### Parser produces this AST:

```
EmdDocument
│
├── Section #1
│   ├── level: 2
│   ├── section_type: Task
│   ├── status: InProgress
│   ├── title: "Build Canvas"
│   ├── content:
│   │   ├── Link { relation: Depends, target: "design.emd" }
│   │   ├── Link { relation: Blocks, target: "design.emd#UX-Spec" }
│   │   ├── Paragraph "We need a full..."
│   │   ├── WikiLink { target: "canvas-block" }
│   │   ├── Transclusion { target: "excalidraw-spec.emd" }
│   │   └── CodeBlock {
│   │         tag: Draw,
│   │         content: '{"commands":[...]}'
│   │       }
│   ├── subsections:
│   │   └── Section #2
│   │       ├── level: 3
│   │       ├── section_type: Detail
│   │       ├── status: Done
│   │       └── title: "Subtask Done"
│   └── diagnostics: []
```

---

## 4. CODE TO DOM — How .emd Becomes Visual Blocks

```
                    ┌──────────────────┐
                    │  📄 .emd source  │
                    │  (plain text)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  WASM Parser     │  @everthink/emd
                    │  emd.parse(src)  │  (Rust → WASM)
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  EmdDocument     │  sections[]
                    │  (AST tree)      │  each has type + status + content
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  BlockManager    │
                    │  computeDiff()   │  old AST vs new AST
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         BlockChange    BlockChange    BlockChange
         {type:add}     {type:remove}  {type:update}
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼─────────┐
                    │  applyChanges()  │
                    │                  │
                    │  For each ADD:   │
                    │    1. resolve    │
                    │       plugin     │
                    │    2. new         │
                    │       component()│
                    │    3. onMount()   │
                    │    4. append to  │
                    │       DOM        │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Plugin          │
                    │  Resolution      │
                    │                  │
                    │  section_type    │
                    │  ──────────────  │
                    │  Task → markdown │
                    │  Graph → ???     │
                    │                  │
                    │  code_block_tag  │
                    │  ──────────────  │
                    │  mermaid → mermaid│
                    │  katex → katex   │
                    │  draw → canvas   │
                    │  kanban → kanban │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  CustomElement   │
                    │  <emd-*-block>   │
                    │                  │
                    │  Each plugin     │
                    │  provides:       │
                    │  - component     │
                    │    class         │
                    │  - onMount()     │
                    │  - onUpdate()    │
                    │  - onDestroy()   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  🖥️  Live DOM    │
                    │                  │
                    │  <emd-editor>    │
                    │    <emd-block>   │
                    │      content     │
                    │    </emd-block>  │
                    │  </emd-editor>   │
                    └──────────────────┘
```

---

## 5. BLOCK PLUGIN SYSTEM — The Registry

```
                     PluginRegistry
                    ╔══════════════════════════════════════╗
                    ║   plugins: Map<id → BlockPlugin>     ║
                    ║   sectionTypeIndex: Map<type → id[]> ║
                    ║   codeBlockTagIndex: Map<tag → id[]> ║
                    ╚══════════════════════════════════════╝
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
  registerBlockPlugin()       unregisterBlockPlugin()        resolvePlugin()
  ┌──────────────────┐       ┌──────────────────┐          ┌──────────────┐
  │ 1. Add to map    │       │ 1. Remove from    │          │ 1. Check     │
  │ 2. Index by      │       │    all indexes    │          │    code_block │
  │    section_type  │       │ 2. Delete plugin  │          │    _tag first │
  │ 3. Index by      │       │ 3. Notify         │          │ 2. Then check │
  │    code_block_tag│       │    listeners      │          │    section_   │
  │ 4. Notify        │       │                   │          │    type       │
  │    listeners     │       │                   │          │ 3. Fallback   │
  └──────────────────┘       └──────────────────┘          │    to "fall-  │
                                                           │    back-block"│
                                                           └──────────────┘

    Each BlockPlugin must implement:

    ┌─────────────────────────────────────────────────────────┐
    │  interface BlockPlugin {                                │
    │    id: string;                // "canvas-block"         │
    │    name: string;              // "Canvas Drawing Block" │
    │    version: string;           // "0.1.0"                │
    │    section_types?: enum[];    // [SectionType.Task]     │
    │    code_block_tags?: enum[];  // [CodeBlockTag.Draw]    │
    │    toolbar?: ToolbarItem[];   // undo, redo, export...  │
    │    component: new() => HTMLElement;  // The WebComponent│
    │    onMount?(block, el): void;       // First render     │
    │    onUpdate?(block, el): void;      // Content changed  │
    │    onDestroy?(block, el): void;     // Cleanup          │
    │  }                                                     │
    └─────────────────────────────────────────────────────────┘
```

---

## 6. THE 11 BLOCK PLUGINS — What Each Renders

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BLOCK TYPE              TAG          RESOLUTION  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📝 markdown-block                              section_type: ALL   │
│  ┌─────────────────────────────────────────┐                       │
│  │ CodeMirror 6 editor                     │   Default block.      │
│  │ EMD syntax highlighting                 │   Handles any section │
│  │ [type], → links, [[wiki]], {{vars}}     │   without a specific  │
│  │ Standard markdown formatting            │   renderer. Also      │
│  │ 1000+ lines at 60fps                   │   resolves for Task,  │
│  └─────────────────────────────────────────┘   Summary, Detail,    │
│                                                 etc.                │
│                                                                     │
│  💻 code-block                                    tag: ANY          │
│  ┌─────────────────────────────────────────┐                       │
│  │ Language selector (100+ langs)          │   Handles code blocks │
│  │ Syntax highlighting                     │   that don't have a   │
│  │ Preview/Code toggle tabs               │   specific typed tag   │
│  │ Copy button with feedback              │   (ts, py, rs, go...). │
│  │ Line numbers toggle                    │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  📊 mermaid-block                                 tag: mermaid      │
│  ┌─────────────────────────────────────────┐   tag: gantt          │
│  │ Mermaid.js integration                  │                       │
│  │ All diagram types (graph, seq, class..) │   Lazy-loaded.        │
│  │ Auto-render on type (100ms debounce)   │   Imports mermaid.js   │
│  │ Zoom: scroll wheel, pinch              │   only when first      │
│  │ Pan: drag on diagram                   │   mermaid block        │
│  │ Export SVG/PNG                         │   appears.             │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  ∫ katex-block                                    tag: katex        │
│  ┌─────────────────────────────────────────┐                       │
│  │ KaTeX math rendering                    │   Lazy-loaded.        │
│  │ Inline: $E = mc^2$                     │   Handles inline and  │
│  │ Display: $$\int_0^\infty$$              │   display math.       │
│  │ Error display for invalid LaTeX        │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  🌐 html-block                                     tag: html        │
│  ┌─────────────────────────────────────────┐   tag: css            │
│  │ Sandboxed iframe with srcdoc           │                       │
│  │ Auto-reload on change (200ms debounce) │   CSS scoped to        │
│  │ Pop-out button → new browser tab       │   sibling HTML block.  │
│  │ Error display for invalid markup       │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  🖼️ image-block                                  section_type: —    │
│  ┌─────────────────────────────────────────┐                       │
│  │ Inline image rendering                  │   Extracts from       │
│  │ Resize via corner drag                 │   markdown ![alt](url) │
│  │ Drag from file explorer → insert       │   and Link elements.   │
│  │ Clipboard paste → base64               │                       │
│  │ Right-click: copy URL, open, download  │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  📋 table-block                                    section_type: —    │
│  ┌─────────────────────────────────────────┐                       │
│  │ Handsontable integration                │   Parses markdown     │
│  │ Editable inline cells                  │   pipe tables.         │
│  │ Sortable columns (click header)        │                       │
│  │ Filter input above table               │                       │
│  │ CSV export                             │                       │
│  │ 1000+ rows virtual scrolling           │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  🔀 diff-block                                      tag: diff        │
│  ┌─────────────────────────────────────────┐                       │
│  │ Side-by-side diff view                  │   Green = added        │
│  │ Line numbers on both sides             │   Red = removed        │
│  │ Unified diff format support            │   Blue = hunk header   │
│  │ "Apply" button with confirmation       │                       │
│  │ Stats: +N added, -M removed            │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  ✅ task-block                                     section_type: Task│
│  ┌─────────────────────────────────────────┐                       │
│  │ - [ ] / - [x] checklist                 │   Click to toggle.     │
│  │ Progress bar: "3/7 completed"          │   Strikethrough on     │
│  │ Filter: all / pending / done           │   completed items.     │
│  │ "Clear completed" button               │                       │
│  │ Color-coded status badges              │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  🎬 media-block                                     tag: media       │
│  ┌─────────────────────────────────────────┐                       │
│  │ Native <video> player with controls    │   Auto-detects         │
│  │ Native <audio> player                  │   YouTube/Vimeo URLs   │
│  │ YouTube/Vimeo embed iframe             │   and creates embed.   │
│  │ Resizable player                       │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  🎨 canvas-block                                     tag: draw       │
│  ┌─────────────────────────────────────────┐                       │
│  │ Canvas 2D drawing engine               │   Full toolbox:        │
│  │ Freehand, rect, circle, line, arrow    │   7 drawing tools      │
│  │ Text tool, eraser                      │   Color pickers        │
│  │ Zoom (0.25x-4x), pan (space+drag)     │   Line width 1-20px    │
│  │ Snap grid (10/20/50px)                 │   Opacity slider       │
│  │ Alignment guides (5px threshold)       │   Undo/redo (100 cap)  │
│  │ Export PNG, SVG, Excalidraw JSON       │   Corner resize handle │
│  │ Serialization to/from JSON             │   Status bar           │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. CANVAS BLOCK — Deep Dive

```
    ╔═══════════════════════════════════════════════════════════╗
    ║               <emd-canvas-block>                         ║
    ║                                                           ║
    ║  ┌─────────────────────────────────────────────────────┐ ║
    ║  │ TOOLBAR                                              │ ║
    ║  │                                                      │ ║
    ║  │ [✏][□][○][╱][→][T][⌫] │ [■][#] │ [━3px][◐1.0] │   │ ║
    ║  │ freehand rect circ line arrow text erase │ colors   │ ║
    ║  │                                          │ width op │ ║
    ║  │ [⊞Grid][20px▼] │ [↩][↪][✕Clear] │ [PNG][SVG][EXC] │ ║
    ║  │ grid   size    │ undo redo clear │ export buttons  │ ║
    ║  └─────────────────────────────────────────────────────┘ ║
    ║                                                           ║
    ║  ┌─────────────────────────────────────────────────────┐ ║
    ║  │ CANVAS (800×500 default, corner-drag resize)       │ ║
    ║  │                                                     │ ║
    ║  │   ┌──────────┐                                      │ ║
    ║  │   │ blue     │       ○ green circle                │ ║
    ║  │   │ rectangle│      ╱                              │ ║
    ║  │   └──────────┘     ╱   ~~~~ red squiggle          │ ║
    ║  │                    ╱                                │ ║
    ║  │   ●───────────→   (amber arrow)                    │ ║
    ║  │                                                     │ ║
    ║  │              Hello EMD!  (purple text, 32px)       │ ║
    ║  │                                                     │ ║
    ║  │   ───────────────────────────────── (gray line)    │ ║
    ║  │                                                     │ ║
    ║  │                                    ┌──┐             │ ║
    ║  │                                    │⌟ │ resize      │ ║
    ║  │                                    └──┘             │ ║
    ║  └─────────────────────────────────────────────────────┘ ║
    ║                                                           ║
    ║  ┌─────────────────────────────────────────────────────┐ ║
    ║  │ STATUS BAR:  x: 142 y: 89  │  Freehand  │  100%  │ │ ║
    ║  │              cursor pos      active tool    zoom    │ ║
    ║  └─────────────────────────────────────────────────────┘ ║
    ╚═══════════════════════════════════════════════════════════╝

    Drawing commands stored as JSON:

    {
      "version": 1,
      "width": 800, "height": 500,
      "commands": [
        {"type":"freehand", "points":[...], "strokeColor":"#ff0000", "lineWidth":3},
        {"type":"rect",      "x":50, "y":50, "width":100, "height":80, ...},
        {"type":"circle",    "x":200, "y":100, "radius":40, ...},
        {"type":"line",      "x":10, "y":10, "x2":200, "y2":150, ...},
        {"type":"arrow",     "x":50, "y":200, "x2":250, "y2":100, ...},
        {"type":"text",      "x":300, "y":50, "text":"Hello", "fontSize":24, ...},
        {"type":"eraser",    "points":[...], ...}
      ],
      "zoom": 1, "panX": 0, "panY": 0,
      "gridEnabled": false, "gridSize": 20
    }

    Undo/Redo:

    undoStack:  [ [cmd1], [cmd1,cmd2], [cmd1,cmd2,cmd3], ... ]  ← cap 100
    redoStack:  []                                                ← cleared on new push

    Keyboard shortcuts:

    F = Freehand   R = Rectangle   C = Circle   L = Line
    A = Arrow      T = Text        E = Eraser   G = Toggle Grid
    Ctrl+Z = Undo  Ctrl+Shift+Z = Redo
    Space+Drag = Pan    Ctrl+Scroll = Zoom    Middle-click+Drag = Pan
```

---

## 8. WORKSPACE — The Editor Shell

```
    ╔══════════════════════════════════════════════════════════════╗
    ║  🧰 TOP TOOLBAR                                              ║
    ║  [New File] [Open File] [Toggle Sidebar] [Settings]          ║
    ╚══════════════════════════════════════════════════════════════╝
    ╔══════════════════════════════════════════════════════════════╗
    ║  🎨 WORKSPACE BANNER  (configurable image/color/text)       ║
    ╚══════════════════════════════════════════════════════════════╝
    ┌──────────────────┬───────────────────────────────────────────┐
    │  📁 SIDEBAR      │  🧭 Root > src > blocks > canvas-block.ts │
    │  (260px)         ├───────────────────────────────────────────┤
    │                  │  📑 welcome.emd ●  │  notes.emd  │  +     │
    │  🔍 [Search...]  ├───────────────────────────────────────────┤
    │                  │                                           │
    │  📂 project/     │  ╔══════════════════════════════════════╗ │
    │    📂 src/       │  ║  ## [summary] Welcome to EMD       ║ │
    │      📂 blocks/  │  ║                                    ║ │
    │        📄 canvas │  ║  This is the EMD interpreter...    ║ │
    │        📄 mermaid│  ║                                    ║ │
    │        📄 katex  │  ║  ## [task|in-progress] Core...     ║ │
    │        ...       │  ║  - [x] Markdown text block         ║ │
    │      📂 core/    │  ║  - [x] Code block                  ║ │
    │      📂 storage/ │  ║  ...                               ║ │
    │    📂 tests/     │  ║                                    ║ │
    │    📄 welcome.emd│  ║  ## [detail] Canvas Demo           ║ │
    │                  │  ║  ┌────────────────────────────┐    ║ │
    │                  │  ║  │ 🎨 CANVAS DRAWING BLOCK    │    ║ │
    │                  │  ║  │    with toolbar + canvas   │    ║ │
    │                  │  ║  └────────────────────────────┘    ║ │
    │                  │  ║                                    ║ │
    │                  │  ╚══════════════════════════════════════╝ │
    └──────────────────┴───────────────────────────────────────────┘

    Split View (Cmd+\): divides the editor area horizontally.
    Each split has independent file, cursor position, and scroll.
```

---

## 9. STORAGE — Three Backends

```
                    StorageProvider (interface)
                    ╔══════════════════════════╗
                    ║  read(path) → string     ║
                    ║  write(path, content)    ║
                    ║  list(dir) → string[]    ║
                    ║  exists(path) → boolean  ║
                    ║  mkdir(path)             ║
                    ║  delete(path)            ║
                    ║  rename(old, new)        ║
                    ║  watch(path, cb) → fn    ║
                    ╚══════════════════════════╝
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │ MemoryStorage│    │BrowserStorage│    │ TauriStorage │
    │              │    │              │    │              │
    │ in-memory    │    │ OPFS         │    │ Native FS    │
    │ Map<string,  │    │ Origin       │    │ via Tauri    │
    │   string>    │    │ Private      │    │ IPC invoke   │
    │              │    │ File System  │    │              │
    │ Used for:    │    │              │    │ Used for:    │
    │ • dev        │    │ Used for:    │    │ • desktop    │
    │ • tests      │    │ • production │    │   app        │
    │ • fallback   │    │   web app    │    │ (planned)    │
    └──────────────┘    └──────────────┘    └──────────────┘

    App initialization picks storage:
    
    if BrowserStorage.isSupported() → BrowserStorage (OPFS)
    else                            → MemoryStorage (fallback)
```

---

## 10. INTERFACE BETWEEN CORE AND INTERPRETER

```
    ┌────────────────────────────────────────────────────────────────┐
    │                    THE BRIDGE                                   │
    │                                                                │
    │   F1-EmdCore (Rust)          F2-Interpreter (TypeScript)       │
    │   ─────────────────          ───────────────────────────       │
    │                                                                │
    │   emd/src/                   interpreter/                      │
    │   ┌──────────────┐           ┌──────────────────────┐          │
    │   │ lib.rs       │──WASM──▶  │ main.ts              │          │
    │   │              │  compile  │ import '@everthink/  │          │
    │   │ parse()      │──bind──▶  │   emd'               │          │
    │   │ validate()   │──gen──▶   │                       │          │
    │   │ serialize()  │           │ emd.parse(source)    │          │
    │   │              │           │   → EmdDocument AST  │          │
    │   └──────────────┘           └──────────┬───────────┘          │
    │                                         │                      │
    │   ┌──────────────┐                      │                      │
    │   │ cli/         │──binary──▶  CLI users │                     │
    │   │ check, fmt,  │  (standalone)         │                     │
    │   │ query, graph,│                       │                     │
    │   │ export, new  │                       │                     │
    │   └──────────────┘                      │                      │
    │                                         │                      │
    │   ┌──────────────┐                      │                      │
    │   │ lsp/         │──stdio───▶  VS Code   │                     │
    │   │ tower-lsp    │  extension  │         │                     │
    │   └──────────────┘             │         │                     │
    │                                │         │                     │
    │   Shared types live in both:   │         │                     │
    │   ┌────────────────────────────┴─────────┴──────┐              │
    │   │  types.ts  (TypeScript)                     │              │
    │   │  types.rs  (Rust, via wasm-bindgen)         │              │
    │   │                                             │              │
    │   │  SectionType enum    (17 values)            │              │
    │   │  SectionStatus enum   (7 values)            │              │
    │   │  LinkRelation enum   (20 values)            │              │
    │   │  CodeBlockTag enum   (17 values)            │              │
    │   │  EmdDocument struct                         │              │
    │   │  EmdSection struct                          │              │
    │   └─────────────────────────────────────────────┘              │
    │                                                                │
    │   npm package: @everthink/emd                                  │
    │   ┌──────────────────────────────────────────┐                 │
    │   │  package.json                            │                 │
    │   │  emd_bg.wasm       (383KB gzipped)       │                 │
    │   │  emd.d.ts          (TypeScript types)    │                 │
    │   │  emd.js            (JS glue)             │                 │
    │   └──────────────────────────────────────────┘                 │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
```

---

## 11. DATA FLOW — When User Types in a Block

```
    User types in CodeMirror (markdown-block)
                    │
                    ▼
    Content change event (debounced 50ms)
                    │
                    ▼
    BlockManager.parseAndDiff(newSource)
                    │
                    ├──▶ loadEmdWasm()   (cached after first load)
                    │
                    ├──▶ emd.parse(source)  →  EmdDocument AST
                    │
                    ├──▶ computeDiff(oldBlocks, newSections)
                    │       │
                    │       ├── Match existing blocks to new sections
                    │       ├── Detect ADDED sections    → BlockChange{type:add}
                    │       ├── Detect REMOVED sections  → BlockChange{type:remove}
                    │       └── Detect CHANGED sections  → BlockChange{type:update}
                    │
                    ├──▶ undo.push(changes)   (record for Cmd+Z)
                    │
                    └──▶ applyChanges(changes)
                            │
                            ├── ADD:    new Component() → onMount() → appendChild()
                            ├── REMOVE: onDestroy() → element.remove()
                            └── UPDATE:  onUpdate(block, element)
```

---

## 12. KEYBOARD SHORTCUTS — Global + Per-Block

```
    Global (KeyboardManager, window keydown listener):

    ┌──────────────────────────────────────────────────────────┐
    │  Arrow Up/Down    Navigate between blocks                │
    │  Enter            Edit focused block                     │
    │  Escape           Exit edit mode / clear selection       │
    │  Tab              Indent (nest) block                    │
    │  Shift+Tab        Outdent (unnest) block                 │
    │  Backspace/Delete Delete selected block(s)                │
    │  Cmd+Z            Undo                                   │
    │  Cmd+Shift+Z      Redo                                   │
    └──────────────────────────────────────────────────────────┘

    Workspace:

    ┌──────────────────────────────────────────────────────────┐
    │  Cmd+N            New file                               │
    │  Cmd+W            Close active tab                       │
    │  Cmd+\            Split view horizontally                │
    │  Cmd+,            Open settings panel                    │
    │  Cmd+Shift+[      Previous tab                           │
    │  Cmd+Shift+]      Next tab                               │
    │  Cmd+1-9          Jump to tab #N                         │
    └──────────────────────────────────────────────────────────┘

    Canvas Block (when focused):

    ┌──────────────────────────────────────────────────────────┐
    │  F                Freehand tool                          │
    │  R                Rectangle tool                         │
    │  C                Circle tool                            │
    │  L                Line tool                              │
    │  A                Arrow tool                             │
    │  T                Text tool                              │
    │  E                Eraser tool                            │
    │  G                Toggle grid                            │
    │  Space+Drag       Pan canvas                             │
    │  Ctrl+Scroll      Zoom in/out                            │
    │  Ctrl+Z           Undo stroke                            │
    │  Ctrl+Shift+Z     Redo stroke                            │
    └──────────────────────────────────────────────────────────┘
```

---

## 13. PHASE STATUS — What's Done vs Next

```
    ┌──────────────────────────────────────────────────────────────────┐
    │                                                                   │
    │  Phase 1 ── Rust Core ──────────────────────────── ✅ 100% (19/19)│
    │  ████████████████████████████████████████████████████████████████ │
    │                                                                   │
    │  Phase 2 ── Tooling ───────────────────────────── ✅ 100% (27/27) │
    │  ████████████████████████████████████████████████████████████████ │
    │                                                                   │
    │  Phase 3 ── Interpreter Core ──────────────────── ✅ 100% (28/28) │
    │  ████████████████████████████████████████████████████████████████ │
    │                                                                   │
    │  Phase 4 ── Advanced ─────────────────────────── ⏳  12%   (3/25) │
    │  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
    │  ██ done: canvas engine, zoom/pan/grid, export                   │
    │  ░░ todo: flowchart, kanban, AI (14 tasks), distribution (11)    │
    │                                                                   │
    └──────────────────────────────────────────────────────────────────┘

    Completed (89 tasks)          Remaining (22 tasks)
    ┌─────────────────────┐      ┌──────────────────────────────┐
    │ ✅ Parser + lexer    │      │ ⬜ Flowchart editor          │
    │ ✅ Validator         │      │ ⬜ Kanban board              │
    │ ✅ WASM + npm        │      │ ⬜ Highlight menu            │
    │ ✅ CLI (7 subcmds)   │      │ ⬜ Inline AI popup           │
    │ ✅ Context loader    │      │ ⬜ AI chat panel             │
    │ ✅ LSP server        │      │ ⬜ LLM providers             │
    │ ✅ Graph executor    │      │ ⬜ Agent runner              │
    │ ✅ Block engine      │      │ ⬜ Proactive AI suggestions  │
    │ ✅ 11 block plugins  │      │ ⬜ AI settings               │
    │ ✅ Tab system        │      │ ⬜ Customizable menu         │
    │ ✅ File explorer     │      │ ⬜ npm package               │
    │ ✅ Split view        │      │ ⬜ Tauri desktop             │
    │ ✅ Workspace banner  │      │ ⬜ Standalone web            │
    │ ✅ Settings panel    │      │ ⬜ wry crate                 │
    │ ✅ 3 storage types   │      │ ⬜ Theme system              │
    │ ✅ Canvas drawing    │      │ ⬜ emd-viewer component      │
    │ ✅ Canvas zoom/pan   │      │ ⬜ Keyboard overlay          │
    │ ✅ Canvas export     │      │ ⬜ emd.dev deployment        │
    │ ✅ 41 tests passing  │      │ ⬜ Apple Pencil (Tauri)      │
    └─────────────────────┘      └──────────────────────────────┘
```

---

## 14. BUILD PIPELINE — How Code Becomes Product

```
    Source                    Check                    Output
    ──────                    ─────                    ──────

    interpreter/src/          tsc --noEmit             Clean types ✅
    *.ts ──────────────────▶  (typecheck)              
        │                                             
        ├──────────────────▶  vitest run              41/41 pass ✅
        │                    (unit tests)              
        │                                             
        ├──────────────────▶  vite build              dist/
        │                    (production bundle)       ├── index.html
        │                                             ├── assets/
        │                                             │   ├── emd_bg.wasm
        │                                             │   ├── index.js
        │                                             │   ├── codemirror.js
        │                                             │   ├── mermaid.js
        │                                             │   ├── katex.js
        │                                             │   └── ...
        │                                             └── ...
        │                                             
        └──────────────────▶  vite (dev server)       http://localhost:5173
                             (HMR, instant reload)    

    Rust source:

    emd/src/                 cargo build              target/wasm32/
    *.rs ─────────────────▶  wasm-pack build          emd_bg.wasm (383KB gz)
        │                    (WASM target)             
        │                                             
        ├──────────────────▶  cargo build --release   target/release/
        │                    (native binary)           emd (CLI binary)
        │                                             
        └──────────────────▶  cargo test              52 tests pass ✅
                             (Rust unit tests)        
```

---

## 15. GLOSSARY — Key Terms

```
    ┌──────────────────────────────────────────────────────────────────┐
    │  TERM              MEANING                                       │
    ├──────────────────────────────────────────────────────────────────┤
    │  EMD               Everything MarkDown — typed, semantic MD     │
    │  Section           A headed block: ## [type|status] Title        │
    │  SectionType       17 types: task, decision, api, graph, ...    │
    │  SectionStatus     7 states: done, pending, in-progress, ...    │
    │  CodeBlockTag      17 tags: mermaid, katex, draw, kanban, ...   │
    │  LinkRelation      20 relations: depends, blocks, triggers, ... │
    │  WikiLink          [[file.emd]] — cross-file reference          │
    │  Transclusion      ![[file.emd]] — inline file content          │
    │  Semantic Link     → depends: target.emd — typed relationship   │
    │  BlockPlugin       Interface for visual block renderers         │
    │  BlockManager      Core class managing block tree + lifecycle   │
    │  PluginRegistry    Singleton managing plugin registration       │
    │  CustomElement     Native Web Component (extends HTMLElement)   │
    │  OPFS              Origin Private File System (browser storage) │
    │  WASM              WebAssembly — Rust compiled to browser       │
    │  LSP               Language Server Protocol — editor integration│
    │  ReActAgent        Reason → Act → Observe agent loop            │
    │  ToolAgent         Single-pass agent execution                  │
    │  F1-EmdCore        Rust half of the project                     │
    │  F2-Interpreter    TypeScript half of the project               │
    │  Fn-Fa             F-cycle notation: Feature N, sub-feature A   │
    └──────────────────────────────────────────────────────────────────┘
```

---

*This diagram document is the single source of truth for EMD architecture.*
*Update it when major features land. Last update: Phase 4 canvas engine complete.*
