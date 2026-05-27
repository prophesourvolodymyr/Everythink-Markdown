# Fa7-InlineWidgets — Interactive Inline Element Rendering

The decoration sub-feature that renders small interactive UI elements embedded directly within the text flow. Unlike the large block widgets produced by Fa6-BlockResolver which replace entire code block regions, inline widgets are positioned at specific character offsets and flow with surrounding text — a checkbox between list items, a progress bar below a heading, an approve button next to a human checkpoint. These elements are part of the document's visual fabric and behave as if they are native parts of the text.

## Why This Exists

EMD sections carry semantic structure that benefits from interactive visualization. A task section with five checklist items is more useful when the user can click checkboxes to toggle completion rather than manually editing `- [ ]` to `- [x]`. A human checkpoint section is more actionable with a visible approve/reject button than with a textual status indicator alone. A section with dependencies is more understandable when a progress bar shows how many of its child tasks are complete. Inline widgets provide this interactivity without disrupting the editing experience — the user still edits text, but certain text patterns become clickable controls.

Inline widgets differ from Fa6-BlockResolver widgets in three important ways. First, they are character-synchronized: they replace specific syntax patterns in the text, and their interactive state is always reflected in the underlying document characters (clicking a checkbox changes ` ` to `x` in the source). Second, they are small and inline: they occupy roughly one line height and do not create large block-level layout disruptions. Third, they are always present: unlike block widgets which may be lazy-loaded, inline widgets render synchronously because they are simple DOM elements with no external dependencies.

## The Widget Types

Fa7-InlineWidgets handles four categories of inline interactive elements, each replacing a specific syntax pattern in the document text.

**Task checkboxes** replace the `- [ ]` and `- [x]` syntax patterns in task list items. The checkbox is a styled checkbox input element that visually replaces the bracket-and-space or bracket-and-x pattern. Checking an unchecked box dispatches a CodeMirror transaction that replaces the space character inside the brackets with an `x`, toggling the item's completion state. Unchecking a checked box replaces the `x` with a space. The visual checkbox reflects the current state from the document text — there is no separate state store. If the user manually types `x` or space inside the brackets, the checkbox updates on the next decoration rebuild.

The checkbox is sized to match the line height and uses the theme's accent color for the checked state. The checkbox's `change` event is handled by dispatching a transaction rather than directly manipulating the DOM, ensuring that undo/redo works correctly — each checkbox toggle is a single undoable action.

**Progress bars** appear below the heading of a task section that contains checklist items. The progress bar reads the child content of the section from the EmdDocument AST, counts the total number of checklist items and the number that are checked, and renders a thin horizontal bar with a filled portion proportional to the completion ratio. The bar's fill color transitions from red (low completion) through amber (medium) to green (high or complete). The exact color is interpolated based on the completion percentage. The bar also displays a text label like "3 of 7 completed" next to the bar or overlaid on it.

The progress bar is a widget decoration positioned at the end of the section heading line. When the user toggles a checkbox within that section, the progress bar recalculates its fill percentage on the next decoration rebuild. The progress bar does not accept direct interaction — it is a display-only element. Its purpose is to provide immediate visual feedback on section progress without requiring the user to manually count checkboxes.

**Human approval buttons** appear in `[human]` sections. These sections represent decision points where a human must explicitly approve or reject before automated workflows continue. The buttons replace the section's default inline content area (or appear alongside the section text) with two buttons: "Approve" (green) and "Reject" (red). Clicking Approve dispatches a transaction that changes the section's status to `|done` and appends a timestamp comment. Clicking Reject changes the status to `|cancelled` and optionally prompts for a rejection reason.

The buttons are positioned as a widget decoration covering the section's content area. When the section status changes (whether via button click or manual edit), the buttons update or disappear. A done section shows no approve/reject buttons; a pending human section shows both; a cancelled human section shows only the rejection reason.

