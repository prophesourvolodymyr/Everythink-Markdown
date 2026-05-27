# Fa1-SyntaxHider — Markdown Syntax Character Hiding

The decoration engine that makes raw markdown text appear as styled document text by hiding the formatting characters that would normally be visible. This is the foundational illusion of live preview: the user sees a heading, not `##` followed by text. They see bold text, not `**` wrapped around text. They click anywhere and the hidden characters reappear for editing.

## What It Hides

Fa1-SyntaxHider walks the lezer markdown syntax tree produced by `@codemirror/lang-markdown` and identifies every syntax marker node. For each marker node found, it creates a `Decoration.replace({})` that tells CodeMirror to render that range as zero-width — the characters exist in the document but occupy no visual space.

The specific markers hidden, grouped by markdown construct:

**Headings.** The `#` characters at the start of heading lines. In a `## My Heading` line, the `## ` prefix (including the space after the hashes) is hidden. The heading text itself remains visible and receives its styling from Fa2-TextStyler. For EMD section headers like `## [task|in-progress] Build UI`, the `##` prefix is hidden but the `[task|in-progress]` type-and-status annotation is NOT hidden by this sub-feature — that is handled by Fa4-StatusBadge and Fa5-TypeBadge which may choose to hide or restyle it.

**Bold and italic.** The `**` or `__` markers around bold text, and the `*` or `_` markers around italic text. In `**bold**`, both the opening `**` and closing `**` are hidden. The word "bold" remains visible and receives `font-weight: 700` from Fa2-TextStyler. In `***bold italic***`, all six asterisks are hidden and the text receives both bold and italic styling.

