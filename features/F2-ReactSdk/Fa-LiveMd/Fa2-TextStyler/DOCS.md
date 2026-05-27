# Fa2-TextStyler — Inline Text Visual Styling

The decoration engine that translates lezer markdown syntax tree node types into CSS-backed visual styles applied to the corresponding text ranges. While Fa1-SyntaxHider removes the formatting characters so they are invisible, Fa2-TextStyler applies the visual transformation that makes the remaining text look like a styled document — bold text appears bold, headings appear large and heavy, code appears monospaced, and blockquotes gain a left border.

## Why This Exists

Raw markdown text in a monospace editor shows no visual hierarchy. A heading is just a line starting with `##`. A bold word is just surrounded by asterisks. Fa2-TextStyler provides the visual layer that makes the document structure perceivable at a glance. Unlike syntax highlighting, which only colors the raw text, Fa2-TextStyler changes font properties (weight, size, style, family), adds background colors, and inserts structural elements like quote bars. This is the difference between a code editor and a document editor.

The key design principle is that styles are derived from the lezer syntax tree node type, not from regex matching on the raw text. This guarantees correctness: only text that the parser identifies as a heading receives heading styling, only text inside emphasis markers receives italic styling, and so on. Regex-based approaches, common in simpler live preview implementations, break on edge cases like nested formatting, escaped characters, and code blocks containing markdown syntax.

## Style Mappings

The core of Fa2-TextStyler is a mapping table from lezer node type names to CSS style objects. Each mapping specifies `fontWeight`, `fontSize`, `fontStyle`, `fontFamily`, `color`, `backgroundColor`, `textDecoration`, `borderLeft`, and a `priority` value used for conflict resolution when multiple styles apply to the same text range.

Heading styles are the most prominent transformation. A `HeaderMark` node covering level-1 heading text receives the largest font size and heaviest weight. Level-2 headings receive a slightly smaller size. Level-3 through level-6 headings scale down progressively. The exact sizes and weights are configurable through the theme system, but sensible defaults are: H1 at 2em weight 700, H2 at 1.5em weight 600, H3 at 1.17em weight 600, H4 at 1em weight 600, H5 at 0.83em weight 600, H6 at 0.67em weight 600. The heading color defaults to the theme's primary text color but can be overridden to use the accent color for a more striking appearance.