**Link popover** appears when the user hovers a wiki-link or semantic link for a short duration (300ms). The popover is a small floating panel positioned above or below the link text, containing the target file's title, section summary, status badge, and a one-line excerpt. The popover content is loaded asynchronously from the EmdIndex via F1-EmdCore's ContextLoader.

The popover is implemented as a CodeMirror tooltip (using the `@codemirror/view` tooltip system) rather than as a widget decoration, because tooltips float above the text and do not affect layout. The popover appears only when the link target can be resolved; broken links show no popover. The popover disappears when the mouse moves away from the link or when the user types in the editor.

## Widget Lifecycle

Inline widgets share a simpler lifecycle than block widgets. They are created synchronously during decoration rebuild, positioned at a fixed character offset, and destroyed when their decoration is removed (which happens when the user edits the text pattern they replace). There is no lazy loading and no external resource fetching. The widget's initial render reads the current document state; subsequent state changes come through the decoration rebuild cycle, not through an explicit update call.

Each inline widget is a small, self-contained DOM element. Checkboxes are `<input type="checkbox">` elements. Progress bars are `<div>` elements with a filled inner div. Buttons are `<button>` elements. All inline widgets are styled through CSS classes that reference the theme's custom properties.

## Write-Back Mechanism

Like Fa6-BlockResolver widgets, inline widgets communicate state changes by dispatching CodeMirror transactions rather than manipulating the DOM directly. A checkbox click dispatches a transaction that replaces the character at position N inside `[ ]` with `x`. A button click dispatches a transaction that replaces the status annotation in the section header. This ensures that all changes are undoable, that the document text is always the source of truth, and that collaborative editing (future feature) would receive these changes as regular document operations.

The write-back is immediate — there is no debouncing for inline widgets because the operations are simple single-character or single-token replacements. The user sees instant feedback: click a checkbox, it toggles visually, and the underlying text changes. The decoration rebuild that follows confirms the visual state matches the text state.

## Edge Cases

The most important edge case is the user manually editing the text pattern that an inline widget replaces. If the user types inside `[ ]` to change ` ` to `x` manually, the next decoration rebuild will render a checked checkbox — the same result as clicking the widget. There is no conflict between manual editing and widget interaction; both modes converge to the same document state.

Another edge case is rapid clicking: a user rapidly clicking a checkbox many times should not queue up multiple transactions that interfere with each other. Each click dispatches a transaction immediately. CodeMirror's transaction system applies them sequentially, and each transaction sees the result of the previous one. Rapid clicking produces a rapid toggle sequence, which is the expected behavior.

A progress bar for a section with no checklist items should not appear. The progress bar only renders when the section has at least one checkbox child. A section with zero checkboxes shows no progress bar — the absence of a bar is intentional, not an omission.

A link popover for a very long target summary should truncate with an ellipsis and offer a "view more" link. The popover has a maximum width and maximum content height to prevent oversized popovers from obscuring the document.

## Relationship to Other Sub-Features

Fa7-InlineWidgets depends on Fa1-SyntaxHider to hide the syntax characters that the inline widgets replace visually. A `- [ ]` pattern has its `- [ ]` hidden by the SyntaxHider and its checkbox rendered by InlineWidgets. The two sub-features coordinate their decoration ranges so they do not overlap.

Fa7-InlineWidgets coordinates with Fa4-StatusBadge for progress bar data. When a task section's heading shows a status badge and the section has a progress bar, the status badge may integrate the progress information (showing "3/7" on the status pill). This is a visual integration, not a data dependency — both sub-features read the same AST.

Fa7-InlineWidgets uses CSS variables from Fh-ThemeEngine for checkbox colors, progress bar fill colors, and button styling.

## Testing

Each inline widget type is tested in isolation: checkbox toggle updates document text, progress bar correctly counts checkboxes, approve/reject buttons change section status, link popover shows correct target information. Integration tests verify that inline widgets and their corresponding syntax hider decorations do not overlap or conflict. Performance tests verify that documents with hundreds of checkboxes render without lag.
