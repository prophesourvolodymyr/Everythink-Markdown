# Fa5-TypeBadge — Section Type Label Rendering

The decoration sub-feature that renders compact, color-coded type labels next to every EMD section heading. A type badge transforms the raw type annotation `[task]`, `[decision]`, `[api]`, etc. from a section header into a small visual pill that instantly communicates the section's semantic category. Combined with Fa4-StatusBadge, these two badges form the primary visual identity of every section — type on the left, status on the right, content in between.

## Why This Exists

In a large EMD document, sections of different types serve fundamentally different purposes. A `[task]` section represents work to be done. A `[decision]` section represents an architectural choice that was made. A `[api]` section defines an interface. Without visual differentiation, all sections look the same — the reader must parse the type annotation text to understand what each section represents. Type badges provide instant categorical recognition through color and icon, the same way a calendar app uses different colors for meetings, tasks, and reminders.

Type badges also serve as the primary interaction point for section type conversion. A developer who initially wrote a section as `[detail]` but later realizes it should be a `[decision]` can right-click the type badge, select "Decision" from the dropdown, and the underlying section header text updates from `[detail]` to `[decision]`. This preserves all section content while changing its semantic category.

## The 24 Section Types and Their Visual Identity

Each of the 24 EMD section types receives a unique color and, optionally, an icon. The visual identity is designed to create natural groupings that the eye can distinguish at a glance.

**Task-oriented types** use warm, action-oriented colors. Task (`[task]`) uses amber or orange — the color of "to-do" in virtually every productivity tool. Verify (`[verify]`) uses a slightly different shade of orange or coral to signal that verification is a task-adjacent activity. Bug (`[bug]`) uses red to signal a problem that needs fixing. Idea (`[idea]`) uses yellow to signal creativity and brainstorming.

**Decision and record types** use cool, authoritative colors. Decision (`[decision]`) uses teal or dark green — the color of finality and commitment. Spec (`[spec]`) uses blue to signal requirements and precision. Memory (`[memory]`) uses purple to signal stored knowledge. Log (`[log]`) uses gray to signal historical record. Meta (`[meta]`) uses a muted version of the primary accent color.

**Interface and configuration types** use structural colors. API (`[api]`) uses indigo or deep blue — the color of interfaces and protocols. Config (`[config]`) uses a muted blue-gray to signal system settings. Schema (`[schema]`) uses a lighter blue to signal data structure definitions. Model (`[model]`) uses violet to signal domain modeling. Example (`[example]`) uses green to signal "correct usage."

**Agent and automation types** use distinct high-contrast colors. Agent (`[agent]`) uses a vibrant color like magenta or fuchsia to signal autonomous behavior. Graph (`[graph]`) uses a structural color with a distinct node-edge icon. Prompt (`[prompt]`) uses a muted warm color. Template (`[template]`) uses a light, neutral color.

**Human interaction types** use colors that demand attention. Human (`[human]`) uses a bright, unique color — possibly orange-red or coral — because human checkpoints must stand out and not be missed during automated workflows.

**Visual and canvas types** use creative, expressive colors. Draw (`[draw]`) uses a creative color like pink or rose to signal freeform creation. Flow (`[flow]`) uses a diagram-appropriate blue-green. Kanban (`[kanban]`) uses a structured but warm color.

**Informational types** use neutral, readable colors. Summary (`[summary]`) uses the primary text color with a subtle border — summaries are the most common section type and should not visually overwhelm. Detail (`[detail]`) uses a slightly tinted version of the text color. These types appear so frequently that aggressive colors would create visual noise.

All colors are defined as CSS custom properties in the `--emd-type-*` namespace. Fh-ThemeEngine provides the values for light, dark, and high-contrast themes. The type badge reads the color from the CSS variable at render time, ensuring theme-appropriate contrast.

## How the Badge Renders

The type badge is a CodeMirror WidgetDecoration positioned at the start of the section heading, before the heading text. The widget renders as a small pill-shaped span with the type name in lowercase, the type's background color, and contrasting text color (automatically computed: white text on dark backgrounds, dark text on light backgrounds). The pill has rounded corners, small horizontal padding, and a font size slightly smaller than the heading text it accompanies.

