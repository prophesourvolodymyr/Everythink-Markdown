# Fa8-ThemeEngine — CSS Custom Property Theming System

The decoration sub-feature that defines and manages the visual theme system consumed by every other sub-feature in Fa-LiveMd. Fa8-ThemeEngine does not produce decorations itself — it produces the CSS custom property definitions that control the colors, fonts, border styles, shadows, spacing, and animation durations used by SyntaxHider, TextStyler, LinkRenderer, StatusBadge, TypeBadge, BlockResolver, and InlineWidgets. Every visual decision in the editor ultimately flows through a CSS variable defined here.

## Why This Exists

A theming system exists for three reasons. First, accessibility: light and dark modes are not cosmetic preferences — they are accessibility requirements for users with light sensitivity, low vision, or color vision deficiencies. High-contrast mode serves users who need maximum differentiation between interface elements. Second, brand integration: the SDK is embedded in other applications, and those applications have their own color schemes. A well-designed theming system allows the host application to override EMD's colors to match its own design language without forking the SDK. Third, consistency: with 30+ visual sub-features each needing colors, fonts, and spacing, a centralized variable system prevents duplicated values, ensures contrast ratios are maintained, and makes it possible to audit the entire visual design from a single file.

## The CSS Variable Architecture

The theme is defined as a set of CSS custom properties in the `--emd-*` namespace. These properties are set on the editor container element via class selectors: `.emd-theme-light` defines the light theme values, `.emd-theme-dark` defines the dark theme values, and `.emd-theme-high-contrast` defines the high-contrast theme values. Switching themes is a matter of changing the class on the container — all variable references resolve to their new values instantly without recomputing any decorations or rebuilding any DOM elements.

The CSS variables are organized into logical groups. Base color variables provide the fundamental color palette: `--emd-bg` (primary background), `--emd-bg-secondary` (card and widget backgrounds), `--emd-text` (primary text), `--emd-text-muted` (secondary and label text), `--emd-border` (separator and outline colors), `--emd-accent` (the primary brand or interactive color), `--emd-accent-hover` (darker or lighter variant for hover states), `--emd-selection` (text selection highlight background), `--emd-focus-ring` (focus indicator outline color), `--emd-shadow` (box shadow definition). These base variables are used by widgets and structural elements throughout the editor.

Font variables control the typography: `--emd-font` (the primary sans-serif family for UI text), `--emd-mono` (the monospace family for code and data), `--emd-heading-font` (optional distinct heading family). Font variables allow the host application to set EMD's typography to match its own, or to use system fonts for a native feel.

Radius, shadow, and spacing variables control the shape language: `--emd-radius` (border radius for cards, badges, buttons), `--emd-shadow` (box shadow for elevated elements), `--emd-transition` (animation duration). These are used by widget renderers to maintain a consistent visual rhythm.

Section type color variables provide a distinct color for each of the 24 section types: `--emd-type-task`, `--emd-type-decision`, `--emd-type-draw`, and so on. Each is a hex color with sufficient contrast against both light and dark backgrounds. These variables are consumed primarily by Fa5-TypeBadge.

Section status color variables provide a color for each of the 7 statuses: `--emd-status-done` (green), `--emd-status-pending` (gray), `--emd-status-in-progress` (amber), `--emd-status-blocked` (red), `--emd-status-archived` (muted gray), `--emd-status-cancelled` (muted gray with italic implication via adjacent CSS rules), `--emd-status-unknown` (dashed styling). These are consumed primarily by Fa4-StatusBadge.

Link color variables provide colors for the 20+ link relations: `--emd-link-dependency`, `--emd-link-implementation`, `--emd-link-documentation`, `--emd-link-conflict`, `--emd-link-neutral`. Each maps to a category of link relations. Individual relation overrides are possible via additional variables. These are consumed primarily by Fa3-LinkRenderer.

