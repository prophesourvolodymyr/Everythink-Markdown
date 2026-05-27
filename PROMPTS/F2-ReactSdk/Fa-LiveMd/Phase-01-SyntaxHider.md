# Phase 01 of F2-ReactSdk Fa-LiveMd — Syntax Hider + Package Scaffold

## Context

EMD (Everything MarkDown) is a typed, semantic superset of Markdown. We build the full ecosystem: Rust parser, WASM core, CLI, and three SDKs that let developers drop a full EMD editor into any app.

F1-EmdCore (Rust) is complete — parser, validator, serializer, WASM target (`@everthink/emd` on npm), CLI, LSP, and context loader. The TypeScript web editor in `interpreter/` has CodeMirror 6 integrated with 13 block plugins (markdown, code, mermaid, katex, html, image, table, diff, task, media, canvas, flowchart, kanban), but it uses CustomElements directly, not React. It has no live preview — users see raw markdown syntax (`##`, `**`, `- [ ]`).

We are now building F2-ReactSdk (`@everthink/react-emd`) — the first SDK. It provides `<EmdEditor />` and `<EmdViewer />` React components that developers `npm install` into any React app (Tauri, Electron, Next.js, browser). The SDK has four sub-features at the top level: Fa-LiveMd (the CodeMirror 6 live preview engine), Fb-Components (React component exports), Fc-Playground (local dev app), and Fd-AiPanel (AI chat).

Fa-LiveMd is the heart. It is a CodeMirror 6 ViewPlugin that transforms raw markdown text into a visually rich document by hiding syntax markers, styling text, inserting type/status badges, rendering block widgets, and applying themes. It is composed of 8 sub-sub-features: Fa1-SyntaxHider, Fa2-TextStyler, Fa3-LinkRenderer, Fa4-StatusBadge, Fa5-TypeBadge, Fa6-BlockResolver, Fa7-InlineWidgets, Fa8-ThemeEngine. Each is a pure function `(tree, ast, config) → Decoration[]`. Fa-LiveMd orchestrates them.

This is Phase 01. It scaffolds the entire `@everthink/react-emd` package and builds Fa1-SyntaxHider — the first and most foundational sub-feature.

## What you need to read first

| File | Why |
|------|-----|
| `features/F2-ReactSdk/DOCS.md` | SDK overview, architecture, dependencies |
| `features/F2-ReactSdk/Fa-LiveMd/DOCS.md` | Live preview engine architecture, input/output contract, internal design |
| `features/F2-ReactSdk/Fa-LiveMd/Fa1-SyntaxHider/DOCS.md` | Full spec for what SyntaxHider hides, how it works, edge cases |
| `features/F2-ReactSdk/Fa-LiveMd/Fa1-SyntaxHider/TODO.md` | Checklist: 5 tasks to mark done |
| `interpreter/package.json` | Existing CodeMirror 6 dependencies and versions to reuse |
| `interpreter/src/blocks/markdown-block.ts` | Reference: how CodeMirror 6 is instantiated in this codebase |
| `interpreter/index.html` | CSS variable system (`--emd-*`) that the theme engine uses |
| `AGENTS.md` | The agent meta-guide and F-Cycle project management system |
| `CYCLES.md` | Current phase status and dependencies |

## Codebase learnings

**Architecture pattern:** Fa-LiveMd is a CodeMirror 6 `ViewPlugin`. Each sub-feature (Fa1-Fa8) exports a decoration builder function. Fa-LiveMd's `update()` calls each builder, merges decorations, and returns the set to CodeMirror. Fa-LiveMd does not import React.

**CodeMirror 6 fundamentals (from existing codebase):**
- `EditorView` is the DOM wrapper. Created via `new EditorView({ parent, doc, extensions })`.
- `EditorState` holds the document, selection, and facets. Immutable.
- `@codemirror/lang-markdown` provides the lezer markdown grammar. `syntaxTree(state)` returns the parsed tree.
- `ViewPlugin` is a CM6 extension type. It defines a class with `update(update: ViewUpdate)` and `decorations` getter.
- `Decoration.replace({})` makes a range invisible (zero width). No DOM element created.
- `Decoration.mark({attributes})` applies CSS styles to a range.
- `Decoration.widget({widget})` replaces a range with a DOM element.
- `Decoration.set.of(decorations, sort: true)` creates the set that the ViewPlugin returns.

