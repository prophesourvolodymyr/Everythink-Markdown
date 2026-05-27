# Phase 13 of Fb2-EmdViewer — Read-Only EMD Viewer Component

## Context
Phase 12 (Fb1-EmdEditor) is COMPLETE. The `EmdEditor` React component wraps a CodeMirror 6 `EditorView` with `liveMarkdownPlugin()`. It supports controlled/uncontrolled modes, `onChange`/`onSave` callbacks, imperative ref (`focus`, `blur`, `getContent`, `setContent`, `undo`, `redo`, `getEditorView`), and compartment-based reconfiguration. 207 tests pass, build succeeds.

The `EmdViewer` React component at `sdk/react-emd/src/viewer.ts` is a stub — it renders `<div>EmdViewer — coming soon</div>`.

**The task:** Replace the stub with a lightweight read-only React component that parses EMD source via `@everthink/emd` WASM, walks the `EmdDocument` AST, and produces React DOM elements directly — no CodeMirror, no editing, no keyboard handlers.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/viewer.ts` | Current stub — the component to replace |
| `sdk/react-emd/src/index.ts` | Top-level exports — verify `EmdViewer` is exported |
| `features/F2-ReactSdk/Fb-Components/Fb2-EmdViewer/DOCS.md` | Component spec: props, rendering pipeline, use cases |
| `features/F2-ReactSdk/Fb-Components/Fb2-EmdViewer/TODO.md` | Task checklist |
| `sdk/react-emd/src/editor.ts` | Reference implementation — patterns for React-CM integration (mount/unmount, forwardRef, imperative handle) |
| `sdk/react-emd/src/live-md/types.ts` | `LiveMdConfig`, `ThemeMode` — theme prop typing |
| `sdk/react-emd/src/live-md/theme-engine.ts` | `injectThemeStyles`, `LIGHT_THEME`, `DARK_THEME`, `HIGH_CONTRAST_THEME` — theme CSS variable injection |
| `sdk/react-emd/package.json` | Dependencies: react 18, @everthink/emd, @types/react |

## Codebase learnings (from Phase 12)

**`@everthink/emd`** WASM provides `EmdDocument` with:
- `sections: EmdSection[]` — top-level sections
- `diagnostics: EmdDiagnostic[]`
- `metadata: EmdMetadata`

**`EmdSection`** has:
- `section_type: string` (task, decision, spec, api, bug, etc.)
- `status: string | null` (done, in-progress, pending, blocked, etc.)
- `title: string`
- `content: string[]` — array of content strings for each line in the section body
- `subsections: EmdSection[]` — nested sections
- `source_span: { start: number; end: number }`
- `metadata: { status_override, depends_on, id }`

**The viewer does NOT use CodeMirror.** It parses EMD source → walks AST → produces React elements. No `@codemirror/*` imports needed. This keeps the bundle small (~60KB vs ~380KB for the editor).

**Theme system:** `injectThemeStyles()` injects a `<style>` element with CSS custom properties for the given theme. `LIGHT_THEME`, `DARK_THEME`, `HIGH_CONTRAST_THEME` are predefined theme definitions. Theme class is applied to the container div.

**The `@everthink/emd` WASM package** is imported as `import { parse } from '@everthink/emd'` or `import init, { parse } from '@everthink/emd'` — check the actual import path in `sdk/react-emd/src/live-md/__tests__/integration.test.ts` and how `EmdDocument` type is imported.

## What to build

### 1. Full `EmdViewer` React Component

Replace the stub in `sdk/react-emd/src/viewer.ts` with a production-ready read-only component.

#### Props (`EmdViewerProps`):
```ts
export interface EmdViewerProps {
  /** EMD source string to parse and render */
  source: string;
  /** Theme: 'light', 'dark', or 'high-contrast' (default: 'light') */
  theme?: ThemeMode;
  /** CSS class for the container div */
  className?: string;
  /** Called when a wiki-link is clicked */
  onNavigate?: (target: string) => void;
}
```

Note: rename `value` → `source` in the current stub to match the DOCS.md spec.

#### Component behavior:
1. Parse the `source` prop via `@everthink/emd`'s `parse()` on mount and whenever `source` changes
2. Walk the `EmdDocument.sections` recursively to build a React element tree
3. Each section renders as a styled container with:
   - Type badge (colored pill showing section type, e.g., `[task]`, `[spec]`)
   - Status badge (colored dot or pill if status is set, e.g., `|done`, `|in-progress`)
   - Title (heading text)
   - Content (section body text, rendered as paragraphs)
   - Subsections (recursively rendered, indented)
4. Wiki-links (`[[target]]`) rendered as styled `<span>` elements that call `onNavigate` on click
5. Semantic links (`→ depends: file.emd`) rendered as styled spans
6. Apply theme CSS variables via `injectThemeStyles()` on mount; re-inject on theme change
7. Apply theme class (`emd-theme-light`, `emd-theme-dark`, `emd-theme-high-contrast`) to the container
8. Handle parse errors gracefully — render an error message instead of crashing
9. Empty/null/undefined `source` → render empty container

#### Rendering approach:
```tsx
function renderSection(section: EmdSection, depth: number): React.ReactElement {
  const typeColor = TYPE_COLORS[section.section_type] ?? TYPE_COLORS['unknown'];
  const statusColor = section.status ? STATUS_COLORS[section.status] : undefined;
  
  return React.createElement('div', {
    className: 'emd-viewer-section',
    style: { marginLeft: `${depth * 16}px` },
    'data-type': section.section_type,
    'data-status': section.status ?? '',
    children: [
      // Type badge
      React.createElement('span', {
        className: 'emd-viewer-type-badge',
        style: { backgroundColor: typeColor },
      }, `[${section.section_type}]`),
      // Status badge (if status exists)
      section.status && React.createElement('span', {
        className: 'emd-viewer-status-badge',
        style: { backgroundColor: statusColor },
      }, section.status),
      // Title
      React.createElement('h3', { className: 'emd-viewer-title' }, section.title),
      // Content
      ...section.content.map(line => 
        React.createElement('p', { className: 'emd-viewer-content' }, renderLine(line))
      ),
      // Subsections
      ...section.subsections.map(sub => renderSection(sub, depth + 1)),
    ],
  });
}
```

#### Wiki-link rendering helper:
```tsx
function renderLine(line: string, onNavigate?: (target: string) => void): React.ReactNode {
  // Split line by [[wiki-link]] pattern
  // Render text nodes + wiki-link spans
  // Wiki-link span: onClick → onNavigate?.(target)
}
```

Use the same wiki-link regex pattern as `sdk/react-emd/src/live-md/wiki-link.ts`: `/\[\[([^\]]+)\]\]/g`.

### 2. Inline CSS styles

The viewer should include minimal inline styles or inject a `<style>` block for:
- Section container: padding, border-left (colored by type), margin-bottom
- Type badges: inline-block, padding, border-radius, color, font-size
- Status badges: similar to type badges but different shape/color
- Title: font-size, margin, color
- Content: line-height, margin
- Wiki-links: color, cursor pointer, text-decoration underline

Use CSS custom properties from the theme system (`var(--emd-*)`) where applicable. The `injectThemeStyles(theme)` function from the theme engine already injects all `--emd-*` variables.

### 3. Tests

Create `sdk/react-emd/src/__tests__/viewer.test.tsx` with:

1. **Renders without crashing** — mount `<EmdViewer source="## [task] Hello" />`, verify container exists
2. **Renders empty for empty source** — mount with `source=""`, verify no sections
3. **Renders type badge for each section** — mount multi-section EMD, verify type badges appear
4. **Renders status badge when status is set** — mount `[task|done]`, verify status badge
5. **Renders nested sections with indentation** — mount sections with subsections, verify nesting
6. **Renders wiki-links as clickable spans** — mount `[[target]]`, verify span exists, click calls onNavigate
7. **Applies className prop** — verify custom class on container
8. **Applies theme class** — verify `emd-theme-*` class on container

Use `@testing-library/react` for tests (already installed from Phase 12).

### 4. Export verification

Ensure `EmdViewer`, `EmdViewerProps` are properly exported from `sdk/react-emd/src/index.ts`. The current export `export { EmdViewer } from './viewer'` exists — add the type export:
```ts
export type { EmdViewerProps } from './viewer';
```

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/viewer.ts` | MODIFY — full viewer component implementation |
| `sdk/react-emd/src/__tests__/viewer.test.tsx` | CREATE — 8 tests |
| `sdk/react-emd/src/index.ts` | MODIFY — add `EmdViewerProps` type export |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (~215 total)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fb-Components/Fb2-EmdViewer/TODO.md`
2. Update `features/F2-ReactSdk/Fb-Components/Fb2-EmdViewer/DOCS.md` with implementation notes
3. Update `CYCLES.md` — mark Phase 5 task 2 (Fb-Components) as `[x]` (both EmdEditor and EmdViewer done)
4. Run `npx tsc --noEmit`, `npm test`, and `npm run build` — all must pass
5. **Commit everything:** `git add -A && git commit -m "Phase 13 (Fb2-EmdViewer): read-only EMD viewer component with WASM AST parsing, recursive section rendering, type/status badges, wiki-link handling, and theme support"`
6. Generate Phase 14 prompt if more sub-features remain, otherwise mark the parent feature complete