Code and widget variables control the appearance of code blocks, inline code, block widgets, inline widgets, and tooltips: `--emd-code-bg`, `--emd-code-text`, `--emd-widget-bg`, `--emd-widget-border`, `--emd-tooltip-bg`, `--emd-tooltip-text`.

## Theme Presets

Three themes are built into the SDK. They serve as both the default visual design and as reference implementations for custom theme developers.

**Light theme** (`.emd-theme-light`) uses a white or near-white background (`#ffffff` or `#fafbfc`), dark text (`#1a1a2e`), blue accent (`#3b82f6`), and muted borders. This is the default theme and is optimized for extended reading and editing sessions. Contrast ratios meet WCAG AA for normal text (4.5:1 minimum). The color palette is cool-toned for reduced eye strain: blues, teals, and muted grays predominate.

**Dark theme** (`.emd-theme-dark`) uses a dark blue-gray background (`#1a1a2e`), light text (`#e4e4e7`), lighter blue accent (`#60a5fa`), and subtle borders. Type and status colors are desaturated slightly to reduce harsh contrast on dark backgrounds while maintaining distinguishability. The dark theme is activated automatically when the host system's `prefers-color-scheme` is "dark" and the user has not manually selected a theme.

**High-contrast theme** (`.emd-theme-high-contrast`) uses a pure black background (`#000000`), pure white text (`#ffffff`), yellow accent (`#ffff00`), and high-visibility borders. All colors are pushed to their maximum saturation and contrast. Type badges use distinct geometric shapes in addition to colors (triangle for task, square for decision, circle for summary) because color differentiation alone is unreliable at extreme contrast levels. This theme is designed for users with significant visual impairments.

## Theme Switching

The theme is set as a prop on the `EmdEditor` component: `theme="dark"`. The component sets the corresponding class on the editor container element. CodeMirror does not re-render text or recompute decorations when the CSS class changes — the browser's style engine resolves the new variable values and repaints. This makes theme switching effectively instantaneous, even in large documents.

The theme preference is persisted to localStorage so the user's choice survives page reloads. If no preference is stored, the system's `prefers-color-scheme` media query determines the initial theme.

## Custom Theme Registration

External developers can register custom themes without modifying the SDK source code. A custom theme is a JavaScript object mapping CSS variable names to CSS values:

The custom theme is registered through the `registerTheme(name, variables)` API. The registered theme becomes available as a `theme` prop value. Custom themes can override any subset of variables — variables not specified in the custom theme fall back to the light theme defaults. This allows a host application to only change the accent color and font family while keeping all other visual design intact.

Custom themes can also define entirely new themes that replace all variables. A developer building a documentation site with a warm, paper-like aesthetic might define a "sepia" theme with cream backgrounds and brown text, overriding all color variables. The theme system imposes no constraints on color choices — it is the developer's responsibility to ensure adequate contrast and accessibility.

## Relationship to Other Sub-Features

Fa8-ThemeEngine does not produce decorations. Every other sub-feature in Fa-LiveMd reads its colors, fonts, and spacing from CSS custom properties defined by Fa8-ThemeEngine. The relationship is one-directional: Fa8 defines the variables; other sub-features consume them. This means Fa8 can be modified without touching any decoration logic — a theme designer only needs to understand the variable names and their effects, not the decoration internals.

Fa8-ThemeEngine is also consumed by Fb-Components for React component styling (toolbar buttons, modal backgrounds, scrollbar colors) and by Fd-AiPanel for chat interface styling. The CSS variables are global to the editor container, so any element within the container can reference them.

## Testing

Each theme preset is tested for contrast compliance (WCAG AA minimum for all text-background combinations), color distinguishability (all 24 type colors must be visually distinct from each other under each theme), and variable completeness (no decoration sub-feature references an undefined variable). Custom theme registration is tested by registering a theme with partial variable overrides and verifying that non-overridden variables fall back to light theme defaults. Theme switching performance is tested by measuring the time from class change to visual update in large documents.
