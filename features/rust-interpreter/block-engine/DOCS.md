# Feature: Rust Interpreter — Block Engine

<!-- STATUS: designed -->
<!-- DEPENDS_ON: emd-core (parser, validator, context-loader) -->
<!-- PARENT: rust-interpreter -->

## What This Is

The block rendering engine is the architectural foundation of the Visual Interpreter. It transforms the flat list of `EmdSection` nodes from the EMD parser into a live, interactive block-based editing surface — like Notion's block editor, but driven entirely by the semantic structure of the `.emd` file. Every section type (task, code, table, draw, kanban, etc.) becomes a draggable, nestable, interactive block with its own renderer, toolbar, and lifecycle.

The engine is a web component-based TypeScript module. It does NOT use React, Vue, or any framework — blocks are plain Web Components (`CustomElement`) so the engine is frameworkless and embeddable anywhere: Tauri WebView, npm package, standalone HTML, or wrapped in a Rust wry window.

## Why It Matters

Without the block engine, the Visual Interpreter would be a text editor with syntax highlighting — indistinguishable from VS Code or Obsidian. The block engine transforms the interpreter from "markdown editor" to "interactive system dashboard." A `[task]` section isn't just colored text — it's a task card with a status badge, a progress bar, a dependency graph, and a "Run agent" button. A `[draw]` section isn't just JSON — it's a full drawing canvas with Apple Pencil support. The block engine makes EMD files feel alive.

The block engine also provides the plugin API — the extension point that lets community developers add new block types (Vega charts, 3D model viewers, custom visualizations) without touching the core code. Core blocks (code, table, draw) are built on this same API, eating our own dogfood.

## Original User Notes

From the interpreter mockup, the user envisioned: "7+ distinct block types: markdown text, code previews, HTML live render, Mermaid diagrams, embedded images, editable tables, Excalidraw-style canvas. These aren't just styled text — they have interactive toolbars, resizing, drag-to-reorder, and AI context actions."

The user explicitly wanted a block-based editor like Notion or Linear, not a WYSIWYG textarea. Every EMD section becomes a draggable, nestable block. The block type determines the renderer. The section type determines the UX.

## Architecture

### BlockManager

The `BlockManager` class is the single source of truth for the block tree. It holds a flat array of blocks with optional parent references (matching EMD's `Vec<EmdSection>` with optional `children` field). The manager handles add, remove, reorder, nest, and unnest operations. It emits change events for the EMD serializer to write back.

### Block Lifecycle

Each block goes through three phases:

**Mount**: The engine instantiates the web component for the block's section type. The section data (`EmdSection` struct) is passed as a property. The block renders its initial state — a code editor, a table grid, a canvas surface, or a text editor.

**Update**: When the user edits the block, the engine re-parses the `.emd` content via the WASM parser (debounced 50ms), diffs the new AST against the old, and calls `block.update(newData)` on blocks whose section data changed. Blocks whose data didn't change are left untouched — minimal DOM operations, maximum performance.

**Destroy**: When a section is deleted or the file is closed, the engine calls `block.destroy()` to clean up event listeners, WebGL contexts, timers, and DOM nodes. The block is removed from the tree and the DOM.

### Rendering Pipeline

The pipeline connects keystrokes to visual updates:

```
User types in CodeMirror
    ↓ (50ms debounce)
EMD text → emd WASM parser → EmdDocument AST
    ↓
BlockManager.diff(oldAST, newAST) → change list
    ↓
For each changed block → block.update(newSection)
    ↓
User sees updated rendering (table refreshed, diagram re-rendered, etc.)
```

The 50ms debounce means the user can type continuously without triggering parse on every keystroke, but the AST is never more than 50ms behind the editor.

### Block Tree Structure

Blocks follow EMD's section hierarchy: H1 sections contain H2 sections, which contain H3 sections, down to H6. The block tree is a flat array where each block has an optional `parentId` referencing its container. This matches EMD's `children: Vec<EmdSection>` field — flat storage, hierarchical display.

Indentation in the editor reflects nesting depth. H2 blocks are indented one level under their H1 parent. H3 blocks are indented two levels. The visual indentation is purely presentational — the underlying data model remains flat.

### Plugin API

The plugin API is the contract between the engine and block renderers:

```typescript
interface BlockPlugin {
  id: string;
  name: string;
  version: string;
  sectionType?: string;       // matches [type] in EMD header ("task", "draw", etc.)
  codeBlockTag?: string;      // matches ```[tag] in code fences ("mermaid", "html", etc.)
  component: CustomElementConstructor;  // the web component class
  toolbar?: ToolbarItem[];    // custom toolbar actions per block
  onMount?: (block: EmdBlock) => void;
  onDestroy?: (block: EmdBlock) => void;
}
```

A plugin matches either a section type or a code block tag. When the engine encounters a section with a matching type, it instantiates the plugin's component. If no plugin matches, the engine uses the fallback renderer — plain markdown text with a "No renderer" badge.

The `toolbar` array lets plugins add custom buttons to the block's floating toolbar. A table block adds "Export CSV" and "Sort" buttons. A drawing canvas adds "Export SVG" and "Lock" buttons. The engine renders these in the toolbar alongside the standard items (drag handle, turn-into, delete, move).

### Core Blocks Eat Their Own API

Every built-in block (code, table, draw, etc.) is registered as a plugin through the same `registerBlockPlugin()` function. This guarantees the plugin API is production-grade — if the API is too limiting for our own blocks, it's too limiting for third-party developers. No secret internal APIs.

### Block Toolbar

The floating toolbar appears above or below the focused block. It has three sections:

**All blocks**: Drag handle (⠿) for reordering, Turn into dropdown (convert section type), Delete, Move up, Move down.

**Type-specific**: Actions defined by the block plugin. Code block: language selector, copy button. Table block: add row, add column, sort, filter, export CSV. Canvas block: undo, redo, clear, export.

**AI actions** (context-aware): Replace, Chat — available on text content blocks.

The toolbar is positioned intelligently: above the block if there's space, below if near the viewport top. It stays visible during scrolling if the block is in view.

### Drag-and-Drop Reordering

Blocks are draggable by their handle (⠿). Drag up/down changes the block's position in the sibling list. Drag left/right changes indentation (nest/unnest under a parent). Visual feedback: a blue drop indicator line shows where the block will land. Blocks auto-scroll the viewport when dragged near edges.

The reorder operation is O(1) in the DOM — only the dragged block and its neighbors are repositioned. The rest of the block tree is untouched.

### Keyboard Navigation

Blocks are navigable by keyboard for accessibility and power users:
- Arrow Up/Down: move focus between blocks
- Enter: enter edit mode for focused block
- Escape: exit edit mode, return to block navigation
- Cmd+Z / Cmd+Shift+Z: undo/redo (content changes + reorder operations)
- Backspace/Delete on selected block: delete the block (with confirmation)
- Tab / Shift+Tab: indent/outdent block

### Undo/Redo

The undo stack captures both content changes (text edits within a block) and structural changes (reorder, delete, add). The stack depth is configurable, defaulting to 100 operations. Undo/redo works across block types — undoing a task-to-code conversion restores the original section type and content.

### Lazy Loading

Block renderers are loaded only when their section type appears in the file. The JavaScript for the drawing canvas is not loaded unless the file contains a `[draw]` section or `` ```draw ```` code block. This keeps the initial bundle small and the interpreter fast on first open.

