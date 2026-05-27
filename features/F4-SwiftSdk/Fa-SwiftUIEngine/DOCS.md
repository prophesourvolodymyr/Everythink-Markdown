# Fa-SwiftUIEngine — NSAttributedString Rendering Engine

The live preview engine for the Swift SDK. Transforms the EmdDocument AST into NSAttributedString instances with styled attributes, hidden character ranges, and inline text attachments. The attributed string is the universal text representation on Apple platforms — it drives SwiftUI Text views, UIKit UILabel, AppKit NSTextView, and accessibility announcements. Every visual and interactive aspect of the editor flows through this attributed string pipeline.

## How It Differs From the React and Rust Engines

The most fundamental difference is that NSAttributedString is a data object, not a rendering API. In the React SDK, Fa-LiveMd produces CodeMirror Decoration objects that instruct the DOM what to show and hide. In the Rust SDK, Fa-GpuiEngine produces GPUI element trees that are painted to GPU quads. In the Swift SDK, Fa-SwiftUIEngine produces an attributed string that is handed to a text view for display. The attributed string is inert — it carries all the styling information but does not participate in layout or interaction directly. The text view that displays it handles layout, scrolling, text selection, and click detection.

This means Fa-SwiftUIEngine does not need to handle hit testing, cursor positioning, or scroll management. Those are provided by the platform text system. The engine only needs to produce correctly styled text with the right attribute ranges and the right attachment positions. This is both simpler (less to implement) and more constrained (must work within the text system's capabilities).

The second difference is the edit mode strategy. Rather than having a "view mode" and "edit mode" transition like the GPUI SDK, the Swift SDK uses a single text view that toggles between styled display and raw EMD source based on the selection state. When no text is selected and the cursor is not in a section, the entire document shows styled text (syntax hidden). When the user clicks into a section, that section immediately shows the raw EMD source text in monospace font with all markers visible. Other sections remain styled. This provides a click-to-edit-anywhere experience without mode switching.

## Sub-sub-features

**Fa1-SyntaxHider** — builds an attributed string that excludes marker characters from the visible text. The engine constructs the string by iterating the AST nodes and appending only the content text, skipping marker ranges. The raw text with markers is stored in a parallel `sourceText: String` property. When the user clicks into a section to edit, the text view replaces the styled attributed string with the raw source string in monospace font. The cursor position is mapped from the attributed string character index to the corresponding source text index using an offset map built during string construction.

**Fa2-TextStyler** — applies font, color, and paragraph style attributes to attributed string ranges. Bold nodes apply `NSFontAttributeName` with a bold font descriptor. Italic applies an italic descriptor. Headings apply larger font sizes (via `NSFontSizeAttribute`) and bold weight. Code spans apply a monospace font and a subtle background color via `NSBackgroundColorAttributeName`. Blockquotes apply a paragraph style with a head indent and a custom `NSBlockQuoteAttribute`. All attribute values are derived from the current `EmdTheme` struct rather than hardcoded values.

**Fa3-LinkRenderer** — applies `NSLinkAttributeName` to link text ranges with a custom URL scheme (`emd://navigate?target=file.emd&section=Title`). The text view's delegate intercepts link clicks, parses the URL, and triggers the navigation callback. Link text also receives underline styling and the theme's accent color. Hover is not natively supported in attributed strings; a custom gesture recognizer on the text view detects long-press or right-click on link ranges and shows a popover via the text view's `willShowLinkPopover` or custom implementation.

**Fa4-StatusBadge** — creates small colored circle `NSTextAttachment` objects positioned at the status annotation offset. The attachment renders as a filled circle with the status color, sized to the line height. The attachment's accessibility label announces the status name. Tapping the attachment cycles the status or shows a picker.

**Fa5-TypeBadge** — creates pill-shaped `NSTextAttachment` objects with the type name in white text on the type's background color. The attachment renders as a rounded rectangle sized to fit the label text plus padding. Long-press shows a type conversion menu.

**Fa6-BlockResolver** — for code blocks, creates `NSTextAttachment` objects that contain a full `UIView` or `NSView` hosting the block widget. The attachment's bounds are the widget's preferred height and the full text view width. The widget view is a SwiftUI view wrapped in a hosting controller. The widget communicates changes back to the document model through a `Binding<String>` that updates the code block content.

**Fa7-InlineWidgets** — renders small inline elements as `NSTextAttachment` objects sized to the line height. Checkboxes are small tappable views that toggle state. Progress bars are thin colored rectangles in a container attachment. Human approval buttons are small button attachments. All inline widgets carry accessibility labels and traits.

**Fa8-ThemeEngine** — defines the `EmdTheme` struct with properties for every color, font, and spacing value used by the engine. Three presets: `.light`, `.dark`, `.highContrast`. The theme is an `@EnvironmentObject` in SwiftUI, allowing any view in the hierarchy to read theme values. Theme changes propagate instantly through SwiftUI's environment system without rebuilding the attributed string — only the text view needs to re-apply its display attributes.

## Apple Pencil Integration

The draw block widget uses PencilKit's `PKCanvasView` on iPad. The canvas view provides pressure-sensitive strokes, tilt-aware brush angles, palm rejection, and the standard PencilKit tool picker (pen, pencil, marker, eraser, lasso). The drawing data is exported to the same JSON command format used by the web canvas block, ensuring that a drawing created on iPad renders correctly in the browser and vice versa. PencilKit's built-in undo/redo integrates with the document's undo stack through a bridge that translates PencilKit undo events into document transactions.

## Accessibility

Every attributed string range that represents a semantic element carries an `NSAccessibilityAttributeName` with a descriptive label. Type badges announce their type name and section title. Status badges announce their status. Links announce their relation and target. Progress bars announce their completion percentage. The text view's accessibility tree is automatically generated from these attributes by the platform, requiring no additional accessibility code. The engine's responsibility is only to set the correct attributes on the correct ranges.

## Status: Not Started

Implementation begins after the C FFI bridge produces valid `EmdDocument` Swift structs. The attributed string construction is straightforward; the primary complexity is the edit mode transition and cursor position mapping between styled and raw text representations.
