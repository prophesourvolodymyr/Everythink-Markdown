# Fa3-LinkRenderer — Semantic and Wiki Link Rendering

The decoration engine that transforms EMD's three link types — wiki-links, semantic links, and standard markdown links — into interactive, color-coded elements within the live preview editor. Links in EMD are not passive text; they are typed relationships that carry semantic meaning. A `→ depends: design.emd` link is fundamentally different from a `→ implements: spec.emd` link, and both are different from a standard `[click here](https://example.com)` link. Fa3-LinkRenderer makes these differences visible at a glance through color coding, badge rendering, and interactive behaviors like hover previews and click navigation.

## The Three Link Types

Fa3-LinkRenderer handles three distinct link syntaxes, each with different rendering requirements and interactive behaviors.

**Wiki-links** use the `[[target]]` syntax. The double brackets are hidden by Fa1-SyntaxHider, leaving the target text visible. Wiki-links point to other `.emd` files within the project (relative paths) or to sections within files using the `[[file.emd#Section-Title]]` anchor syntax. Wiki-links are rendered with an internal link color (typically the theme's accent color) and a small document icon indicating this is a local file reference. Clicking a wiki-link triggers navigation: in the standalone editor, it opens the target file in a new tab; in the SDK embed mode, it fires a callback that the host application handles. Hovering a wiki-link shows a popover with the target file's title, summary, and status — this information is loaded from the EmdIndex via F1-EmdCore's ContextLoader.

**Semantic links** use the `→ relation: target` syntax. The arrow is hidden by Fa1-SyntaxHider. The relation name (`depends`, `blocks`, `implements`, `satisfies`, `triggers`, `models`, `configures`, `prompts`, `tests`, `documents`, `alternative-to`, `replaces`, `supersedes`, `contradicts`, `relates`, `example`, `generates`, `calls`, `inherits`, and any custom relation) is rendered as a small colored badge. The badge color is determined by the relation category: dependency relations (depends, blocks, triggers) use warm colors like amber or red; implementation relations (implements, satisfies) use green; documentation relations (documents, example) use blue; conflict relations (contradicts, supersedes) use red or orange; neutral relations (relates) use gray. The target path is rendered after the badge as clickable text. The entire link line is a single CodeMirror widget that occupies the visual space of the link line but whose underlying text remains the raw `→ depends: file.emd` string.

**Standard markdown links** use the `[text](url)` syntax. The bracket and parenthesis characters are hidden by Fa1-SyntaxHider. The link text is rendered with underline and the theme's link color. External URLs (starting with `http://` or `https://`) receive an external link icon. Internal file references receive the same treatment as wiki-links. Clicking an external link opens it in the default browser. Clicking an internal link navigates to the target.

## Wiki-Link Resolution

When a wiki-link is encountered, the renderer must determine whether the target exists and what to display. The resolution process uses the EmdIndex from F1-EmdCore's ContextLoader: the target path is normalized (relative to the current file's directory), the `.emd` extension is appended if missing, and the index is queried for a matching entry. If the target exists, the link is rendered with the "internal, exists" style (blue, solid underline). If the target does not exist, the link is rendered with the "broken link" style (red, dashed underline) and a warning diagnostic is emitted. If the anchor part references a section that exists in the target file, a section icon is added to the popover. If the anchor section does not exist, the link still resolves to the file but shows a "section not found" warning in the popover.

For relative links like `[[../sibling.emd]]` or `[[subdir/file.emd]]`, the path is resolved relative to the current file's directory. For absolute links like `[[/project/docs.emd]]`, the path is resolved from the workspace root.

## Semantic Link Badge Rendering

Each semantic link receives a badge widget rendered inline. The badge is a small rounded pill containing the relation name in lowercase, colored by relation category. The badge is approximately the height of one line of text and its width is determined by the relation name length plus padding. After the badge, the target text appears with file icon and clickable styling.

