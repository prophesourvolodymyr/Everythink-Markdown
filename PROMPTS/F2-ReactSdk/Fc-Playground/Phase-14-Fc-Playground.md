# Phase 14 of Fc-Playground — Local Development Preview

## Context
Phase 13 (Fb2-EmdViewer) is COMPLETE. Both `EmdEditor` and `EmdViewer` React components are production-ready with 218 passing tests and a clean build. The `@everthink/react-emd` SDK exports via `sdk/react-emd/src/index.ts` both components, all live-md sub-features (syntax hider, text styler, link renderer, type badges, status badges, block resolver, inline widgets, smart folds, theme engine), and the `liveMarkdownPlugin()` function for standalone CM6 use.

Fc-Playground is the development environment for building and testing the React SDK. It is a Vite + React application that imports `@everthink/react-emd` exactly as an external developer would. It lives inside `sdk/react-emd/playground/` and runs via `npm run dev` with Vite HMR. It is NOT published. It is NOT included in the npm bundle.

**The task:** Create the full playground application with three sub-sub-features:
- Fc1-DevApp: workspace shell with file explorer, tab bar, editor pane, toolbar
- Fc2-SampleFiles: 10+ curated .emd files exercising full EMD feature surface
- Fc3-BlockTester: isolated block rendering tool for debugging decorations

## What you need to read first

| File | Why |
|------|-----|
| `features/F2-ReactSdk/Fc-Playground/DOCS.md` | Full spec: DevApp, SampleFiles, BlockTester requirements |
| `features/F2-ReactSdk/Fc-Playground/TODO.md` | Task checklist |
| `sdk/react-emd/src/index.ts` | All available exports — what the playground imports |
| `sdk/react-emd/src/editor.ts` | `EmdEditor`, `EmdEditorProps`, `EmdEditorRef` — the main component the playground exercises |
| `sdk/react-emd/src/viewer.ts` | `EmdViewer`, `EmdViewerProps` — the read-only component |
| `sdk/react-emd/vite.config.ts` | Current Vite config — lib mode only, needs dev server config |
| `sdk/react-emd/package.json` | Scripts, dependencies, exports — what the playground inherits |
| `sdk/react-emd/src/live-md/types.ts` | `LiveMdConfig`, `ThemeMode`, `TypeBadgeConfig`, `StatusBadgeConfig` — config shapes for toggles |
| `sdk/react-emd/src/live-md/theme-engine.ts` | `LIGHT_THEME`, `DARK_THEME`, `HIGH_CONTRAST_THEME` — theme toggle implementation |
| `sdk/react-emd/tsconfig.json` | Compiler options — ensure playground compiles |
| `CYCLES.md` (Phase 5) | Understand where this fits in the overall plan |

## Codebase learnings

**Project layout:** `sdk/react-emd/` is a single Vite project. Currently configured for lib mode only (`vite build`). The playground needs a dev mode that serves an `index.html` with Vite HMR, importing the SDK source directly (not from dist/).