**Lezer markdown node types** (from `@lezer/markdown` grammar, same as `@codemirror/lang-markdown`):
- `HeaderMark` — the `#` characters in headings
- `EmphasisMark` — the `*` or `_` markers around italic text
- `StrongEmphasisMark` — the `**` or `__` markers around bold text
- `CodeMark` — the backticks around inline code
- `LinkMark` — the `[` and `]` around link text
- `URL` — the `(url)` part of a link
- `CodeFence` — the `` ``` `` markers of fenced code blocks
- `QuoteMark` — the `>` prefix on blockquote lines
- `ListMark` — the `-`, `*`, `+`, or `1.` list markers
- `TaskMarker` — the `[ ]` or `[x]` in task lists (GFM extension)
- `HR` — horizontal rules `---`/`***`/`___`

**Existing deps (from interpreter/package.json):** `@codemirror/view ^6.35`, `@codemirror/state ^6.5`, `@codemirror/lang-markdown ^6.3`, `@codemirror/language ^6.10`. These exact versions are proven working.

**CSS variable naming:** The codebase uses `--emd-*` namespace for all theming. Variables include `--emd-bg`, `--emd-text`, `--emd-accent`, `--emd-font`, `--emd-mono`. The theme engine (Fa8) will define these; for now, Fa1 just needs to reference them in any widgets it creates (list bullet widgets need a color).

**The existing interpreter code at `interpreter/` is a reference only.** It uses CustomElements, not React. Fa1-SyntaxHider is built into the new SDK package at `sdk/react-emd/`, NOT into the `interpreter/` directory. The interpreter will eventually be rewritten to consume the SDK, but not during this phase.

## What to build

### 1. Package scaffolding

Create `sdk/react-emd/` as a new npm package with:
- `package.json` — name `@everthink/react-emd`, version `0.1.0`, type `module`, main `dist/index.js`, exports `./editor` and `./viewer`. Dependencies: `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/language`, `@everthink/emd`, `react`, `react-dom`. DevDependencies: `vite`, `vitest`, `typescript`, `@types/react`, `@types/react-dom`, `jsdom`.
- `tsconfig.json` — standard React + Vite config. Path aliases if needed.
- `vite.config.ts` — Vite library mode. Build ESM + UMD. Externals: react, react-dom.
- `src/index.ts` — main entry point. Exports `{ EmdEditor, EmdViewer, liveMarkdownPlugin }` (most are stubs for now, only liveMarkdownPlugin is functional).
- `src/live-md/index.ts` — exports `liveMarkdownPlugin()` function that returns a CodeMirror 6 Extension array.
- `src/live-md/view-plugin.ts` — the Fa-LiveMd ViewPlugin class skeleton. For Phase 01, it only calls Fa1-SyntaxHider's builder. Subsequent phases add Fa2-Fa8 calls.

### 2. Fa1-SyntaxHider implementation

Create `src/live-md/syntax-hider.ts` with:
- Export: `buildSyntaxHiderDecorations(tree: Tree, config: SyntaxHiderConfig) → Decoration[]`
- Import: `SyntaxTree` interface from lezer (via `@codemirror/language`), `Decoration` from `@codemirror/view`
- `SyntaxHiderConfig` type: `{ enabled: boolean; hideHeadingMarks: boolean; hideEmphasisMarks: boolean; hideCodeMarks: boolean; hideLinkMarks: boolean; hideCodeFences: boolean; hideQuoteMarks: boolean; hideListMarks: boolean; hideImageMarks: boolean }`

The implementation walks the syntax tree using `tree.cursor()` (the `TreeCursor` API from lezer). For each node visited, it checks the node type name against the known marker types:
- `HeaderMark` → `Decoration.replace({})`
- `EmphasisMark` → `Decoration.replace({})`
- `StrongEmphasisMark` → `Decoration.replace({})`
- `CodeMark` → `Decoration.replace({})`
- `LinkMark` → `Decoration.replace({})`
- `URL` → `Decoration.replace({})`
- `CodeFence` → `Decoration.replace({})` (but skip if descendant of a widget-resolved block — in Phase 01, skip all FencedCode content since BlockResolver isn't built yet)
- `QuoteMark` → `Decoration.replace({})`
- `ListMark` → `Decoration.replace({})`
- `TaskMarker` → `Decoration.replace({})`
- `HR` → `Decoration.replace({})` with a small line widget (simple `<hr>` or `<div>` with border)

Key logic: the tree walk must avoid nodes that are inside `FencedCode` or `HTMLBlock` parents (those blocks will be handled by Fa6-BlockResolver). In Phase 01, since BlockResolver doesn't exist yet, skip all descendants of `FencedCode` and `HTMLBlock` nodes. Use `tree.cursor()` in `iterate` mode — it visits every node depth-first. Track parent node types to know when to skip.

The function returns an array of `Decoration` objects (not `Decoration.set` — the parent ViewPlugin creates the set).

### 3. ViewPlugin skeleton

Create `src/live-md/view-plugin.ts` with:
- A `LiveMdPlugin` class implementing the ViewPlugin pattern.
- Constructor receives a `LiveMdConfig` (subsumes all sub-feature configs plus theme, debounce, EmdDocument AST reference).
- `update(update: ViewUpdate)` method: checks if doc changed, resets debounce timer, when timer fires calls `rebuildDecorations(state)`.
- `rebuildDecorations(state: EditorState)` method: gets the lezer tree via `syntaxTree(state)`, calls `buildSyntaxHiderDecorations(tree, config)`, collects results in an array, later phases will add more builder calls. Returns `Decoration.set.of(decorations, true)`.
- Debounce: use a simple `setTimeout`/`clearTimeout` pattern with configurable delay (default 200ms). Store the debounce state on the plugin instance.

### 4. Public API entry point

In `src/live-md/index.ts`, export a `liveMarkdownPlugin(config?: Partial<LiveMdConfig>): Extension[]` function that:
- Creates the ViewPlugin with merged default config + user config.
- Returns an array with the ViewPlugin extension (ready to spread into `new EditorView({ extensions: [...] })`).

### 5. Unit tests

Create `src/live-md/__tests__/syntax-hider.test.ts` with vitest. Tests:
1. Creates a mock lezer tree with `HeaderMark` nodes, calls `buildSyntaxHiderDecorations`, verifies decorations exist with correct `from`/`to` ranges and `replace` type.
2. Creates a mock tree with `EmphasisMark` and `StrongEmphasisMark` nodes, verifies both are hidden.
3. Creates a mock tree with a `FencedCode` parent containing a `CodeMark` child, verifies NO decoration is produced for the child (the skip-descendants logic works).
4. Creates a mock tree with escaped markers (backslash-escaped, which lezer parses as `Escape` nodes, not emphasis nodes), verifies no decorations for those.
5. Tests the `SyntaxHiderConfig` — when a specific marker type is disabled in config, that type produces no decorations.

Create `src/live-md/__tests__/view-plugin.test.ts` with vitest. Tests:
6. Creates a real CodeMirror EditorView with `@codemirror/lang-markdown` and `liveMarkdownPlugin({ debounceMs: 0 })` loaded. Sets document text to `## Heading\n**bold**\n- list`. Verifies that the ViewPlugin's decorations contain hide decorations at the expected positions. Uses `EditorView` in a jsdom environment (vitest + jsdom).

