# Fa6-BlockResolver — Widget-Resolved Code Block Rendering

The decoration sub-feature that maps fenced code block tags to interactive widget renderers. When the editor encounters a fenced code block with an EMD tag — ````mermaid`, ````draw`, ````katex`, ````kanban`, ````html`, ````diff`, ````media`, ````gantt`, ````flow`, ````vega`, ````3d`, ````verify`, ````example`, ````prompt`, ````snippet` — Fa6-BlockResolver replaces the entire code block region with an interactive widget that renders the block content in its specialized format. A Mermaid block becomes a rendered diagram. A Draw block becomes a full drawing canvas. A Kanban block becomes an interactive board. This is the mechanism that transforms EMD from a text format into a rich document format.

## Why This Exists

Fenced code blocks in standard markdown are passive — they display syntax-highlighted text. In EMD, code blocks tagged with a type become interactive components. The author writes a diagram in text and sees it rendered in real time. They write canvas drawing commands as JSON and see the canvas update. They define a kanban board's data and see the board with draggable cards. Fa6-BlockResolver is the bridge between the text representation and the visual representation of these typed blocks.

The resolver is a registry, not a set of hardcoded renderers. Every widget renderer is registered through a plugin API. The SDK ships with built-in renderers for common types (Mermaid, KaTeX, diff), but external developers can register their own renderers for custom code block tags. This makes the block system extensible without modifying the SDK source code.

## The Widget Registry

The widget registry maps code block tag strings to widget constructor functions. A widget constructor is a function that receives the block's text content, an HTMLElement container, and a context object containing the current EditorView, the block's source span, and lifecycle callbacks. The constructor returns an object implementing the Widget interface: `mount(container)`, `update(content)`, `destroy()`, `getEstimatedHeight()`, `eq(other)`.

Registration happens through the public API:

- `registerBlockWidget(tag, constructor)` adds a widget for the given tag. If a widget is already registered for that tag, the new one replaces it.
- `unregisterBlockWidget(tag)` removes the widget for the given tag, reverting the block to syntax-highlighted code view.
- `getBlockWidget(tag)` returns the current widget constructor, or undefined if none is registered.

The registry is a singleton per EditorView instance. Different editor instances can have different widget registrations. This allows, for example, a documentation editor to have a custom ````api-docs` renderer that a project management editor does not need.

## How Tags Are Extracted

The tag is extracted from the code fence info string — the text immediately after the opening ```` characters. The lezer markdown parser provides the info string as part of the `FencedCode` node. Fa6-BlockResolver reads the info string, strips leading and trailing whitespace, and uses the first word as the tag. Additional text after the first word is treated as metadata and passed to the widget constructor's context. For example, a code fence ````mermaid graph TD` has tag `mermaid` and metadata `graph TD` (though in practice the metadata is usually empty since Mermaid reads its content from the block body).

If the info string contains no recognizable tag, or if the tag starts with a language name that matches a known programming language (javascript, python, rust, etc.), the block is treated as a standard code block and rendered with syntax highlighting by CodeMirror's built-in language modes, not by Fa6-BlockResolver. This ensures that standard code blocks (` ```ts `, ` ```python `) continue to work as expected.

If the tag matches a registered widget but the widget constructor throws an error during rendering, the block falls back to syntax-highlighted code view with an error banner at the top showing the widget's error message. This prevents a broken widget from making the entire document unusable.

## Widget Lifecycle

Each widget goes through a defined lifecycle managed by CodeMirror 6's widget system and Fa6-BlockResolver's lifecycle hooks.

**Mount** occurs when the widget's block enters the visible viewport. The widget constructor is called with the current block content and an empty container element. The widget renders its initial visual output into the container. If the widget needs to load external resources (Mermaid.js, KaTeX, image data), it shows a skeleton placeholder and begins loading. Once loaded, it updates its container. The mount phase should complete in under 200ms for lightweight widgets and under 2 seconds for heavyweight widgets with external dependencies.

**Update** occurs when the block content changes (the user edits the text inside the code block). The widget's `update(newContent)` method is called. The widget should efficiently update only the parts of its visual output that depend on the changed content. A Mermaid widget re-renders the diagram. A canvas widget replays the drawing commands. A kanban widget re-reads the board data and updates columns and cards. Updates are debounced: if the user types rapidly, the widget receives an update only after the user pauses typing for the configured debounce interval (typically 200-300ms depending on widget complexity).

**Destroy** occurs when the block is removed from the document, the document is closed, or the widget registration changes (a different widget is registered for the same tag). The widget's `destroy()` method is called to clean up DOM elements, event listeners, timers, and external resource references. Failure to properly destroy widgets results in memory leaks and detached DOM elements.

**Measure** is called by CodeMirror to determine the widget's vertical height. The widget's `getEstimatedHeight()` returns a pixel value. Accurate height estimation is critical for scroll position stability — if a widget reports 200px but renders at 400px, the scroll position will jump when the widget finishes loading. Widgets that load external resources should report a conservative minimum height initially and update their measurement once the content is loaded.

**Equality check** is called by CodeMirror during decoration diffing. The `eq(other)` method determines whether two widget instances represent the same visual output. If `eq` returns true, CodeMirror reuses the existing DOM element instead of recreating it. For content-independent widgets, `eq` always returns true. For content-dependent widgets, `eq` compares content hashes.

## Built-in Widgets

The SDK ships with built-in widget renderers for the most common EMD code block tags. These are registered automatically when the editor initializes but can be overridden by external developers who want custom rendering for any tag.

