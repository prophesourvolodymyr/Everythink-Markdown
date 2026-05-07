# Feature: Rust Interpreter — Core Visual Blocks

<!-- STATUS: designed -->
<!-- DEPENDS_ON: emd-core, block-engine -->
<!-- PARENT: rust-interpreter -->

## What This Is

Eleven built-in block renderers that ship with the Visual Interpreter: markdown text editing, code blocks with live preview, HTML/CSS sandboxed rendering, Mermaid diagram auto-render, LaTeX math rendering, resizable image embeds, interactive spreadsheet-grade tables, side-by-side diff view, task checklists with progress tracking, media embeds (video/audio), and Gantt chart timelines. Each block is a web component built on the block engine's plugin API.

These blocks are the user's primary interaction surface with `.emd` files. They transform static markdown into interactive, visual, data-rich components that feel like a modern application — not a text editor with syntax highlighting.

## Original User Notes

From the interpreter mockup, the user specified each block's behavior in detail:

- Code block: language dropdown top-right, preview/render toggle, "for some languages like markdown or mermaid, you can select to see a preview or rendered (mini) with code"
- HTML block: "run HTML code creating a rich page for the user to preview some simple designs"
- Images: "User can insert images into the document, text will wrap down or surrounding"
- Tables: "blocks I want to make them very easy to edit and automatically auto exportable in csv"
- Diff/Gantt/Katex/Todo/Media blocks: added during audit to complete the block type roster

## Block Details

### Markdown Text Block
The core editing surface. CodeMirror 6 with an EMD language mode that syntax-highlights section headers, link arrows, code block tags, wiki-links, and template variables. Standard markdown formatting: headings (H1-H6), bold, italic, links, lists (ordered and unordered), blockquotes, horizontal rules, inline code. The block renders `→` links as colored badges showing the relation type. Wiki-links render as clickable references. Images render inline (not as markdown source). Typing feels instant at 1000+ lines.

**UX**: Images render inline at natural size unless resized. Links are clickable and navigate to referenced sections. `→` badges are color-coded: green for depends/satisfied, amber for depends/pending, red for blocked, blue for agent/model links, purple for graph edges. Hovering a badge shows target status. Clicking navigates to target.

### Code Block
Syntax-highlighted code editing with a language selector dropdown (100+ languages via CodeMirror language modes). Preview/Code toggle at the top. For Mermaid: renders diagram on the preview tab (auto-renders — no button needed, just type). For HTML: renders in a sandboxed iframe on the preview tab. Copy button with "Copied!" feedback for 2 seconds. Line numbers toggle. Max-height with internal scroll for long files (configurable: 400px default, user can expand to full height).

