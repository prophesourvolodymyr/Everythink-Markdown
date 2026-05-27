# Phase 08 of Fa8-ThemeEngine — CSS Custom Property Theming System

## Context
Phases 01-07 are complete. The `@everthink/react-emd` package now has seven decoration builders in `view-plugin.ts`'s `BUILDERS` array. Fa7-InlineWidgets was just completed, providing checkbox widgets on task items, progress bars below task headings, and approve/reject buttons on human checkpoint sections.

Fa8-ThemeEngine defines the CSS custom property system consumed by every other sub-feature. It does not produce decorations itself — it produces the `--emd-*` CSS variable definitions that control colors, fonts, spacing, and animation. Three built-in themes (light, dark, high-contrast) and a custom theme registration API. Theme switching is instant via CSS class changes on the container element — no DOM rebuilds, no decoration recomputation.

118 tests pass (12 + 13 + 7 + 7 + 8 + 16 + 12 + 17 + 26). `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig already has `theme: 'light' | 'dark' | 'high-contrast'` field |
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array (now 7 builders), how config flows down |
| `sdk/react-emd/src/live-md/inline-widgets.ts` | Fa7 widget classes using inline CSS (future consumers of --emd-* vars) |
| `sdk/react-emd/src/live-md/status-badge.ts` | StatusDotWidget, StatusPillWidget using inline styles |
| `sdk/react-emd/src/live-md/__tests__/inline-widgets.test.ts` | Latest test patterns: DOM assertions, config overrides |
| `sdk/react-emd/src/index.ts` | Top-level export patterns |
| `features/F2-ReactSdk/Fa-LiveMd/Fa8-ThemeEngine/DOCS.md` | Full spec: CSS var architecture, 3 theme presets, registerTheme API |
| `features/F2-ReactSdk/Fa-LiveMd/Fa8-ThemeEngine/TODO.md` | Checklist: 5 tasks |

## Codebase learnings (from Phase 01-07)

**No CSS files exist yet.** All styling is currently done via inline `element.style.cssText = ...` in widget `toDOM()` methods. Fa8-ThemeEngine will be the first CSS file in the SDK, providing a centralized stylesheet that widgets can reference via class names and CSS custom properties.

**LiveMdConfig already has `theme: 'light' | 'dark' | 'high-contrast'`.** The config field exists but nothing reads it yet. Fa8 must:
1. Create the CSS variable definitions
2. Apply the correct theme class to the editor container
3. Provide a `registerTheme()` API for custom themes

**Widget styling pattern:** All widgets currently use inline styles via `style.cssText`. For example, the StatusDotWidget sets `background:${this.color}` inline. After Fa8, widgets should reference CSS variables like `var(--emd-status-done)` instead of hardcoded hex values like `'#22c55e'`. This allows widgets to respond to theme changes without re-render.

**Editor components are stubs.** `EmdEditor` and `EmdViewer` in `src/editor.ts` and `src/viewer.ts` currently render placeholder text. Fa8 doesn't need to make them production-ready, but it should provide a `applyTheme(container, theme)` utility they can call when they become real.

**CSS variables are consumed by 7 other sub-features.** Every other decoration builder references colors that should eventually be CSS variables. Fa8 defines the variables; migrating existing inline styles to use them is a follow-up task (not part of Fa8 itself).

**Test approach:** Since Fa8 produces CSS (not decorations), tests should verify:
- CSS variable definitions exist for all required properties
- Theme classes contain the correct variable values
- `registerTheme()` correctly merges custom overrides with defaults
- Theme switching logic produces the correct CSS class string

## What to build

### 1. Theme types

Add to `sdk/react-emd/src/live-md/types.ts`:

```ts
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

export interface ThemeDefinition {
  name: string;
  variables: Record<string, string>;
}