For mock lezer trees: lezer's `Tree` and `TreeCursor` are complex to construct manually. The simplest approach for unit tests 1-4: use `@lezer/generator` to create a tiny test grammar, or (much simpler) use a real `EditorView` with a real markdown document and test the decorations produced by the real pipeline. The integration test (test #6) is the most reliable approach because it exercises the full pipeline. Tests 1-5 can be integration tests that isolate by toggling individual config options rather than truly mocking the tree.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/package.json` | NEW — npm package config with all deps |
| `sdk/react-emd/tsconfig.json` | NEW — TypeScript config |
| `sdk/react-emd/vite.config.ts` | NEW — Vite library build config |
| `sdk/react-emd/src/index.ts` | NEW — public API exports |
| `sdk/react-emd/src/live-md/index.ts` | NEW — liveMarkdownPlugin entry point |
| `sdk/react-emd/src/live-md/view-plugin.ts` | NEW — Fa-LiveMd ViewPlugin skeleton |
| `sdk/react-emd/src/live-md/syntax-hider.ts` | NEW — Fa1-SyntaxHider implementation |
| `sdk/react-emd/src/live-md/types.ts` | NEW — LiveMdConfig, SyntaxHiderConfig, DecorationBuilder types |
| `sdk/react-emd/src/live-md/__tests__/syntax-hider.test.ts` | NEW — unit/integration tests |
| `sdk/react-emd/src/live-md/__tests__/view-plugin.test.ts` | NEW — ViewPlugin integration tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa1-SyntaxHider/TODO.md` | MODIFY — mark tasks [x] |

Do NOT modify anything in `interpreter/` or `emd/`. SDK code lives in `sdk/react-emd/`.

## Verification

```bash
cd sdk/react-emd
npm install               # Must resolve all deps
npx tsc --noEmit          # Must be clean — no type errors
npm test                  # All SyntaxHider tests must pass (5+)
npm run build             # Library build must succeed
```

Also verify manually:
- `npm run dev` (if a playground app is set up) — open a page with a CM6 editor + liveMarkdownPlugin, type `## Hello **world** - list`, verify `##` hidden, `**` hidden, `-` hidden, text styled correctly.

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa1-SyntaxHider/TODO.md`
2. Mark task #1 in `features/F2-ReactSdk/Fa-LiveMd/TODO.md` as `[x]`
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-02-TextStyler.md`
