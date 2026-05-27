# Fa4-StatusBadge — Section Status Indicator Rendering

The decoration sub-feature that renders small, color-coded status indicators next to every EMD section heading. A status badge transforms the raw text `|done` or `|in-progress` from a section header into a visual dot or pill that communicates the section's current state at a glance. This is one of the most visually impactful features of live preview — instead of reading status text, users see color-coded signals that their brain processes pre-attentively.

## Why This Exists

Raw EMD section headers like `## [task|in-progress] Build UI` contain status information that is critical for project tracking but visually indistinguishable from other header text when rendered without decoration. A developer scanning a large document needs to instantly identify which tasks are blocked, which decisions are finalized, and which specifications are still in flux. Status badges provide that instant recognition through color — green means done, amber means in progress, red means blocked — without the user needing to read any text.

The status badge also serves as the primary interaction point for changing a section's status. Clicking the badge cycles through the relevant statuses for that section type, or opens a dropdown for direct selection. This is faster and less error-prone than manually editing the status text in the section header.

## Status Values and Color Mapping

EMD defines seven status values, each with a distinct visual treatment:

**Done** receives a solid green circle (or green background pill with a checkmark). Green universally signals completion in project management contexts. The exact green is `var(--emd-status-done, #22c55e)`.

**Pending** receives a hollow gray circle (or gray text pill with no icon). Gray signals inactivity — the task exists but no work has started. The muted appearance helps pending items recede visually so they do not compete for attention with active items. The gray is `var(--emd-status-pending, #9ca3af)`.

**In-progress** receives a solid amber or yellow circle (or amber pill with a play icon). Amber signals active work — this is the most attention-grabbing status because items in progress represent current commitments. The amber is `var(--emd-status-in-progress, #f59e0b)`.

**Blocked** receives a solid red circle (or red pill with a stop icon). Red signals danger or obstruction — this item cannot proceed until its dependencies are resolved. Blocked items stand out visually so they are not ignored. The red is `var(--emd-status-blocked, #ef4444)`.

**Archived** receives a gray circle with a strikethrough line through it (or gray pill with an archive box icon). Archived items are historical records — they should be readable but visibly retired. The strikethrough conveys "this is no longer active." The gray is `var(--emd-status-archived, #6b7280)`.

**Cancelled** receives a gray circle with a subtle X mark (or gray pill with italic text). Cancelled items were planned but deliberately abandoned. The italic styling differentiates cancelled items from archived ones — archived items were completed and retired; cancelled items were never finished. The gray is the same as archived.

**Unknown** receives a dashed-border empty circle (or a question mark pill). Unknown status means the parser could not parse the status text in the section header. This is a validation warning, not a legitimate status. The visual treatment is intentionally different from any real status to alert the user that the section header needs correction.

## How Status Is Extracted

Status badges do not extract the status from the raw text via regex. Instead, they read the `status` field from the `EmdSection` struct in the EmdDocument AST produced by F1-EmdCore's parser. This guarantees accuracy: if the parser could not parse the status, it emits `SectionStatus::Unknown` and the badge shows the unknown-indicator, prompting the user to fix the header. If the parser parsed the status successfully, the badge shows the correct color and label.

The badge's position is determined by the location of the status annotation in the section header. The parser records the source span for the status text. Fa4-StatusBadge creates a widget decoration at that span's starting position. The widget replaces the raw status text (`|done`, `|in-progress`, etc.) in the visual rendering while the underlying text in the document remains unchanged.

## Interactive Behavior

Clicking a status badge triggers a status change. The behavior depends on the status action context:

**Single-click on a status badge** cycles through the most common status transitions for that section type. For a task section, clicking "pending" cycles to "in-progress," clicking "in-progress" cycles to "done," clicking "done" cycles to "archived." The cycle skips irrelevant statuses — a task section never cycles to "cancelled" through a single click because that is a destructive transition.

**Right-click on a status badge** opens a context menu with all seven status options, each with its color indicator. The user selects the desired status directly. This allows access to all statuses without cycling.

**Keyboard shortcut** (configurable, default: `Cmd+Shift+S`) opens a status picker popup at the current section. The user types to filter or arrows to select.

When a status change is triggered, the sub-feature dispatches a CodeMirror transaction that replaces the status text in the document. The parser re-parses the affected section and the badge updates to reflect the new status. If the parser validates the new status transition (e.g., warns about moving from "done" back to "pending"), the diagnostic appears as a subtle indicator on the badge.

## How the Badge Updates on Manual Edit

When the user manually edits the section header status text (typing `|done` instead of clicking the badge), CodeMirror's document change triggers a re-parse via the debounced update cycle in Fa-LiveMd. The new AST is produced, Fa4-StatusBadge reads the new status value, and the badge updates accordingly. There is no separate synchronization mechanism — manual edits and programmatic changes both flow through the same parse → decorate pipeline.

## Status Inheritance and Derived Status

Some sections do not have an explicit status but derive their status from their children. For example, a parent task section with no `|status` annotation might show an aggregated status badge based on its child tasks: if all child tasks are done, the parent shows a green badge with a count ("3/3"). If some are in progress, it shows an amber badge with count ("1/3"). This derived status is computed by Fa7-InlineWidgets (the progress bar sub-feature) but rendered as a status badge by Fa4-StatusBadge. The two sub-features coordinate through the shared EmdDocument AST.

## Edge Cases

The most common edge case is a section header with a malformed status that the parser cannot parse, resulting in `SectionStatus::Unknown`. The badge displays a question mark and a dashed border. Hovering the badge shows the parser's diagnostic message explaining why the status could not be parsed.

A section with no status annotation at all (like `## [task] Build UI` without `|pending`) does not receive a status badge. The absence of a badge is itself information — it means the section's status has not been explicitly set. F1-EmdCore's validator may emit a warning diagnostic suggesting that a status should be added.

Sections that are not of types that typically carry status — Summary, Detail, Meta, Log — can technically have a status annotation in the EMD spec, but the parser does not enforce status relevance by section type. The badge renders regardless. If the validator adds constraints in the future (e.g., "warning: [summary] sections should not have a status"), the badge would reflect that through its diagnostic indicator.

## Relationship to Other Sub-Features

Fa4-StatusBadge is positioned adjacent to Fa5-TypeBadge in the section header. Together they form a badge pair: the type badge on the left showing what kind of section this is, and the status badge on the right showing its current state. They share the same widget positioning logic but are separate decoration sets so they can be styled independently.

Fa4-StatusBadge coordinates with Fa7-InlineWidgets for task progress calculation. When a task section has child checkboxes, Fa7 computes the completion ratio and Fa4 may display it as part of the status badge (e.g., a green badge showing "3/5" instead of just a green dot).

Fa4-StatusBadge receives its color values from the CSS custom properties defined by Fh-ThemeEngine. The colors are resolved at render time from the current theme, allowing instant theme switching without recomputing decorations.

## Testing

Status badge rendering is tested by creating EmdDocument ASTs with every status value, rendering the badges, and verifying the correct color and icon for each status. Interactive tests verify that clicking a badge changes the underlying document text and the badge updates accordingly. Edge case tests verify the unknown status rendering for malformed statuses and the correct handling of missing status annotations.