The badge's color mapping is configurable through the theme system. Each relation category maps to a CSS custom property: `--emd-link-dependency`, `--emd-link-implementation`, `--emd-link-documentation`, `--emd-link-conflict`, `--emd-link-neutral`. Custom relations default to the neutral color. The badge text color is automatically computed for contrast against the badge background — white text on dark backgrounds, dark text on light backgrounds.

The badge's interactive behavior: clicking the badge is equivalent to clicking the target link — it navigates to the target file. Right-clicking the badge opens a context menu with options to open in a new tab, copy the target path, or show the relation graph (a diagram of all relations involving this link).

## Hover Previews

Hovering any link triggers a small popover after a short delay (300ms to prevent flickering during fast mouse movement). The popover contains:
- The target file name and path
- The target section title and type badge
- The target section status (with colored dot)
- A one-line excerpt of the target section's content (first paragraph)
- If the link is a semantic link, the relation type and its description

The popover content is loaded asynchronously. A lightweight skeleton placeholder appears immediately, and the content fills in once the ContextLoader returns. The popover positions itself above or below the link depending on available space, with an arrow pointing at the link text.

## Cmd+Click Navigation

On macOS (Cmd+Click) and Windows/Linux (Ctrl+Click), clicking a link triggers immediate navigation without waiting for the popover or the single-click delay. This is the standard CodeMirror behavior and is implemented by registering a click event handler on the link's widget DOM element that checks the event's metaKey or ctrlKey property, calls the host application's navigation callback, and prevents the default click behavior.

## Right-Click Context Menu

Right-clicking any link opens a context menu with options to open the target in a new tab, open the target in a split view, copy the target path to clipboard, copy the target file name, reveal the target in the file explorer, or show all incoming and outgoing links to the target (a "link graph" view). Each option delegates to the host application through a callback interface.

## Transclusion Embedding

When a `![[file.emd]]` transclusion is encountered, Fa3-LinkRenderer does not render it as a link. Instead, it delegates to Fa6-BlockResolver to embed the referenced file's content inline as a read-only block. The transclusion syntax (`![[` and `]]`) is hidden by Fa1-SyntaxHider. The embedded content is a widget that renders the target file's sections using the same rendering pipeline, but in a read-only mode with a subtle border and a header showing the source file name and a link to open it.

## Edge Cases

The most common edge case is a link to a file that has been moved or renamed. Broken links are detected during validation and rendered with a red dashed underline. A code action is offered: "Rename link to closest match" uses fuzzy matching against the EmdIndex to suggest the new file path.

Links that form circular dependencies are detected by the validator during document parsing. A small circular-arrow icon appears on links that participate in a circular dependency chain, and the popover shows the full cycle.

Links with conditions (`→ depends: file.emd [condition: if auth enabled]`) show the condition text in a smaller, italic font after the link. The condition is displayed but not evaluated by the link renderer — condition evaluation is the responsibility of the agent runtime.

Links inside code blocks and HTML blocks are not rendered as links. The tree walk excludes descendants of FencedCode and HTMLBlock nodes. Links inside inline code spans (single backticks) are treated as literal text and not decorated.

Links to sections that have been deleted but whose link text remains produce a "stale link" diagnostic. The link is rendered with a yellow underline and a warning icon instead of the standard file icon.

## Relationship to Other Sub-Features

Fa3-LinkRenderer depends on Fa1-SyntaxHider to hide the bracket and parenthesis characters. It depends on Fa2-TextStyler to apply underline and color styling to the visible link text (or it applies its own styles if configured to do so). It depends on Fa6-BlockResolver to handle transclusion embedding. It depends on F1-EmdCore's ContextLoader (via WASM) for link resolution and popover content. It does not depend on Fa4-StatusBadge or Fa5-TypeBadge, but those badges may appear in the popover when showing target section information.

## Testing

Link rendering is tested by creating documents with each link type, verifying the visual output (badge color, link style, icon), testing resolution against a mock EmdIndex, verifying hover popover content, testing Cmd+Click navigation, and verifying broken link styling when targets do not exist. Performance tests measure link resolution time for documents with hundreds of links.