**Inline code.** The backtick markers around inline code spans. In `` `code` ``, the opening and closing backticks are hidden. The word "code" remains visible with monospace font and gray background from Fa2-TextStyler. Double-backtick spans like ``` ``code with ` inside`` ``` are also handled — both pairs of backticks are hidden.

**Links.** The `[` and `]` brackets around link text, and the `(` and `)` around URLs. In `[click here](https://example.com)`, all four bracket/paren characters are hidden. The link text "click here" remains visible and styled as a clickable link by Fa3-LinkRenderer. For wiki-links `[[file.emd]]`, the double brackets are hidden and the link text is styled. For semantic links `→ depends: file.emd`, the `→` arrow and the `: ` separator are hidden while the relation name and target remain visible as styled badges.

**Images.** The `![`, `]`, `(`, and `)` characters around image markup. In `![alt](url)`, the syntax characters are hidden. The image itself is rendered inline by a widget from Fa6-BlockResolver. The alt text is hidden when the image loads successfully.

**Code fences.** The opening and closing `` ``` `` markers of fenced code blocks. When Fa6-BlockResolver replaces the entire code block with a widget, the fence markers are included in the replaced range and need no separate hiding. When a code block has no registered widget handler, the fence markers are hidden and the code content is displayed with syntax highlighting.

**Blockquotes.** The `>` prefix on blockquote lines. In `> quoted text`, the `> ` is hidden and a vertical bar decoration is added by Fa2-TextStyler to visually indicate the blockquote.

**Horizontal rules.** The `---`, `***`, or `___` lines are replaced with a thin horizontal line widget.

**List markers.** The `-`, `*`, or `+` markers on unordered list items, and the `1.`, `2.` etc. markers on ordered list items. The marker is hidden and a bullet character (•) or number is rendered as a replacement widget by Fa7-InlineWidgets. For EMD task lists `- [ ]` and `- [x]`, the `- [ ]` or `- [x]` prefix is hidden and replaced with an interactive checkbox widget by Fa7-InlineWidgets.

## What It Does Not Hide

Several constructs are intentionally NOT hidden because their raw text is semantically meaningful to the user:

- **EMD section type annotations**: `[task]`, `[decision]`, `[api]` etc. in section headers. These are restyled by Fa5-TypeBadge rather than hidden.
- **EMD status annotations**: `|done`, `|in-progress`, `|blocked` etc. These are restyled by Fa4-StatusBadge rather than hidden.
- **EMD semantic link arrows**: `→` is hidden, but the relation name (`depends`, `blocks`, etc.) is restyled as a colored badge by Fa3-LinkRenderer.
- **EMD wiki-link targets**: The `[[` and `]]` are hidden, but the path/file.emd text is styled as a clickable internal link.
- **Transclusion markers**: `![[` and `]]` are hidden. The referenced content is embedded inline by Fa6-BlockResolver.

## How It Works

The sub-feature exports a single function: `buildSyntaxHiderDecorations(tree: Tree, config: Config) → Decoration[]`. The function walks the lezer syntax tree using the tree's cursor API. For each node encountered, it checks the node type name against a registry of known marker types. If the node type is a marker, a `Decoration.replace({})` is created covering the node's `from` to `to` range.

The node type names come from the lezer markdown grammar. Common type names include `HeaderMark`, `EmphasisMark`, `StrongEmphasisMark`, `CodeMark`, `LinkMark`, `URL`, `CodeFence`, `QuoteMark`, `ListMark`, `TaskMarker`, `HR`.

The `Decoration.replace({})` call accepts an optional `Widget` parameter. When no widget is provided (as is the case for most marker hiding), the replaced range becomes invisible and takes up zero horizontal space. Adjacent text reflows as if the hidden characters were never there.

For markers that need a visual replacement (like a bullet point replacing a list marker `-`), a small widget is created that renders the replacement character. This widget is sized to match the surrounding text height and inherits the text color from the theme.

## Edge Cases

- **Adjacent markers**: In `**bold** *italic*`, there are four hidden ranges that are adjacent. CodeMirror handles adjacent replace decorations by collapsing them into a single zero-width gap.
- **Empty emphasis**: `****` is invalid markdown but appears in malformed documents. The lezer parser may or may not produce emphasis nodes for empty spans. If it does, the markers are hidden and nothing visible remains. If it does not, no decorations are produced.
- **Escaped markers**: `\*\*not bold\*\*` — the backslash escapes are standard markdown and the lezer parser does not produce emphasis nodes for escaped markers. No hiding occurs.
- **Markers inside code blocks**: Code blocks are replaced wholesale by Fa6-BlockResolver widgets. The SyntaxHider skips any nodes that are descendants of a `FencedCode` or `HTMLBlock` node, because those blocks are handled by their widget renderer.
- **Markers inside links**: `[click **here**](url)` — the bold markers inside link text ARE hidden because they're valid markdown inside a link. The link text shows "click here" with "here" in bold.
- **Nested emphasis**: `***bold italic***` is parsed as strong emphasis containing emphasis. The outer `**` markers and inner `*` markers are all hidden. The text receives both bold and italic styling from Fa2-TextStyler.

## Performance

Syntax hiding is the cheapest decoration operation because `Decoration.replace({})` with no widget is just a range with zero rendering cost. The tree walk is O(n) in the number of syntax nodes. For a 1000-line document with typical markdown density, there are approximately 200-500 marker nodes. The walk and decoration creation takes under 2ms on modern hardware.

The `Decoration.replace` decorations are merged into a single `Decoration.set` by CodeMirror's internal set operations, which use a splay tree for O(log n) insertion and O(n) range queries.

## Relationship to Other Sub-Features

Fa1-SyntaxHider must run BEFORE Fa2-TextStyler. If text is styled before its markers are hidden, the styling ranges will include the markers, causing visual artifacts (a bold `**` character looks different from bold text). The order in Fa-LiveMd's `update()` ensures hiding runs first.

Fa1-SyntaxHider must coordinate with Fa6-BlockResolver: if a code block is being replaced by a widget, the SyntaxHider should not attempt to hide markers inside that block — the widget handles its own rendering. This is achieved by checking parent nodes during the tree walk.

Fa1-SyntaxHider is independent of Fa7-InlineWidgets: the SyntaxHider hides list markers and task checkbox syntax, while InlineWidgets creates the visual replacements (bullet points, checkboxes). They operate on adjacent but non-overlapping ranges.

## Testing

- Unit test: provide a mock lezer tree with known marker nodes, verify the correct number and position of `Decoration.replace` objects
- Unit test: verify that a node inside a `FencedCode` parent is NOT decorated
- Unit test: verify that escaped markers produce no decorations
- Integration test: render a document with every markdown construct, visually verify no raw markers are visible
- Edge case test: adjacent markers, nested emphasis, empty emphasis, escaped markers
