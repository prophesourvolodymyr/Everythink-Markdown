# Core Visual Blocks — TODO

<!-- STATUS: designed -->

## Markdown Text Block
- [ ] CodeMirror 6 with EMD language mode
- [ ] Syntax highlighting: `[type]`, `→`, ` ```[tag] ````, `[[links]]`, `{{vars}}`
- [ ] Standard markdown formatting
- [ ] Inline image rendering
- [ ] → links as colored badges with relation type
- [ ] Clickable wiki-links
- [ ] No lag at 1000+ lines

## Code Block
- [ ] Language selector dropdown (100+ languages)
- [ ] Syntax highlighting via CodeMirror modes
- [ ] Preview/Code toggle tabs
- [ ] Mermaid auto-render on preview tab
- [ ] HTML sandboxed iframe on preview tab
- [ ] Resizable preview panel (drag handle)
- [ ] Copy button with "Copied!" feedback
- [ ] Line numbers toggle
- [ ] Max-height with scroll (configurable)

## HTML/CSS Block
- [ ] Sandboxed iframe with srcdoc
- [ ] CSS block scoped to sibling HTML block
- [ ] Auto-reload on keystroke (200ms debounce)
- [ ] Pop-out button → new browser tab
- [ ] Error display for invalid HTML/CSS

## Mermaid Block
- [ ] mermaid.js integration
- [ ] All diagram types supported
- [ ] Auto-render on keystroke (100ms debounce)
- [ ] Zoom: scroll wheel, pinch
- [ ] Pan: drag on diagram
- [ ] Export SVG/PNG
- [ ] Theme matches interpreter
- [ ] Error display for invalid source

## LaTeX Block
- [ ] KaTeX integration
- [ ] Inline math: `$...$`
- [ ] Display math: `$$...$$`
- [ ] Render on keystroke (100ms debounce)
- [ ] Error display for invalid LaTeX

## Image Block
- [ ] Inline rendering of `![alt](url)`
- [ ] Resizable via corner drag (maintain aspect ratio)
- [ ] Text wrap around image
- [ ] Drag from file explorer → insert
- [ ] Clipboard paste → hosting endpoint or base64 fallback
- [ ] Right-click: copy URL, open, download
- [ ] Hosting endpoint config in settings

## Table Block
- [ ] Handsontable integration
- [ ] Editable inline cells
- [ ] Resizable columns
- [ ] Inline markdown in cells (bold, italic, links, code)
- [ ] Add Row/Column buttons
- [ ] Sortable: click header to toggle sort
- [ ] Filter input above table
- [ ] CSV export with markdown formatting
- [ ] Column type auto-detect
- [ ] 1000+ rows with virtual scrolling

## Diff Block
- [ ] Side-by-side view: old left, new right
- [ ] Green added, red removed
- [ ] Line numbers on both sides
- [ ] Unified diff format support
- [ ] "Apply" button with confirmation

## Task Checklist Block
- [ ] `- [ ]` / `- [x]` syntax
- [ ] Click to toggle checkbox
- [ ] Strikethrough on completed
- [ ] Progress bar: "N/M completed"
- [ ] Filter: all / incomplete / completed
- [ ] "Clear completed" button

## Media Block
- [ ] Native `<video>` player with controls
- [ ] Native `<audio>` player
- [ ] YouTube/Vimeo embed auto-detect
- [ ] Resizable player

## Gantt Block
- [ ] Timeline with draggable bars
- [ ] Text syntax parsing
- [ ] Zoom: days/weeks/months
- [ ] Today marker
- [ ] Export PNG
- [ ] Color-coded by status

## Lazy Loading
- [ ] Each block dynamic import
- [ ] Skeleton placeholder during load
- [ ] Unused blocks never loaded