**UX**: The language selector dropdown shows recently used languages at the top. Preview tab auto-selects based on the code block tag (`[html]` → HTML preview, `[mermaid]` → rendered diagram, `[css]` → CSS applied to sibling HTML block's iframe). The preview panel is resizable via a drag handle at the bottom. "Pop-out" button for HTML blocks opens the rendered page in a new browser tab. Mermaid renders update on every keystroke (debounced 100ms).

### HTML/CSS Live Preview Block
Sandboxed `<iframe>` with `sandbox="allow-scripts"` (no same-origin, no top navigation — security boundary). CSS block (` ```[css] ````) scoped to a sibling ` ```[html] ```` block via automatic identifier matching. Auto-reloads on keystroke (200ms debounce). "Pop-out" button opens in browser tab. Error display for invalid HTML/CSS: the iframe shows the error message instead of a blank page. The error message includes the line number and a brief description.

**UX**: The preview is a live web page inside the block. Scrollable. The iframe background matches the interpreter theme. The resize handle lets users adjust preview height. Pop-out opens a fully functional browser tab with the HTML/CSS content as a standalone page.

### Mermaid Diagram Block
Renders via mermaid.js on keystroke (100ms debounce). Supports all Mermaid diagram types: flowchart, sequence, class, state, entity-relationship, Gantt, pie, Git graph, mindmap, timeline, sankey, block, XY chart. Zoom with scroll wheel inside the preview. Export SVG and PNG from the toolbar. Error display: if the diagram source is invalid, Mermaid's error message is shown in the preview panel with the line number.

**UX**: The diagram renders automatically — no button press needed. The user types Mermaid source code and sees the diagram update in real-time in the preview panel. Zoom: scroll wheel, pinch on trackpad. Pan: drag on diagram. Reset zoom: double-click diagram. Export: toolbar button downloads SVG (vector, editable) or PNG (1x or 2x resolution). Dark mode: Mermaid theme matches interpreter theme automatically.

### LaTeX/Math Block
Renders via KaTeX. Inline math: `$E=mc^2$` renders inline within text paragraphs. Display math: `$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$` renders as centered block equation. Renders on keystroke (100ms debounce). Error display: if the LaTeX is invalid, the raw text is shown in red with an error tooltip.

**UX**: Math renders in the KaTeX font (Computer Modern, matches LaTeX output). Inline math is baseline-aligned with surrounding text. Display math is centered with padding. Copy button copies the LaTeX source. The interpreter detects math mode automatically — no toggle needed.

### Image Block
Standard markdown `![alt text](url)` syntax rendered inline. Images are displayed at natural size initially, resizable via corner drag handles (maintains aspect ratio by default, hold Shift for free resize). Text wraps around image. Drag image files from the file explorer directly onto the canvas to insert. Clipboard paste: paste an image from clipboard → if a hosting endpoint is configured in settings, the interpreter POSTs the image and inserts the returned URL. If no endpoint is configured, the image is stored as a base64 data URL inline in the `.emd` file (with a warning about file size).

**UX**: Images load with a subtle fade-in (200ms). Corner drag handles appear on selection. The resize overlay shows pixel dimensions. Right-click image: "Copy image URL", "Open image in new tab", "Download image". The hosting endpoint setting is in Settings → Workspace → Image Hosting URL. The user provides their own endpoint (S3, Cloudinary, custom server). No built-in image hosting — user owns their hosting.

### Table Block
Handsontable-based interactive spreadsheet. Cells are editable inline — click to edit, Tab to next cell, Shift+Tab to previous. Columns resizable via drag handles on headers. Cells support inline markdown: bold, italic, links, inline code. NOT nested tables or code blocks — simple inline formatting only. Add Row and Add Column buttons at the table edges. Sortable columns: click header once for ascending, twice for descending, third for unsorted. Filter input above the table: type to filter rows (matches any column). CSV export: downloads as `.csv` with raw markdown formatting preserved in cells. Column type auto-detection: number, date, string — affects sorting behavior and alignment (numbers right-aligned, text left-aligned).

**UX**: Table has alternating row colors for readability. Header row is bold with a darker background. Frozen header row stays visible while scrolling (sticky position). Row numbers optional (toggle in toolbar). 1000+ rows scroll smoothly via virtual scrolling. Empty table: "Click to add data" placeholder in first cell. The table block is always in edit mode — no view/edit toggle, just click and type.

### Diff Block
Side-by-side old-vs-new comparison view. Green background for added lines (left column = old, right column = new). Red background for removed lines. Line numbers on both sides. Handles unified diff format (standard `diff` output). "Apply" button that inserts the suggested changes into the parent code block or file — useful for `[verify]` blocks that suggest code fixes.

**UX**: The side-by-side view is horizontally scrollable if lines are long. Lines are aligned — removed lines show as blank on the new side, added lines show as blank on the old side. The "Apply" button shows a confirmation dialog: "Apply these changes to [filename]?" with a diff preview. Hovering a removed line shows a "Restore" button to undo the removal.

### Task Checklist Block
Standard markdown `- [ ] Item` and `- [x] Completed item` syntax. Checkable boxes that toggle on click. Completed items get strikethrough text styling. Progress bar at the top: "3 of 7 tasks completed" with a percentage bar. Filter dropdown: Show All, Show Incomplete, Show Completed. The block is always interactive — no edit/view toggle, just click to check.

**UX**: Checking a box has a subtle animation (checkbox fills with accent color, text transitions to strikethrough with a 200ms ease). The progress bar updates immediately. Completed items slide to the bottom of the list (configurable: group completed at bottom, or keep original order). The percentage shows as both a bar and a number. "Clear completed" button removes checked items.

### Media Block
Renders video and audio URLs as native HTML5 players. Video: `<video>` element with controls (play, pause, volume, fullscreen, playback speed). Audio: `<audio>` element with controls and optional waveform visualization. YouTube/Vimeo URLs are auto-detected and embedded as iframe players with the platform's native controls. The player is resizable via bottom drag handle.

**UX**: Video poster frame shows before play. Autoplay is off by default (respects browser autoplay policies). The player matches the interpreter theme. YouTube/Vimeo embeds use the platform's privacy-enhanced mode (`youtube-nocookie.com`). Audio waveform is a simple canvas visualization (not critical path, can be V2). File size warning: embedding large video files as base64 is prevented.

### Gantt Block
Timeline view with draggable bars. Parses simple text syntax: `Task Name: start-date, end-date` or `Phase 1: 2024-01, 2024-03`. Zoom in/out: days, weeks, months views. Today marker (vertical red line). Export as PNG from toolbar. The chart is rendered on an HTML5 Canvas for performance with many bars.

**UX**: Bars are draggable horizontally to adjust dates. The start/end dates update in the markdown source. Double-click a bar to edit task name. Hover a bar to see exact dates. Color-coded by status: green for done tasks, amber for in-progress, gray for pending, red for blocked. The timeline header shows month names. Weekend columns are shaded.

## Integration With Other Features

**Block Engine**: Every block is a plugin registered on the BlockManager. Blocks use the engine's lifecycle (mount, update, destroy) and toolbar API.

**EMD Core**: The parser identifies section types and code block tags. The validator checks content validity (e.g., Mermaid blocks containing non-diagram text).

**AI Integration**: AI actions (Replace, Chat) operate on text and code blocks. The AI chat panel can generate code blocks, tables, and diagrams and insert them.

**Workspace**: Block content is persisted through the storage adapter when the user saves the file. The serializer converts blocks back to `.emd` text.

**Distribution**: Blocks are lazy-loaded per distribution target. The standalone web version loads only the blocks present in the file.

## Known Limitations

- Tables: no nested tables or code blocks inside cells (inline markdown formatting only)
- Images: no built-in hosting — user must configure an upload endpoint
- Gantt: simple text-based syntax, not full project management features (no dependencies between bars, no resource assignment)
- Media: no DRM support, basic HTML5 video/audio only
- CodeMirror: very large files (10,000+ lines) may show slight scroll lag on low-end devices
- Mermaid: very complex diagrams (100+ nodes) may render slowly on first render
- KaTeX: some advanced LaTeX packages are not supported (KaTeX covers ~90% of common LaTeX)

## V2 Plans

- Vega chart block: JSON-based data visualization (bar, line, scatter, area charts)
- 3D model block: Three.js glTF viewer with orbit controls
- Flowchart editor block: WYSIWYG node-and-edge editor (moved from canvas blocks into core blocks with its own section type)
- Gantt: dependency lines between bars, drag-to-adjust, resource columns
- Table: formula support (SUM, AVG, COUNT), conditional formatting
- CodeMirror: v6 collaborative editing mode for real-time pair editing
- KaTeX: chemical equation support via mhchem extension