export interface ThemeEngineConfig {
  defaultTheme: ThemeMode;
  customThemes: Record<string, ThemeDefinition>;
}
```

### 2. theme-engine.ts — Theme variable definitions and utilities

Create `sdk/react-emd/src/live-md/theme-engine.ts` with:

**Theme variable definitions as a mapping of mode → CSS variables:**

```ts
const LIGHT_THEME: Record<string, string> = {
  '--emd-bg': '#ffffff',
  '--emd-bg-secondary': '#f3f4f6',
  '--emd-bg-tertiary': '#e5e7eb',
  '--emd-text': '#1a1a2e',
  '--emd-text-secondary': '#4b5563',
  '--emd-text-muted': '#9ca3af',
  '--emd-border': '#d1d5db',
  '--emd-accent': '#3b82f6',
  '--emd-accent-hover': '#2563eb',
  '--emd-accent-text': '#ffffff',
  '--emd-selection': '#bfdbfe',
  '--emd-focus-ring': '#3b82f6',
  '--emd-shadow': '0 1px 3px rgba(0,0,0,0.1)',
  '--emd-radius': '4px',
  '--emd-transition': '150ms',
  '--emd-font': 'system-ui, -apple-system, sans-serif',
  '--emd-mono': 'ui-monospace, SFMono-Regular, monospace',
  '--emd-heading-font': 'system-ui, -apple-system, sans-serif',

  // Code
  '--emd-code-bg': '#f1f5f9',
  '--emd-code-text': '#1e293b',
  '--emd-inline-code-bg': '#f1f5f9',

  // Widgets
  '--emd-widget-bg': '#ffffff',
  '--emd-widget-border': '#e5e7eb',
  '--emd-tooltip-bg': '#1a1a2e',
  '--emd-tooltip-text': '#ffffff',

  // Progress
  '--emd-progress-track': '#e5e7eb',
  '--emd-progress-label': '#6b7280',

  // Section type colors (24 types)
  '--emd-type-task': '#f59e0b',
  '--emd-type-decision': '#0d9488',
  '--emd-type-spec': '#2563eb',
  '--emd-type-api': '#4f46e5',
  '--emd-type-bug': '#ef4444',
  '--emd-type-idea': '#eab308',
  '--emd-type-verify': '#f97316',
  '--emd-type-summary': '#6b7280',
  '--emd-type-detail': '#78716c',
  '--emd-type-memory': '#a855f7',
  '--emd-type-log': '#9ca3af',
  '--emd-type-meta': '#6b7280',
  '--emd-type-config': '#64748b',
  '--emd-type-schema': '#38bdf8',
  '--emd-type-model': '#8b5cf6',
  '--emd-type-agent': '#d946ef',
  '--emd-type-graph': '#14b8a6',
  '--emd-type-prompt': '#d97706',
  '--emd-type-template': '#a8a29e',
  '--emd-type-human': '#f43f5e',
  '--emd-type-draw': '#ec4899',
  '--emd-type-flow': '#06b6d4',
  '--emd-type-kanban': '#84cc16',
  '--emd-type-example': '#22c55e',
  '--emd-type-unknown': '#9ca3af',

  // Section status colors (7 statuses)
  '--emd-status-done': '#22c55e',
  '--emd-status-pending': '#9ca3af',
  '--emd-status-in-progress': '#f59e0b',
  '--emd-status-blocked': '#ef4444',
  '--emd-status-archived': '#6b7280',
  '--emd-status-cancelled': '#6b7280',
  '--emd-status-unknown': '#9ca3af',
};
```

**Dark theme overrides** — only the variables that differ from light:

```ts
const DARK_THEME: Record<string, string> = {
  '--emd-bg': '#1a1a2e',
  '--emd-bg-secondary': '#16213e',
  '--emd-bg-tertiary': '#0f3460',
  '--emd-text': '#e4e4e7',
  '--emd-text-secondary': '#a1a1aa',
  '--emd-text-muted': '#71717a',
  '--emd-border': '#27272a',
  '--emd-accent': '#60a5fa',
  '--emd-accent-hover': '#3b82f6',
  '--emd-accent-text': '#1a1a2e',
  '--emd-selection': '#1e3a5f',
  '--emd-focus-ring': '#60a5fa',
  '--emd-shadow': '0 1px 3px rgba(0,0,0,0.4)',
  '--emd-code-bg': '#0f172a',
  '--emd-code-text': '#e2e8f0',
  '--emd-inline-code-bg': '#0f172a',
  '--emd-widget-bg': '#16213e',
  '--emd-widget-border': '#27272a',
  '--emd-tooltip-bg': '#e4e4e7',
  '--emd-tooltip-text': '#1a1a2e',
  '--emd-progress-track': '#27272a',
  '--emd-progress-label': '#71717a',
};
```

**High-contrast theme overrides:**

```ts
const HIGH_CONTRAST_THEME: Record<string, string> = {
  '--emd-bg': '#000000',
  '--emd-bg-secondary': '#1a1a1a',
  '--emd-bg-tertiary': '#333333',
  '--emd-text': '#ffffff',
  '--emd-text-secondary': '#ffffff',
  '--emd-text-muted': '#cccccc',
  '--emd-border': '#ffffff',
  '--emd-accent': '#ffff00',
  '--emd-accent-hover': '#ffcc00',
  '--emd-accent-text': '#000000',
  '--emd-selection': '#333333',
  '--emd-focus-ring': '#ffff00',
  '--emd-shadow': 'none',
  '--emd-code-bg': '#1a1a1a',
  '--emd-code-text': '#ffffff',
  '--emd-inline-code-bg': '#1a1a1a',
  '--emd-widget-bg': '#1a1a1a',
  '--emd-widget-border': '#ffffff',
  '--emd-tooltip-bg': '#ffffff',
  '--emd-tooltip-text': '#000000',
  '--emd-progress-track': '#333333',
  '--emd-progress-label': '#cccccc',
};
```

**Merged theme map:**

```ts
function buildThemeVariables(mode: ThemeMode): Record<string, string> {
  const overrides = mode === 'dark' ? DARK_THEME : mode === 'high-contrast' ? HIGH_CONTRAST_THEME : {};
  return { ...LIGHT_THEME, ...overrides };
}
```

**Custom theme registry:**

```ts
const customThemes = new Map<string, ThemeDefinition>();

