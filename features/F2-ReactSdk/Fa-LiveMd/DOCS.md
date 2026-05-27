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
        ├──▶ Fa7-InlineWidgets: insert checkbox, progress bar, approve buttons
        ├──▶ Fa8-ThemeEngine: CSS variable resolution, light/dark/high-contrast themes
        ├──▶ Fa9-SmartFolds: fold service, auto-fold rules, fold state extension
        └──▶ Fa10-FoldWidgets: SectionFoldWidget placeholders for folded sections
        │
        ▼
Decoration.set([...]) returned to CodeMirror
        │
        ▼
CodeMirror paints the styled view
```

All ten sub-features run in the same `ViewPlugin.update()` call. The order matters: syntax is hidden first so text measurements are accurate, then text is styled, badges and widgets are placed relative to the styled text positions, and fold widgets are applied last since they replace entire section ranges.

## Sub-Feature Summary

| # | Sub-Feature | Status | Input | Output | Tests |
|---|------------|--------|-------|--------|-------|
| Fa1 | SyntaxHider | ✅ Complete | Lezer tree, config | `Decoration.replace` for syntax marks | 12 |
| Fa2 | TextStyler | ✅ Complete | Lezer tree, config | `Decoration.mark` with CSS classes | 13 |
| Fa3 | LinkRenderer | ✅ Complete | Lezer tree, AST, config | `Decoration.mark` for wiki/semantic links | 15 |
| Fa4 | StatusBadge | ✅ Complete | Lezer tree, AST, config | `Decoration.widget` status dots/pills | 16 |
| Fa5 | TypeBadge | ✅ Complete | Lezer tree, AST, config | `Decoration.widget` type label pills | 12 |
| Fa6 | BlockResolver | ✅ Complete | Lezer tree, config | `Decoration.replace` block widgets | 17 |
| Fa7 | InlineWidgets | ✅ Complete | Lezer tree, config, state | `Decoration.widget` checkbox/progress/approve | 26 |
| Fa8 | ThemeEngine | ✅ Complete | Theme config | CSS variable resolution, theme CSS | 24 |
| Fa9 | SmartFolds | ✅ Complete | AST, config, state | `foldService`, auto-fold, fold state extension | 38 |
| Fa10 | FoldWidgets | ✅ Complete | AST, config, state | `Decoration.replace` SectionFoldWidget | (in Fa9) |
| Fa11 | Integration | ✅ Complete | All above together | E2E decoration set, public API, performance | 20 |

## Decoration Builder Architecture

The `BUILDERS` array in `view-plugin.ts` contains 8 decoration builder functions executed sequentially:

```ts
const BUILDERS: DecorationBuilder[] = [
  (tree, _ast, config, _state) => buildSyntaxHiderDecorations(tree, config.syntaxHider),
  (tree, _ast, config, _state) => buildTextStylerDecorations(tree, config.textStyler),
  (tree, _ast, config, state) => buildLinkRendererDecorations(tree, _ast, config, state.doc.toString()),
  (tree, _ast, config, _state) => buildStatusBadgeDecorations(tree, _ast, config.statusBadge),
  (tree, _ast, config, _state) => buildTypeBadgeDecorations(tree, _ast, config.typeBadge),
  (tree, _ast, config, state) => buildBlockResolverDecorations(tree, _ast, config.blockResolver, state),
  (tree, _ast, config, state) => buildInlineWidgetDecorations(tree, _ast, config.inlineWidgets, state),
  (_tree, _ast, config, state) => buildFoldWidgetDecorations(_ast, config.smartFolds, state),
];
```

Each builder receives `(tree: Tree, ast: EmdDocument | null, config: LiveMdConfig, state: EditorState)` and returns `Range<Decoration>[]`. The results are merged via `Decoration.set(allRanges, true)` which sorts by priority and handles overlapping ranges.

**Decoration priority order:** Widget > Replace > Mark. Fold widget decorations (`Decoration.replace` with embedded widget) are produced by the last builder and replace entire section ranges, naturally overriding decorations from earlier builders within folded sections.

**Rebuild triggers:**
- Document changed (`update.docChanged`)
- Fold state changed (detected by comparing serialized fold range keys — `foldStateChanged`)
- Manual call to `LiveMdPlugin.rebuild()`

**Debounce:** Decorations are rebuilt after a configurable debounce delay (default 200ms). This prevents jank on every keystroke. The debounce timer is cleared on each new update before a rebuild has fired, ensuring only the latest state is used.

## Input Contract

Fa-LiveMd receives from the host application:
- A `CodeMirror 6 EditorView` instance with `@codemirror/lang-markdown` loaded
- A `LiveMdConfig` object specifying which EMD features to enable, theme preference, debounce timing, and widget registrations
- Optional: an `EmdDocument` AST from `@everthink/emd` for sections that need structural context (task progress bars need to count child checkboxes, graph sections need node/edge summary)

The syntax tree from lezer is always available via `syntaxTree(state)`. For standard markdown decorations (hiding `**`, styling headings), the lezer tree alone is sufficient. For EMD-specific decorations (status badges, type badges, semantic link coloring, fold service), the EmdDocument AST is needed because lezer does not understand EMD section header syntax.

## Output Contract

Fa-LiveMd produces:
- A `Decoration.set` — the standard CodeMirror 6 decoration collection containing HideDecoration (replace), MarkDecoration (style), WidgetDecoration (embed DOM), and LineDecoration (gutter) objects
- The decoration set is applied to the EditorView via the ViewPlugin's `decorations` field
- All decorations are range-based: each decoration specifies a `from` and `to` byte offset in the document
- Widgets are positioned at their decoration range's `from` offset and flow with the text as the user edits

## Internal Architecture

The ViewPlugin class holds:
- A `LiveMdConfig` reference (theme, enabled features, widget registry, all 8 sub-configs)
- A `DebounceTimer` — decorations are recomputed after user stops typing for the configured interval (default 200ms). This prevents jank on every keystroke.
- An `ast` reference to the EmdDocument AST if one was provided by the host
- A `DecorationSet` produced by the last rebuild

The `update()` method is the single entry point. It receives a `ViewUpdate` from CodeMirror containing the old and new EditorState, the old and new document text, and information about which transactions occurred. The method:
1. Checks if the document actually changed or if fold state changed (skip if neither)
2. Resets the debounce timer
3. When the timer fires, calls `rebuildDecorations(state)`
4. `rebuildDecorations` walks the syntax tree, calls each of the 8 builder functions, collects all decorations, and returns the merged set
5. If an EmdDocument AST is available, structural decorations (badges, progress bars, fold widgets) are computed from the AST rather than from regex on the raw text

### Public API

`LiveMdPlugin` exposes two public methods in addition to the standard ViewPlugin lifecycle:

```ts
class LiveMdPlugin implements PluginValue {
  /** Forces an immediate rebuild of all decorations. Bypasses debounce. */
  rebuild(): void;