Dynamic imports: `const DrawBlock = await import('./blocks/draw-block.js')`. The engine shows a skeleton placeholder while the renderer loads (typically sub-50ms for cached modules).

### Fallback Renderer

Unknown section types or unregistered code block tags render as styled markdown with a badge: "[unknown: type-name]". The content is still readable. The user can install a plugin that registers a renderer for that type. The badge links to the plugin marketplace.

## UX Depth

### Block Hover State
- Subtle left border highlight (4px, theme accent color) appears on hover
- Drag handle (⠿) fades in on the left edge
- Block-type badge appears top-right: `[code]`, `[table]`, `[mermaid]`, etc.
- Transitions: 150ms ease-out for all hover effects

### Block Selection State
- Click block → full border highlight (2px, theme accent)
- Toolbar appears above/below
- Shift+click → range select multiple consecutive blocks
- Cmd+click → toggle individual block in multi-select
- Selected blocks share a combined toolbar with mass actions

### Block Focus State (Editing)
- Block in edit mode shows active cursor (CodeMirror for text, grid focus for tables, canvas cursor for drawings)
- Toolbar stays visible
- Block border is slightly more prominent (2px → 3px)
- Clicking outside the block exits edit mode

### Turn Into Dropdown
The "Turn into" dropdown converts the current block to a different section type. The conversion is smart:
- Text → Task: wraps in `## [task|pending] Title`
- Text → Code: wraps in `` ```lang ... ``` ``, auto-detects language
- Task → Kanban card: moves the task to a kanban board
- Code → Mermaid: wraps in `` ```mermaid ... ``` ``
- Any → Any: preserves content, changes section type header

The dropdown shows all 17 section types grouped by category: Documentation (summary, detail), Tracking (task, decision), Definition (api, spec, agent, config), Execution (verify, graph, template), Visual (draw, flow, kanban), and Reference (example). The user's most-used types appear at the top.

### Performance Targets
- BlockManager handles 1000 blocks without frame drops (60fps)
- Drag reorder is perceptually instant (under 16ms per frame)
- Block mount/mount: under 50ms for simple blocks (text), under 200ms for heavy blocks (canvas, table with 1000 rows)
- Undo/redo: under 50ms regardless of stack depth
- Lazy load: skeleton shown within 16ms, renderer loaded within 100ms (cached) or 500ms (first load)

## Integration With Other Features

**EMD Core (parser)**: The engine calls the WASM parser on every keystroke (debounced). The AST drives all rendering.

**Core Visual Blocks**: Each block renderer (code, table, draw, etc.) is a plugin on this engine. They depend on the engine for lifecycle management.

**Canvas Blocks**: The drawing canvas, flowchart editor, and kanban board are heavy plugins loaded by the engine on first encounter.

**AI Integration**: The highlight menu, inline AI popup, and chat panel interact with blocks through the engine's BlockManager. AI actions modify block content, the engine handles the update.

**Workspace**: Tabs, file explorer, and split view wrap the block engine in a workspace shell. Each tab has its own BlockManager instance.

**Distribution**: The engine is bundled with the interpreter for all distribution targets.

## Known Limitations

- Flat list + parent references means deeply nested structures (H1→H2→H3→H4→H5→H6) still work but the DOM depth is hard-capped at 6 levels
- Drag reorder of blocks across different parent containers requires two operations (drag to unnest, then drag to reorder)
- Block mount/destroy is not animated in V1 (blocks appear and disappear instantly)
- Plugin API is synchronous — plugins must return their component class immediately, no async registration
- No block-level collaboration primitives (CRDT). Two users editing the same block will conflict.

## V2 Plans
- Animated block transitions (mount: fade in + slide down 8px, destroy: opposite)
- Async plugin registration: plugins can load remote resources before registering
- Block-level CRDT or OT for real-time collaboration
- Block templates: save a block configuration as a reusable template
- Block groups: select multiple blocks and group them into a compound block
- Touch-optimized drag handles for mobile/tablet