export function registerTheme(name: string, variables: Record<string, string>): void
export function unregisterTheme(name: string): void
export function getTheme(name: string): ThemeDefinition | undefined
export function listThemes(): string[]
```

`registerTheme` merges the provided variables over the LIGHT_THEME defaults.

### 3. CSS-in-JS generation utility

Since there are no `.css` files in the project and the SDK needs to work with dynamic themes, generate the CSS as a `<style>` element or as a CSS string that gets injected into the editor container.

```ts
export function generateThemeCSS(
  mode: ThemeMode,
  customThemeName?: string
): string {
  const variables = resolveThemeVariables(mode, customThemeName);
  const varsCSS = Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `.emd-theme-${mode} {\n${varsCSS}\n}`;
}
```

```ts
export function injectThemeStyles(
  container: HTMLElement,
  mode: ThemeMode,
  customThemeName?: string
): void {
  // Create or update a <style> element in the container with the theme CSS
}
```

```ts
export function resolveThemeVariables(
  mode: ThemeMode,
  customThemeName?: string
): Record<string, string> {
  if (customThemeName) {
    const def = customThemes.get(customThemeName);
    if (def) return { ...LIGHT_THEME, ...def.variables };
  }
  return buildThemeVariables(mode);
}
```

### 4. Public API

Update `sdk/react-emd/src/live-md/index.ts` and `sdk/react-emd/src/index.ts` to export:
- `ThemeMode`, `ThemeDefinition`, `ThemeEngineConfig`
- `registerTheme`, `unregisterTheme`, `getTheme`, `listThemes`
- `generateThemeCSS`, `injectThemeStyles`, `resolveThemeVariables`
- `LIGHT_THEME`, `DARK_THEME`, `HIGH_CONTRAST_THEME` (the raw variable maps, for reference)

### 5. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/theme-engine.test.ts`:

Tests (at least 12):
1. Light theme contains all required variable groups (base, code, widget, type, status)
2. Dark theme contains all required overrides
3. High-contrast theme contains all required overrides
4. `buildThemeVariables('light')` returns LIGHT_THEME values exactly
5. `buildThemeVariables('dark')` returns LIGHT_THEME merged with DARK_THEME overrides
6. `buildThemeVariables('high-contrast')` returns LIGHT_THEME merged with HIGH_CONTRAST_THEME overrides
7. `generateThemeCSS('light')` produces valid CSS with `.emd-theme-light` selector
8. `generateThemeCSS('dark')` produces valid CSS with `.emd-theme-dark` selector
9. `generateThemeCSS('high-contrast')` produces valid CSS with `.emd-theme-high-contrast` selector
10. `registerTheme` stores a custom theme and can be retrieved via `getTheme`
11. `resolveThemeVariables` with a custom theme name merges custom vars over light defaults
12. `unregisterTheme` removes a custom theme
13. `listThemes` returns all registered custom theme names
14. Custom theme with partial variables inherits light theme defaults for unspecified vars
15. `generateThemeCSS` with custom theme produces CSS with the custom theme's variables
16. `injectThemeStyles` creates or updates a `<style>` element in the container

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add ThemeMode, ThemeDefinition, ThemeEngineConfig |
| `sdk/react-emd/src/live-md/theme-engine.ts` | NEW — theme variable maps, registerTheme, CSS generation |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/live-md/__tests__/theme-engine.test.ts` | NEW — 14+ tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa8-ThemeEngine/TODO.md` | MODIFY — mark tasks [x] |
| `features/F2-ReactSdk/Fa-LiveMd/TODO.md` | MODIFY — update progress note |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (118 existing + ~14 new = ~132)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa8-ThemeEngine/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note to include Fa8-ThemeEngine ✅
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 08 (Fa8-ThemeEngine): CSS custom property theming system"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-09-SmartFolds.md`