Strong emphasis (bold) text within `StrongEmphasis` nodes receives `fontWeight: 700`. Regular emphasis (italic) within `Emphasis` nodes receives `fontStyle: italic`. When a node is both — `StrongEmphasis` containing an `Emphasis` child — both styles are applied, resulting in bold italic text. The priority system ensures that the innermost style wins when there is a conflict (for example, if a bold node is inside a heading, the heading's font size takes priority but the bold weight is added to it).

Inline code spans within `InlineCode` nodes receive `fontFamily: monospace`, a light background color (derived from the theme's secondary background), slightly reduced font size, and rounded borders to visually distinguish inline code from surrounding prose. The monospace font stack is configurable but defaults to the system monospace font.

Blockquotes receive a left border in the theme's accent color, typically 3-4 pixels wide, with left padding to indent the quoted text. Nested blockquotes (quote inside quote) receive progressively wider borders or changing border colors to indicate nesting depth.

Links identified by Fa3-LinkRenderer may receive underline and color styling from Fa2-TextStyler if the link renderer delegates text styling to this sub-feature. By default, links are styled with the theme's accent color and an underline, with visited links receiving a slightly desaturated color.

Horizontal rules are rendered as thin horizontal lines spanning the editor width with a muted color. The `HR` node's text (`---`, `***`, or `___`) is hidden by Fa1-SyntaxHider, and Fa2-TextStyler creates a line decoration on that line instead.

Strikethrough text (Github-Flavored Markdown extension: `~~text~~`) receives `textDecoration: line-through` when the lezer parser supports it. The tilde markers are hidden by Fa1-SyntaxHider.

Highlighted text using the `==text==` syntax (another GFM extension) receives a yellow background color. The equal-sign markers are hidden by Fa1-SyntaxHider.

## How Themes Feed Into Styles

All color values in the style mappings are references to CSS custom properties, not hardcoded hex values. The `color` property for heading text is `var(--emd-heading-color, var(--emd-text))`. The `backgroundColor` for inline code is `var(--emd-code-bg, var(--emd-bg-secondary))`. The `borderLeft` color for blockquotes is `var(--emd-accent)`. This indirection through custom properties means that switching the theme class on the editor container (`emd-theme-light` → `emd-theme-dark`) instantly changes all styled text without recomputing decorations. CodeMirror re-renders the styles because the CSS variables resolve to different values under each theme class.

The full set of CSS variables consumed by Fa2-TextStyler includes approximately 25 variables, all in the `--emd-` namespace. These are defined by Fh-ThemeEngine. Fa2-TextStyler does not define CSS variables; it only references them in its style objects.

## Performance

Styling is applied via `Decoration.mark()` which associates a CSS class or inline style with a text range. Unlike widget decorations, mark decorations do not create DOM elements — they only modify the attributes of existing text nodes. This makes them extremely cheap. A document with 500 styled ranges adds negligible overhead to CodeMirror's layout and paint cycles.

The tree walk to identify style-eligible nodes shares the same tree walk as Fa1-SyntaxHider. Rather than walking the tree twice, Fa-LiveMd's orchestrating `update()` method walks the tree once and dispatches each node to both Fa1 and Fa2 simultaneously. This shared walk means that adding Fa2-TextStyler adds no tree traversal overhead beyond the per-node style lookup and decoration creation, which is O(1) per node.

## Edge Cases

The most complex edge case is overlapping styles. A text range that is both bold and italic (`***text***`) should receive both `fontWeight: 700` and `fontStyle: italic`. A link that contains bold text (`[**bold link**](url)`) should be underlined (from the link style) and bold (from the emphasis). CodeMirror's decoration system handles overlapping mark decorations gracefully by applying multiple CSS classes to the same DOM text node, with CSS specificity rules determining which styles win. The priority field in Fa2-TextStyler's style mapping helps in cases where one style should override another: heading font size should always override inline bold font size, for example.

Another edge case is text inside code blocks. When a code block is rendered as a widget by Fa6-BlockResolver, the widget handles its own styling and Fa2-TextStyler should not style text inside the block. When a code block has no registered widget, it falls back to syntax-highlighted code view, which is handled by CodeMirror's built-in syntax highlighting, not by Fa2-TextStyler. The tree walk avoids CodeBlock and FencedCode descendant nodes for this reason, delegating styling to the widget or syntax highlighting system.

Text inside links that are also bold or italic: the link's color style and the emphasis style must both apply. This is handled by applying mark decorations for both styles. CSS cascading determines that the link color takes priority if both specify a color, and the emphasis weight/style is additive if they specify different properties.

## Relationship to Other Sub-Features

Fa2-TextStyler runs after Fa1-SyntaxHider because styles should be applied to the visible text ranges after markers are hidden. If styles were applied before hiding, the hidden marker characters would be styled (for example, the `##` would become large and bold, which defeats the purpose of hiding them).

Fa2-TextStyler does not handle type badge colors or status badge colors — those are the responsibility of Fa4-StatusBadge and Fa5-TypeBadge, which use widget decorations (not mark decorations) to insert DOM elements.

Fa2-TextStyler's style objects reference CSS custom properties defined by Fh-ThemeEngine. There is a loose coupling: Fa2-TextStyler assumes certain variable names exist, but Fh-ThemeEngine is responsible for defining their values under each theme class.

## Testing

Text styling is tested by rendering known markdown input, inspecting the resulting CodeMirror decorations, and verifying that the correct style attributes are applied to the correct text ranges. Performance benchmarks measure decoration build time for documents with many styled ranges. Visual regression tests compare screenshots of styled documents against known-good reference images.