**Available exports from `@everthink/react-emd` (index.ts):**
- Components: `EmdEditor`, `EmdViewer`
- Hooks/plugins: `liveMarkdownPlugin`
- Decorators: `buildSyntaxHiderDecorations`, `buildTextStylerDecorations`, `buildWikiLinkDecorations`, `buildSemanticLinkDecorations`, `buildLinkRendererDecorations`, `buildStatusBadgeDecorations`, `buildTypeBadgeDecorations`, `buildBlockResolverDecorations`, `buildInlineWidgetDecorations`
- Block management: `registerBlockWidget`, `unregisterBlockWidget`, `getBlockWidget`, `registerBuiltinBlockWidgets`
- Theme: `registerTheme`, `unregisterTheme`, `getTheme`, `listThemes`, `generateThemeCSS`, `injectThemeStyles`, `resolveThemeVariables`, `buildThemeVariables`, `LIGHT_THEME`, `DARK_THEME`, `HIGH_CONTRAST_THEME`
- Smart folds: `emdFoldService`, `flattenSections`, `autoFoldMatchingSections`, `buildSmartFoldsExtension`, `buildFoldWidgetDecorations`, `SectionFoldWidget`
- Default configs: `DEFAULT_LIVE_MD_CONFIG`, `DEFAULT_SYNTAX_HIDER_CONFIG`, `DEFAULT_TEXT_STYLER_CONFIG`, `DEFAULT_LINK_RENDERER_CONFIG`, `DEFAULT_STATUS_BADGE_CONFIG`, `DEFAULT_TYPE_BADGE_CONFIG`, `DEFAULT_BLOCK_RESOLVER_CONFIG`, `DEFAULT_INLINE_WIDGETS_CONFIG`, `DEFAULT_SMART_FOLDS_CONFIG`
- Types: `LiveMdConfig`, `ThemeMode`, `EmdEditorProps`, `EmdEditorRef`, `EmdViewerProps`, and all live-md types

**EmdEditor component** (`editor.ts`):
- Props: `value`, `onChange`, `ast`, `config`, `className`, `readOnly`, `onNavigate`, `onSave`
- Ref: `focus()`, `blur()`, `getContent()`, `setContent(content)`, `undo()`, `redo()`, `getEditorView()`

**EmdViewer component** (`viewer.ts`):
- Props: `source`, `theme`, `className`, `onNavigate`
- Themes available: `'light'`, `'dark'`, `'high-contrast'`

**EMD section types** (24 total): task, decision, spec, api, bug, idea, verify, summary, detail, memory, log, meta, config, schema, model, agent, graph, prompt, template, human, draw, flow, kanban, example

**EMD statuses** (6): done, pending, in-progress, blocked, archived, cancelled

**Link relations** (20+): depends, blocks, related, requires, follows, precedes, extends, implements, defines, references, contains, supersedes, conflicts, mirrors, splits, merges, generates, consumes

**EMD syntax** for sample files:
```
## [task|done] Section Title
Section body content. Can include **markdown**, *italic*, `code`.
→ depends: other-file.emd
See [[other-page]] for more details.

### [subtask|in-progress] Nested Section
Nested content.

\`\`\`mermaid
graph TD
  A --> B
\`\`\`
```

**Vite config structure:** The current `vite.config.ts` uses `defineConfig` with lib mode. For the playground, add a `.ts` or separate vite config that serves `playground/index.html` as entry point. The playground should import SDK source directly via `../../src/index` so HMR works across the SDK source files.

## What to build

### Fc1-DevApp — Playground Application Shell

Create `sdk/react-emd/playground/` directory with:

1. **`playground/index.html`** — minimal HTML entry point:
   - `<div id="root"></div>`
   - `<script type="module" src="./main.tsx"></script>`

2. **`playground/main.tsx`** — React 18 `createRoot` entry point rendering `<App />`

3. **`playground/App.tsx`** — main application component with workspace layout:
   - **Left sidebar (250px)** — File Explorer listing sample .emd files. Renders a `<ul>` with filenames. Clicking a file opens it in a new tab. Highlights the currently active file. "Open all" button at top loads all sample files into tabs.
   - **Tab bar** — horizontal tab bar above the editor. Each tab shows filename + close button (×). Clicking a tab sets it as active. Closing a tab removes it. Active file content is loaded into the editor.
   - **Editor area** — renders `<EmdEditor>` with the active file's content. Controlled mode: `value` bound to active file content, `onChange` updates the tab content. Pass `config` for theme + feature toggles. Pass `onNavigate` to log navigation events to a console panel.
   - **Right sidebar (collapsible, 300px)** — Inspector Panel:
     - Theme switcher: radio buttons for light/dark/high-contrast
     - Feature toggles: checkboxes to enable/disable each decoration sub-feature (SyntaxHider, TextStyler, WikiLinks, SemanticLinks, StatusBadges, TypeBadges, BlockResolver, InlineWidgets, SmartFolds). Each toggle updates the `config` prop on `EmdEditor`.
     - Block Tester toggle button — opens Fc3-BlockTester in a modal
   - **Bottom panel (collapsible, 150px)** — Console/event log. Shows `onChange` calls, `onNavigate` events, parse errors, timing info.
   - **Toolbar** at the top: emd.dev badge, theme quick-switch, inspector toggle, save button