**Mermaid widget**: Renders Mermaid.js diagrams. Content is the diagram source text in Mermaid syntax. The widget loads Mermaid.js on first use (lazy loading via dynamic import), renders the diagram to SVG, and displays it with zoom and pan controls. If Mermaid.js is not available, the widget shows a "Mermaid.js not loaded" message with a retry button. If the diagram source contains errors, the widget shows the error message with a highlighted line number pointing to the syntax error in the source text.

**KaTeX widget**: Renders LaTeX math. Content is math expressions in KaTeX-compatible syntax. The widget loads KaTeX on first use. Inline math (`$...$`) and display math (`$$...$$`) are both supported. Rendering errors are displayed with the problematic expression highlighted.

**Draw widget**: Renders the interactive drawing canvas. Content is a JSON object containing drawing commands, canvas dimensions, and view state (zoom, pan, grid). The widget creates an `EmdCanvasBlock` custom element, passes the JSON content, and the canvas handles all drawing interactions. Changes to the canvas (new strokes, deleted shapes, undo/redo) are written back to the code block content by serializing the updated command list to JSON and dispatching a CodeMirror transaction to update the document text.

**Kanban widget**: Renders the kanban board. Content is a JSON configuration specifying columns, card data, WIP limits, and view preferences. The widget creates a reactive kanban board with columns and draggable cards. Moving a card between columns updates the underlying board data, which is serialized back to the code block content.

**HTML widget**: Renders HTML in a sandboxed iframe. Content is HTML markup. The widget creates an iframe with `srcdoc` set to the block content, sandboxed with restrictive permissions. A toolbar allows toggling between code view and rendered view. CSS blocks can be linked to HTML blocks via metadata for combined rendering.

**Diff widget**: Renders side-by-side diff view. Content is a unified diff. The widget parses the diff, separates added, removed, and context lines, and renders them with green, red, and neutral backgrounds respectively. An "Apply" button writes the diff changes to the target file.

**Media widget**: Renders video, audio, or embedded content. Content is a URL. The widget detects the media type from the URL and creates the appropriate player — a native `<video>` element for video URLs, a native `<audio>` element for audio URLs, or an iframe embed for YouTube, Vimeo, and other supported platforms. A placeholder with a "load media" button is shown for external URLs to prevent automatic loading of potentially large files.

## Widget Communication Back to the Document

Widgets that allow user interaction (drawing on a canvas, moving kanban cards, toggling checkboxes) need to communicate state changes back to the document text. This is done through a `writeBack(content: string)` callback provided in the widget context. When a widget wants to update the block content, it calls `writeBack` with the new content string. Fa6-BlockResolver dispatches a CodeMirror transaction that replaces the text between the code fence markers with the new content. This triggers the normal parse → diff → decorate cycle, and the widget receives an `update` call with the new content.

The write-back is debounced for performance: rapid changes (like freehand drawing strokes) are batched and written at most once per 100ms. The user can continue interacting with the widget during write-back — the widget maintains its own internal state and only the serialized form is written to the document text.

## Performance and Lazy Loading

Heavy widget dependencies (Mermaid.js, KaTeX, the full drawing canvas engine) are loaded lazily — only when the first block of that type appears in the document. Widgets that have not yet loaded show a skeleton placeholder with the tag name and a loading indicator. Once the library loads, the placeholder is replaced with the rendered widget. Subsequent blocks of the same type render immediately because the library is cached.

Widgets outside the visible viewport are not rendered. CodeMirror's viewport system ensures that only decorations within the visible scroll area (plus a small buffer above and below) are mounted. Blocks that scroll off-screen are destroyed, and their resources are freed. When they scroll back into view, they are re-mounted.

## Edge Cases

A code block with no closing fence (unclosed block) is treated as extending to the end of the document. Fa6-BlockResolver still renders a widget for the available content, but the widget displays a warning that the block is unclosed. This prevents malformed documents from breaking the entire editor.

A code block with a tag that has no registered widget and no matching language mode falls back to plain text display with no syntax highlighting. The block is rendered as a `<pre>` element with monospace font. A small "no renderer available" indicator may be shown.

Very large code blocks (over 10,000 characters) are rendered with a "large content" warning. The widget renders in a collapsed state initially, with a "show content" button to expand. This prevents very large blocks from causing performance issues during initial render.

Nested code blocks (a ` ```draw ` block that contains markdown text with its own ` ```mermaid ` block) are handled by the parser. The inner code block is treated as literal text within the outer block. Fa6-BlockResolver only resolves blocks at the top level of the section content and does not recurse into widget-rendered content.

## Relationship to Other Sub-Features

Fa6-BlockResolver depends on Fa1-SyntaxHider to hide the code fence markers. When a block is replaced by a widget, the SyntaxHider skips the entire fence range because it is covered by the widget decoration. The widget's DOM element replaces the entire block region in the visual layout.

Fa6-BlockResolver coordinates with Fa3-LinkRenderer for transclusion: when a `![[file.emd]]` transclusion is encountered, Fa3 creates a widget that embeds the referenced file's content. That embedded content may itself contain code blocks, which are resolved by Fa6. This is handled by creating a separate EditorView instance for the embedded content, with its own Fa-LiveMd decoration pipeline.

Fa6-BlockResolver receives its widget styling (borders, backgrounds, toolbar styles) from Fh-ThemeEngine's CSS custom properties.

## Testing

Each built-in widget is tested in isolation with valid input, invalid input (error handling), and empty input. Widget lifecycle tests verify mount → update → destroy sequencing. Write-back tests verify that widget interactions result in correct document text changes. Performance tests measure widget load time and update time for typical block sizes. Lazy loading tests verify that widget libraries are not loaded until first use.
