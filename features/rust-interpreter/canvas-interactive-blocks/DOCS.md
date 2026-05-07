# Feature: Rust Interpreter — Canvas & Interactive Blocks

<!-- STATUS: designed -->
<!-- DEPENDS_ON: emd-core, block-engine -->
<!-- PARENT: rust-interpreter -->

## What This Is

Three visually rich interactive blocks: a freehand drawing canvas (Excalidraw-compatible, HTML5 Canvas 2D), a WYSIWYG flowchart editor (SVG/DOM-based node-edge editor), and an auto-generated kanban board (reads `[task]` sections across workspace, grouped by status). These are the most complex blocks — each is essentially a mini-application embedded in the block engine.

Drawing logic and toolbar patterns are derived from the Obsidian Excalidraw plugin (`/Users/volodymurvasualkiw/Desktop/CLONED/obsidian-excalidraw-plugin`). The canvas data is stored as Excalidraw-compatible JSON in ` ```draw ```` code blocks.

## Original User Notes

From the mockup: "Drawing space — where person can just take any freehand drawing components that are 100% under the hood. All AI is readable APPLE PENCIL. We should take the system from obsidian-excalidraw-plugin."

The toolbar mockup shows: `[口] [◯] [／] [Ｔ] [🖼️]` — Rectangle, Ellipse, Line, Text, Image — plus undo/redo, export, and close.

## Block Details

### Drawing Canvas

**Technology**: HTML5 Canvas 2D API, TypeScript web component. Not WebGL — Canvas 2D is sufficient for Excalidraw-style drawing and performs well with 500+ elements. Vector-based (shapes as objects), not pixel-based (bitmap).

**Toolbar** (matching the user's mockup plus Excalidraw patterns):
- Select/Move tool (default, V key)
- Rectangle (□, R key), Ellipse (◯, O key), Diamond (◇, D key)
- Line (／, L key), Arrow (→, A key)
- Freehand pencil (✦, P key)
- Text (T key), Image insert (🖼️, I key — from clipboard or file)
- Eraser, Lock toggle (🔒 — prevents drawing while scrolling)
- Undo (↶, Cmd+Z), Redo (↷, Cmd+Shift+Z)
- Clear canvas, Export SVG, Export PNG (2x resolution)
- Zoom: +, -, Fit to screen (Cmd+0)

**Drawing behavior**: Click tool, click-and-drag on canvas to draw. Shift+drag constrains proportions (square, circle). Click element to select (blue outline, resize handles). Drag to move. Double-click text to edit. Delete/Backspace removes selected. Multi-select: Shift+click or drag marquee.

**Apple Pencil** (macOS via Tauri): Pointer Events with `pressure` (maps to stroke width: 0.0→1px, 1.0→20px) and `tiltX`/`tiltY` (stroke angle variation). Palm rejection: only Pencil touches register as drawing, finger touches are scroll/pan.

**Snap & alignment**: 20px grid (configurable). Alignment guides (red dotted lines) when edges align. Center alignment indicator.

**Navigation**: Scroll/pan: two-finger on trackpad, scroll wheel on mouse. Pinch to zoom. Space+drag to pan when another tool active. Lock toggle prevents accidental drawing while scrolling.

**Data format**: Excalidraw-compatible JSON. Canvas imports/exports this format natively. The user's existing Excalidraw drawings in Obsidian can be copy-pasted into the interpreter.

**No layers in V1**: Single surface. Layers added in V2.

### Flowchart Editor

**Node types**: Rectangle (process), Diamond (decision with yes/no branches), Rounded rectangle (start/end), Parallelogram (input/output). Custom node colors and labels.

**Interaction**: Double-click canvas to add node (default: rectangle). Drag nodes — connected edges redraw automatically. Double-click node to edit text. Click node edge → drag connector handle → release on target node to create edge. Click edge to add label text. Delete node (Backspace) removes connected edges.

**Data format**: Stored as ` ```mermaid flowchart ```` for standard markdown compatibility. When the user opens the file in another editor, the flowchart is still readable as Mermaid source. The interpreter's flowchart editor provides WYSIWYG editing, but the underlying format is standard Mermaid.

### Kanban Board

**Auto-generation**: The `[kanban]` section type reads ALL `[task]` sections across the entire workspace and groups them by status into columns: Pending, In Progress, Done, Blocked, Archived. The board is a view — it doesn't own the data. Every card is a live reference to a `[task]` section in a `.emd` file.

**Interaction**: Drag card between columns → updates `## [task|status]` header in the source `.emd` file. Click card → navigates to that section in the editor (opens the file, scrolls to section). "Add task" button at bottom of each column → creates new `## [task|status] Title` section in a task file. Card shows: title, → depends links as colored badges, status badge, assignee (from `→ assigned-to:` link if present).

**Filtering**: Filter by tag (from metadata comments on task sections). Filter by assignee. Hide archived/cancelled tasks by default. Search bar: filter cards by title text.

**Empty state**: "Create your first task to populate this board. Tasks are `[task]` sections in any .emd file in your workspace. Add `→ depends:` links to connect tasks." With a "Create First Task" button.

## UX Depth

### Canvas block micro-interactions
- Hover shape: cursor changes (hand for fill area, resize arrows for edges, I-beam for text)
- Select shape: blue outline + 8 resize handles (corners + midpoints), bounding box
- Resize: corner handles free-resize, side handles stretch one dimension. Shift = constrain proportions
- Delete animation: shape shrinks and fades (150ms)
- Drawing: stroke appears in real-time as you draw, no lag
- Elements have subtle shadow: 2px blur, 10% opacity for depth layering

### Keyboard shortcuts (canvas focused)
- V = Select, R = Rectangle, O = Ellipse, L = Line, P = Pencil, T = Text, E = Eraser
- Cmd+Z = Undo, Cmd+Shift+Z = Redo
- Cmd+A = Select all, Cmd+C/V = Copy/Paste, Cmd+D = Duplicate
- Cmd+0 = Fit to screen, Cmd++/– = Zoom, Space+drag = Pan

### Kanban drag micro-interactions
- Card lifts with shadow when dragging (box-shadow transition)
- Column highlights (light background glow) when card hovers over it
- Drop animation: card slides into position (150ms ease)
- File write happens on drop — async, with save indicator on tab

## Integration

**Block Engine**: All three blocks are plugins on the BlockManager. Their lifecycle (mount, update, destroy) is managed by the engine.

**EMD Core**: Parser identifies `[draw]`, `[flow]`, `[kanban]` sections. Validator checks canvas JSON is well-formed (but doesn't validate drawing content).

**AI Integration**: AI agents can generate kanban cards and flowchart nodes by writing EMD markup. The interpreter renders them automatically.

**Workspace**: Kanban reads tasks across all workspace files via the storage adapter. File changes are detected by the file watcher and the board updates live.

## Known Limitations

- Drawing canvas: no layers (V2), no pressure/tilt on non-Apple-Pencil styluses
- Flowchart: 4 node types only, no custom shapes, edges are straight lines (no curved/bezier)
- Kanban: read-only from EMD files (no external data sources), no swimlanes (V2)

## V2 Plans
- Canvas layers: separate surfaces for different drawing elements
- Flowchart: custom node shapes, curved edges, sub-graphs
- Kanban: swimlanes, WIP limits, cycle time tracking, calendar view