The badge replaces the raw type annotation in the visual rendering while the underlying text remains unchanged. The raw text `[task]` in the editor is visually replaced by the pill widget, but clicking the widget positions the cursor inside the raw text range, allowing the user to edit the type by typing.

For compact display, the badge uses abbreviated type names when the pill would otherwise be too wide for small editor widths. Task becomes "TSK", Decision becomes "DEC", Specification becomes "SPEC", etc. The full type name appears on hover as a tooltip. The abbreviation threshold is configurable and the mapping from full name to abbreviation is maintained in a lookup table.

## Interactive Behavior: Type Conversion

Right-clicking a type badge opens a context menu listing all 24 section types, grouped by category (task-oriented, decision/record, interface/config, agent/automation, human interaction, visual/canvas, informational). Each menu item shows the type name, its color swatch, and a brief description of when to use that type. Selecting a type from the menu dispatches a CodeMirror transaction that replaces the type annotation in the section header text. The parser re-parses the affected section and all dependent decorations (type badge, status badge, link renderer) update accordingly.

The type conversion is also accessible via keyboard: with the cursor on a section heading, `Cmd+Shift+T` opens a type picker popup with the same categorized list. Typing filters the list. Enter selects.

When a type conversion occurs, F1-EmdCore's validator checks whether any link relations in the section are valid for the new type. For example, if a section with `→ implements: spec.emd` is converted from `[task]` to `[summary]`, the validator may emit a warning because `implements` is typically valid only in implementation-oriented sections. These diagnostics appear as subtle indicators on the type badge.

## How the Badge Updates on Manual Edit

When the user manually edits the type annotation in the section header (changing `[task]` to `[decision]` by typing), the debounced parse cycle in Fa-LiveMd picks up the change, produces a new AST, and Fa5-TypeBadge reads the new type and re-renders the badge. No special synchronization is needed. If the manually edited type is not one of the 24 valid types, the parser emits `SectionType` with an unknown variant and F1-EmdCore includes a diagnostic. Fa5-TypeBadge renders a generic "unknown type" badge with a question mark and dashed border to alert the user.

## Edge Cases

The most important edge case is a section with no type annotation at all — a plain `## My Heading` without `[type]` syntax. The parser treats this as a section with no explicit type. Fa5-TypeBadge does not render a badge. This is visually distinct from an unknown type badge: an unknown type is an error that needs fixing; an absent type is normal for sections that do not fit a specific category. The validator may suggest adding a type in some contexts (e.g., in a project document, all top-level sections should have a type).

Sections with custom or future section types that the parser has not yet been updated to handle explicitly receive a "custom type" badge with the type name as-is, no color coding, and a neutral gray appearance. This ensures forward compatibility: the EMD spec can add new section types without breaking existing documents.

Nested sections inherit their parent's type badge visibility. If a parent section has a type badge, child sections may show smaller, more subtle type indicators rather than full-sized pills, to reduce visual clutter at deeper nesting levels. This is a rendering preference, not a structural requirement.

## Relationship to Other Sub-Features

Fa5-TypeBadge is the sibling of Fa4-StatusBadge. They are positioned adjacent to each other in the section header, forming a badge pair. The type badge appears first (leftmost), then the status badge, then the heading text. Both are widget decorations positioned at offsets derived from the EmdDocument AST.

Fa5-TypeBadge coordinates with Fa6-BlockResolver when a section type implies a default block rendering. For example, a `[draw]` section typically contains a ```draw code block with JSON content. The type badge tells the user "this is a drawing section," and the block resolver renders the canvas widget from the code block. The two sub-features are independent but visually adjacent.

Fa5-TypeBadge receives its colors from Fh-ThemeEngine's CSS custom properties. All 24 type colors are themeable, allowing custom themes to override the default color assignments.

## Testing

Type badge rendering is tested by creating EmdDocument ASTs with every section type, rendering the badges, and verifying the correct color, label, and abbreviation for each type. Interactive tests verify that type conversion via context menu updates the underlying document text and the badge re-renders. Visual tests verify that all 24 types are visually distinguishable and that no two types have colors too similar to tell apart under any of the three themes.