  /** Clears the debounce timer and cleans up the block resolver view reference. */
  destroy(): void;
}
```

### Fold State Detection

Fold changes are detected by comparing serialized fold range keys rather than relying on object reference comparison:

```ts
private foldStateChanged(update: ViewUpdate): boolean {
  const collectRanges = (state: EditorState): string => {
    const parts: string[] = [];
    foldedRanges(state).between(0, state.doc.length, (from, to) => {
      parts.push(`${from}:${to}`);
      return false;
    });
    return parts.join(',');
  };
  return collectRanges(update.startState) !== collectRanges(update.state);
}
```

This is more robust than the previous `foldedRanges(s1) !== foldedRanges(s2)` reference comparison because it explicitly compares the content of fold ranges rather than relying on CodeMirror's internal caching behavior.

### Auto-Fold on Load

When `smartFolds.enabled` is true and `autoFoldRules` are provided, the plugin folds matching sections on initialization via a `setTimeout(0)` in the constructor. The auto-fold rules support filtering by `type`, `status`, and `level`.

## Performance Constraints

- 500-section document: full decoration rebuild under 50ms (verified by integration test benchmark)
- 1000-line document: full decoration rebuild under 16ms (one frame at 60fps)
- Debounce prevents rebuilds on every keystroke — only on pause
- Decoration diff: unchanged decorations are not re-applied to the DOM (CodeMirror handles this)
- Widgets are reused across frames where possible (CodeMirror's widget lifecycle handles this)
- Large documents (10K+ lines): only visible viewport decorations are computed via CodeMirror's viewport-aware decoration system

## Testing Approach

- **Unit tests** (180 tests): Each sub-feature tested in isolation with mock syntax tree nodes, real EditorState, and mock configs
- **Integration tests** (20 tests): Full Fa-LiveMd ViewPlugin tested with real CodeMirror instances, real markdown input, and real EmdDocument ASTs. Covers all 8 builders coexisting, auto-fold on init, debounce, fold/unfold lifecycle, public API, fold state change detection, and a 500-section performance benchmark
- **Visual regression**: Screenshot comparison of rendered decorations for known .emd files
- **Performance**: Benchmark decoration rebuild time for large documents — 500 sections in <50ms
- **Cross-browser**: Chrome, Firefox, Safari — CodeMirror 6 abstracts browser differences but widget DOM and CSS can vary

## Edge Cases

- **Nested sections**: EMD supports `###` subsections under `##` sections. The lezer tree represents these as nested heading nodes. Type/status badges apply at every heading level.
- **Mixed content**: A section may contain markdown text, code blocks, links, and wiki-links interleaved. Decorations from different sub-features can overlap. Priority order: widgets first (they replace their range entirely), then hide decorations (they remove syntax markers), then style decorations (they paint over remaining text).
- **Undo/redo**: When the user undoes a change, CodeMirror replays the previous state and the ViewPlugin receives a new update. Decorations are rebuilt from the new state. The AST (if used) must be re-parsed from the new document text.
- **Empty document**: No decorations produced. The placeholder extension handles the "Start writing..." prompt.
- **Very long lines**: Code blocks can be thousands of characters. Widget decorations replace the entire code block region with a single widget, so no per-character decorations are computed for the block content.
- **Concurrent edits**: If the user types while a decoration rebuild is in progress, the timer is reset and the previous rebuild is discarded. Only the latest state matters.
- **Memory**: Decoration sets are immutable in CodeMirror 6. Old sets are garbage collected. Widget DOM elements are cleaned up by CodeMirror when their decoration is removed.
- **Auto-fold + manual fold interplay**: Auto-fold rules execute on initialization and produce fold ranges. These ranges are then picked up by the fold widget builder (builder #8) on the next rebuild, producing `SectionFoldWidget` placeholders. Manual folds via the fold gutter or keyboard shortcuts also trigger rebuilds via fold state change detection.

## Relationship to Other Sub-Features

Fa-LiveMd is the **parent** sub-feature of phase Fa-LiveMd (F2-ReactSdk). It orchestrates Fa1 through Fa10. It does not produce decorations itself — it calls each sub-feature's decoration builder function, passing the syntax tree and EmdDocument AST, and merges the results. Each sub-feature is a pure function: `(tree, ast, config, state) → Decoration[]`. Fa-LiveMd owns the lifecycle (ViewPlugin, debounce, caching, fold state detection) and the merge logic. The sub-features own their specific decoration logic.

This separation exists so that each sub-feature can be built, tested, and optimized independently. An agent working on Fa3-LinkRenderer does not need to understand how Fa1-SyntaxHider works. They only need to know the input contract (syntax tree + AST + config) and the output contract (Decoration[]).

Fa-LiveMd is consumed by Fb1-EmdEditor (the React `<EmdEditor>` component) which wraps the CodeMirror instance in a React component, provides the LiveMdConfig from props, and manages the EmdDocument AST lifecycle.

## Dependencies

- `@codemirror/view` — EditorView, ViewPlugin, Decoration, WidgetType
- `@codemirror/state` — EditorState, Range, StateField
- `@codemirror/language` — syntaxTree, foldedRanges, foldEffect, foldState, foldService
- `@codemirror/lang-markdown` — markdown, markdownLanguage
- `@lezer/common` — Tree
- `@everthink/emd` — EmdDocument, EmdSection types
