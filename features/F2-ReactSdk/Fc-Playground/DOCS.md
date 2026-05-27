# Fc-Playground — Local Development Preview

The development environment for building and testing the React SDK. Not published. Not included in the npm bundle. Exists solely for us to see the SDK in action while we build it. A Vite + React application that imports `@everthink/react-emd` exactly as an external developer would.

## Sub-sub-features

**Fc1-DevApp** — the main playground application shell. Full workspace layout with file explorer sidebar (listing sample .emd files), tab bar for multiple open documents, and the EmdEditor component in the main area. Toolbar with buttons for theme switching, AI panel toggle, block tester mode toggle, and inspector mode (shows decoration ranges overlaid on the editor for debugging). The app loads on localhost via `npm run dev` with Vite HMR so changes to any SDK source file instantly reflect in the playground.

**Fc2-SampleFiles** — a curated collection of .emd files exercising the full EMD feature surface. One file per section type. One file with every link relation type. One file with every code block tag and valid content. One file with intentionally malformed EMD to test error recovery and diagnostic rendering. One very large file (500+ sections) for performance testing. These files serve as the manual test suite — open each one and visually verify that all decorations, widgets, and interactions work correctly.

**Fc3-BlockTester** — an isolated block rendering tool. Select a single section from a loaded document, or paste raw EMD text for one section, and it renders with full decorations in an isolated viewport without other sections. Toggle individual sub-features (SyntaxHider, TextStyler, etc.) on and off to isolate visual issues. Overlay decoration ranges as colored rectangles to debug positioning. Measure decoration rebuild time for that specific section. The block tester is the primary tool for developing and debugging individual decoration sub-features.

## Status: Complete

## Implementation Notes

### Architecture

- **`playground/vite.config.ts`** — separate Vite config for dev mode. Sets `root` to `playground/`, aliases `@everthink/react-emd` to `../src/index.ts` so HMR works on SDK source. Port 5173.
- **`playground/tsconfig.json`** — extends the library's compiler settings but with `noEmit: true`, baseUrl `..`, and includes both playground and src files. Uses `types: ["node", "vite/client"]`.
- **`playground/index.html`** — minimal HTML entry with `<div id="root">` and script pointing to `./main.tsx`.
- **`playground/main.tsx`** — React 18 `createRoot` entry rendering `<App />`.
- **`playground/App.tsx`** — full workspace application using `createElement` (consistent with SDK's frameworkless approach). Components: toolbar, file explorer sidebar, tab bar, EmdEditor, inspector panel, console panel.
- **`playground/BlockTester.tsx`** — modal component for isolated section rendering with feature toggles, overlay mode, and performance meter.
- **`package.json`** — `dev` script updated to `vite --config playground/vite.config.ts`.
- Added `@types/node` to devDependencies for the playground vite config.

### Sample Files (12 total)

| File | Description |
|------|-------------|
| `all-types.emd` | 24 sections exercising every section type and all 6 statuses |
| `links.emd` | 18 sections exercising every link relation type (depends, blocks, related, etc.) |
| `code-blocks.emd` | 17 sections with typed code blocks (mermaid, draw, math, table, diff, etc.) |
| `nested.emd` | Deeply nested sections (4 levels deep) with mixed types and statuses |
| `tasks.emd` | Task-focused file with checkboxes, progress indicators, 10 task items |
| `decisions.emd` | Decision log format with context, options, rationale |
| `api-spec.emd` | API documentation with endpoints, parameters, schemas |
| `bug-tracker.emd` | Bug tracking with reproduction steps, expected vs actual |
| `project.emd` | Full realistic project file (meta, summary, tasks, decisions, memory, log) |
| `malformed.emd` | Intentionally broken EMD for error recovery testing (13 malformations) |
| `large.emd` | Performance test file — 500 generated sections (~30KB) |
| `transclusion.emd` | Transclusion examples with `![[file]]` syntax |

### DevApp Features

- **File Explorer** (left sidebar, 250px): lists all 12 sample files, highlights active file, "Open All" button
- **Tab Bar**: horizontal tabs with filename + close button, dirty indicator (●), scrollable
- **Editor Area**: `<EmdEditor>` component with controlled mode, config-driven feature toggles
- **Inspector** (right sidebar, 300px, collapsible): theme radio buttons (light/dark/high-contrast), 8 feature toggle checkboxes (syntaxHider, textStyler, linkRenderer, statusBadge, typeBadge, blockResolver, inlineWidgets, smartFolds), Block Tester launch button
- **Console** (bottom panel, 150px, collapsible): event log showing onChange, onNavigate, toggles, saves, errors
- **Toolbar**: EMD.DEV badge, theme quick-switch buttons, inspector/console toggle buttons, save button

### BlockTester Features

- **Section selector**: dropdown listing parsed sections from current file with `[type|status] title` format
- **Raw EMD input**: textarea for pasting arbitrary EMD text
- **Isolated viewport**: EmdEditor with local config showing selected/pasted section
- **Decoration toggle grid**: 3-column grid of feature checkboxes with instant viewport update
- **Performance meter**: shows rebuild time in ms after each toggle
- **Decoration overlay mode**: colored border legend mapping features to colors (blue=syntaxHider, green=textStyler, purple=linkRenderer, amber=statusBadge, red=typeBadge, pink=blockResolver, teal=inlineWidgets, orange=smartFolds)
