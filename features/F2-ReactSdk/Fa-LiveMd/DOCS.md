# Fa-LiveMd — Live Markdown Rendering Engine

The CodeMirror 6 ViewPlugin extension that transforms raw `.emd` source text into a visually rich editing surface. This is the core rendering engine of the React SDK. It runs entirely inside the CodeMirror 6 editor lifecycle and produces no DOM of its own — it instructs CodeMirror what to show, hide, and style through the Decoration API.

## Why This Exists

A plain CodeMirror 6 editor shows raw markdown text with syntax highlighting. That is a code editor, not a document editor. Fa-LiveMd transforms the same text into what appears to be a styled document — headings look like headings, bold text looks bold, checkboxes can be clicked, diagrams render inline, section type badges appear next to titles. But crucially, the underlying text never changes. Click into any rendered area and the raw markdown reappears for editing. This is the "single-panel WYSIWYG" pattern that Obsidian pioneered and that Papyr, Milkdown, and other CM6 extensions implement.

Fa-LiveMd differs from those because it understands the full EMD type system. A `## [task|in-progress] Build UI` heading receives a TASK badge, a progress bar if the section contains a checklist, and a yellow status dot. A `## [decision|done] Use Rust` heading receives a DECISION badge and a green status dot. A `→ depends: design.emd` link becomes a colored badge showing the relation type and target. None of this is possible with standard markdown extensions that only see CommonMark nodes.

## Where It Fits

```
User types in <EmdEditor>
        │
        ▼
CodeMirror 6 EditorView holds raw text
        │
        ▼
@codemirror/lang-markdown parses → lezer syntax tree
        │
        ▼
Fa-LiveMd ViewPlugin.update() receives tree
        │
        ├──▶ Fa1-SyntaxHider: hide ## ** * `` [] () markers
        ├──▶ Fa2-TextStyler: apply font weight, size, color
        ├──▶ Fa3-LinkRenderer: decorate [[wiki]] and → links
        ├──▶ Fa4-StatusBadge: insert status dot widgets
        ├──▶ Fa5-TypeBadge: insert section type label widgets
        ├──▶ Fa6-BlockResolver: replace code blocks with widgets
        ├──▶ Fa7-InlineWidgets: insert checkbox, progress bar
        └──▶ Fa8-ThemeEngine: resolve CSS variable colors
        │
        ▼
Decoration.set([...]) returned to CodeMirror
        │
        ▼
CodeMirror paints the styled view
```

All eight sub-features run in the same `ViewPlugin.update()` call. The order matters: syntax is hidden first so text measurements are accurate, then text is styled, then badges and widgets are placed relative to the styled text positions.

## Input Contract

Fa-LiveMd receives from the host application:
- A `CodeMirror 6 EditorView` instance with `@codemirror/lang-markdown` loaded
- A `Config` object specifying which EMD features to enable, theme preference, debounce timing, and widget registrations
- Optional: an `EmdDocument` AST from `@everthink/emd` for sections that need structural context (task progress bars need to count child checkboxes, graph sections need node/edge summary)

The syntax tree from lezer is always available via `syntaxTree(state)`. For standard markdown decorations (hiding `**`, styling headings), the lezer tree alone is sufficient. For EMD-specific decorations (status badges, type badges, semantic link coloring), the EmdDocument AST is needed because lezer does not understand EMD section header syntax.

## Output Contract

Fa-LiveMd produces:
- A `Decoration.set` — the standard CodeMirror 6 decoration collection containing HideDecoration (replace), MarkDecoration (style), WidgetDecoration (embed DOM), and LineDecoration (gutter) objects
- The decoration set is applied to the EditorView via the ViewPlugin's `decorations` field
- All decorations are range-based: each decoration specifies a `from` and `to` byte offset in the document
- Widgets are positioned at their decoration range's `from` offset and flow with the text as the user edits

## Internal Architecture

The ViewPlugin class holds:
- A `Config` reference (theme, enabled features, widget registry)
- A `DebounceTimer` — decorations are recomputed after user stops typing for the configured interval (default 200ms). This prevents jank on every keystroke.
- A `DecorationCache` — previous decoration set, used to diff and minimize repaints
- A reference to the `EmdDocument` AST if one was provided by the host

The `update()` method is the single entry point. It receives a `ViewUpdate` from CodeMirror containing the old and new EditorState, the old and new document text, and information about which transactions occurred. The method:
1. Checks if the document actually changed (skip if not)
2. Resets the debounce timer
3. When the timer fires, calls `rebuildDecorations(state)`
4. `rebuildDecorations` walks the syntax tree, calls each sub-feature's decoration builder, collects all decorations, and returns the merged set
5. If an EmdDocument AST is available, structural decorations (badges, progress bars) are computed from the AST rather than from regex on the raw text

## Performance Constraints

- 1000-line document: full decoration rebuild under 16ms (one frame at 60fps)
- Debounce prevents rebuilds on every keystroke — only on pause
- Decoration diff: unchanged decorations are not re-applied to the DOM
- Widgets are reused across frames where possible (CodeMirror's widget lifecycle handles this)
- Large documents (10K+ lines): only visible viewport decorations are computed via CodeMirror's viewport-aware decoration system

## Edge Cases

- **Nested sections**: EMD supports `###` subsections under `##` sections. The lezer tree represents these as nested heading nodes. Type/status badges apply at every heading level.
- **Mixed content**: A section may contain markdown text, code blocks, links, and wiki-links interleaved. Decorations from different sub-features can overlap. Priority order: widgets first (they replace their range entirely), then hide decorations (they remove syntax markers), then style decorations (they paint over remaining text).
- **Undo/redo**: When the user undoes a change, CodeMirror replays the previous state and the ViewPlugin receives a new update. Decorations are rebuilt from the new state. The AST (if used) must be re-parsed from the new document text.
- **Empty document**: No decorations produced. The placeholder extension handles the "Start writing..." prompt.
- **Very long lines**: Code blocks can be thousands of characters. Widget decorations replace the entire code block region with a single widget, so no per-character decorations are computed for the block content.
- **Concurrent edits**: If the user types while a decoration rebuild is in progress, the timer is reset and the previous rebuild is discarded. Only the latest state matters.
- **Memory**: Decoration sets are immutable in CodeMirror 6. Old sets are garbage collected. Widget DOM elements are cleaned up by CodeMirror when their decoration is removed.

## Relationship to Other Sub-Features

Fa-LiveMd is the **parent** sub-feature. It orchestrates Fa1 through Fa8. It does not produce decorations itself. It calls each sub-feature's decoration builder function, passing the syntax tree and EmdDocument AST, and merges the results. Each sub-feature is a pure function: `(tree, ast, config) → Decoration[]`. Fa-LiveMd owns the lifecycle (ViewPlugin, debounce, caching) and the merge logic. The sub-features own their specific decoration logic.

This separation exists so that each sub-feature can be built, tested, and optimized independently. An agent working on Fa3-LinkRenderer does not need to understand how Fa1-SyntaxHider works. They only need to know the input contract (syntax tree + AST + config) and the output contract (Decoration[]).

## Testing Approach

- **Unit tests**: Each sub-feature tested in isolation with mock syntax tree nodes and mock config
- **Integration tests**: Full Fa-LiveMd ViewPlugin tested with a real CodeMirror instance, real markdown input, and real EmdDocument AST
- **Visual regression**: Screenshot comparison of rendered decorations for known .emd files
- **Performance**: Benchmark decoration rebuild time for 100, 1000, and 10000 line documents
- **Cross-browser**: Chrome, Firefox, Safari — CodeMirror 6 abstracts browser differences but widget DOM and CSS can vary