4. **CSS:** Use inline styles or a single `playground/styles.css`. The playground is not published — use hardcoded colors. Use `system-ui` font. Left sidebar: dark background (#1e1e2e), light text. Editor area: full white/theme background. Tab bar: #2d2d3f background. Make it look like a real IDE layout.

### Fc2-SampleFiles — Curated .emd Sample Files

Create `sdk/react-emd/playground/samples/` directory with these .emd files:

1. **`all-types.emd`** — 24 sections, one per section type. Each section has a type badge, a title, and 1-2 lines of content. Exercise all 6 statuses mixed across different types.

2. **`links.emd`** — 10 sections exercising every link relation type (depends, blocks, related, requires, follows, precedes, extends, implements, defines, references, contains, supersedes, conflicts, mirrors, splits, merges, generates, consumes). Each section has a `→ relation: target.emd` line. Also includes `[[wiki-link]]` examples.

3. **`code-blocks.emd`** — One section per code block tag supported by EMD: mermaid, draw, math, table, diff, task, media, canvas, flowchart, kanban, python, javascript, typescript, rust, bash, yaml, json. Each section has a heading with the tag type and a code fence with valid content.

4. **`nested.emd`** — Deeply nested sections (4 levels). Sections with mixed types and statuses at each level. Tests recursive rendering.

5. **`tasks.emd`** — Task-focused file with `[task|done]`, `[task|in-progress]`, `[task|pending]`, `[task|blocked]`. Includes `- [x]` and `- [ ]` checkboxes in content, progress indicators (e.g., "Progress: 60%").

6. **`decisions.emd`** — Decision log format. Multiple `[decision]` sections with context, options, rationale. Each links to related specs or tasks.

7. **`api-spec.emd`** — API documentation format. `[api]` sections with endpoints, parameters, responses. Uses `[spec]` for overview and `[schema]` for data models.

8. **`bug-tracker.emd`** — Bug tracking format. `[bug]` sections with reproduction steps, expected vs actual behavior. Statuses: in-progress, blocked, done.

9. **`project.emd`** — Full project file exercising realistic usage: `[meta]` metadata, `[summary]` overview, `[task]` sections with subtasks, `[decision]` log, `[memory]` notes, `[log]` entries. Wiki-links between sections.

10. **`malformed.emd`** — Intentionally malformed EMD to test error recovery. Missing closing brackets, invalid section types, broken links, unclosed code fences. Each malformation is in its own section with a `[bug]` type describing the expected diagnostic.

11. **`large.emd`** — Performance test. 500+ sections generated with varying types, content, and links. ~20KB file size. Used to verify decoration rebuild speed.

12. **`transclusion.emd`** — Transclusion examples using `![[file]]` syntax. Each section demonstrates embedding another section or file.

### Fc3-BlockTester — Isolated Block Rendering Tool

Create `playground/BlockTester.tsx` component (rendered as modal in DevApp):

1. **Section selector:** Dropdown listing all sections from the currently active file (parsed via `@everthink/emd`'s `parse()`). Selecting a section renders it in isolation.
2. **Raw EMD input:** Textarea to paste arbitrary EMD text for a single section. Parses on input and renders the result.
3. **Isolated viewport:** Renders the selected section using the same rendering pipeline as the editor but in a resizable container with a dark border. Shows type badge, status badge, title, content with all decorations.
4. **Decoration toggle grid:** Grid of checkboxes for each decoration sub-feature. Toggling one on/off immediately shows/hides that decoration in the viewport. Uses the EmdEditor with dynamic `config` prop.
5. **Performance meter:** Shows "Rebuild time: Xms" for each decoration rebuild. Uses `performance.now()` before and after changing config.
6. **Decoration overlay mode:** Toggle that renders colored rectangles over each decoration range in the viewport. Each sub-feature gets a different color (e.g., syntax hider = blue, text styler = green, etc.). Helps debug decoration positioning.

### Vite Dev Server Configuration

Create `sdk/react-emd/playground/vite.config.ts` — a separate Vite config for the playground dev server:
- Entry: `playground/index.html`
- Resolve alias to import `@everthink/react-emd` as `../../src/index` (so HMR works on SDK source)
- Externalize nothing — bundle everything (unlike the lib build)
- Port 5173

Add a `"dev"` script to the existing `sdk/react-emd/package.json` that points to the playground config:
```json
"dev": "vite --config playground/vite.config.ts"
```

The existing `"dev": "vite"` script in package.json — leave it untouched or replace with the playground config path.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/playground/index.html` | CREATE — entry HTML with root div + module script |
| `sdk/react-emd/playground/main.tsx` | CREATE — React 18 createRoot entry |
| `sdk/react-emd/playground/App.tsx` | CREATE — full workspace layout |
| `sdk/react-emd/playground/App.css` | CREATE — workspace layout styles |
| `sdk/react-emd/playground/BlockTester.tsx` | CREATE — isolated block rendering tool |
| `sdk/react-emd/playground/BlockTester.css` | CREATE — BlockTester styles |
| `sdk/react-emd/playground/vite.config.ts` | CREATE — dev server config |
| `sdk/react-emd/playground/samples/all-types.emd` | CREATE — 24 sections, all types |
| `sdk/react-emd/playground/samples/links.emd` | CREATE — 18 link relations |
| `sdk/react-emd/playground/samples/code-blocks.emd` | CREATE — 17 code block tags |
| `sdk/react-emd/playground/samples/nested.emd` | CREATE — 4-level nesting |
| `sdk/react-emd/playground/samples/tasks.emd` | CREATE — task tracking |
| `sdk/react-emd/playground/samples/decisions.emd` | CREATE — decision log |
| `sdk/react-emd/playground/samples/api-spec.emd` | CREATE — API docs |
| `sdk/react-emd/playground/samples/bug-tracker.emd` | CREATE — bug tracking |
| `sdk/react-emd/playground/samples/project.emd` | CREATE — realistic project |
| `sdk/react-emd/playground/samples/malformed.emd` | CREATE — error recovery tests |
| `sdk/react-emd/playground/samples/large.emd` | CREATE — 500+ sections |
| `sdk/react-emd/playground/samples/transclusion.emd` | CREATE — transclusion examples |
| `sdk/react-emd/package.json` | MODIFY — update "dev" script |

## Verification

```bash
cd sdk/react-emd
npm run dev          # Playground loads at localhost:5173
npx tsc --noEmit     # Must be clean (new playground files compile)
npm test             # All 218 tests still pass (playground not testable)
npm run build        # Library build still succeeds (playground excluded from bundle)
```

Note: The playground has no automated tests. Verification is manual — open in browser, click through File Explorer, open sample files, toggle theme, toggle features, use Block Tester, verify decorations render correctly.

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fc-Playground/TODO.md`
2. Update `features/F2-ReactSdk/Fc-Playground/DOCS.md` with implementation notes
3. Update `CYCLES.md` — mark Phase 5 task 3 (Fc-Playground) as `[x]`
4. Run `npx tsc --noEmit`, `npm test`, and `npm run build` — all must pass
5. **Commit everything:** `git add -A && git commit -m "Phase 14 (Fc-Playground): Vite React dev playground with file explorer, tab bar, EmdEditor/EmdViewer integration, 12 sample .emd files, BlockTester, and theme/feature toggle inspector"`
6. Generate Phase 15 prompt for Fd-AiPanel
