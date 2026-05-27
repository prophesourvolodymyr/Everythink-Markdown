# Phase 06 of Fa6-BlockResolver — Widget-Resolved Code Block Rendering

## Context
Phases 01-05 are complete. The `@everthink/react-emd` package now has five decoration builders in `view-plugin.ts`'s `BUILDERS` array. Fa5-TypeBadge was just completed, rendering type label pills at the start of section headings.

Fa6-BlockResolver is significantly more complex than previous phases. It replaces fenced code blocks tagged with EMD-specific types (` ```mermaid `, ` ```draw `, ` ```katex `, etc.) with interactive widget renderers. This is the mechanism that transforms EMD from a text format into a rich document format.

75 tests pass (12 + 13 + 7 + 7 + 8 + 16 + 12). `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/type-badge.ts` | Latest widget pattern: TypePillWidget extends WidgetType |
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig, DecorationBuilder type, pattern for config interfaces |
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array (now 5 builders), plugin value class |
| `sdk/react-emd/src/live-md/__tests__/type-badge.test.ts` | Latest test patterns |
| `sdk/react-emd/src/live-md/index.ts` | Export patterns |
| `sdk/react-emd/src/index.ts` | Top-level export patterns |
| `features/F2-ReactSdk/Fa-LiveMd/Fa6-BlockResolver/DOCS.md` | Full spec: registry, lifecycle, built-in widgets, write-back |
| `features/F2-ReactSdk/Fa-LiveMd/Fa6-BlockResolver/TODO.md` | Checklist: 5 tasks |

## Codebase learnings (from Phase 01-05)

**Widget pattern:** All widgets extend `WidgetType` from `@codemirror/view`. They have `eq()`, `toDOM()`, and store state in private fields. `Decoration.widget({ widget, side: 1 })` is used to insert widgets at positions.

**Lezer tree navigation:** Use `tree.cursor()` to iterate lezer nodes. Node types include `ATXHeading1-6`, `FencedCode`, `CodeFence`, `CodeText`, `InfoString`. The lezer markdown parser provides the info string (the text after ` ``` `) as part of the `FencedCode` node.

**Lezer code block structure:** A `FencedCode` node contains child nodes:
- `CodeFence` — the opening ` ``` ` markers
- `InfoString` — the tag/language text after the opening fence (e.g., `mermaid`)
- `CodeText` — the body content between the fences
- Another `CodeFence` — the closing ` ``` ` markers

**Decoration placement:**
- `Decoration.widget({ widget, side: 1 }).range(pos)` — inserts widget at `pos`
- `Decoration.replace({}).range(from, to)` — hides a text range (used by Fa1-SyntaxHider)
- For block widgets: use `Decoration.replace({ widget, block: true }).range(from, to)` to create a block-level widget replacement that covers the entire code fence range

**EditorState access:** In the DecorationBuilder function signature, the 4th parameter is `EditorState`, allowing access to `state.doc.toString()` for document text access.

**Fa1 interaction:** Fa1-SyntaxHider hides code fence markers via `Decoration.replace`. When Fa6 replaces an entire code block region with a widget, Fa1's decorations will be overridden/covered by Fa6's. No special coordination needed — CodeMirror handles decoration layering.

**Test approach:** Create real `EditorState` with `markdown({ base: markdownLanguage })`, get `syntaxTree(state)`, call the builder, assert on returned decorations. Access widget via `(d.value as any).spec.widget`. Test DOM via `widget.toDOM()`.

## What to build

### 1. BlockWidget interface and BlockResolverConfig

Add to `sdk/react-emd/src/live-md/types.ts`:

```ts
export interface BlockWidgetContext {
  view: any; // EditorView reference (set at mount time)
  sourceSpan: { from: number; to: number };
  writeBack: (content: string) => void;
}

export interface BlockWidget {
  mount(container: HTMLElement): void;
  update(content: string): void;
  destroy(): void;
  getEstimatedHeight(): number;
  eq(other: BlockWidget): boolean;
}

export type BlockWidgetConstructor = (
  content: string,
  context: BlockWidgetContext
) => BlockWidget;

export interface BlockResolverConfig {
  enabled: boolean;
  widgets: Record<string, BlockWidgetConstructor>;
  lazyLoad: boolean;
  maxBlockSize: number;
  debounceUpdateMs: number;
}
```

With `DEFAULT_BLOCK_RESOLVER_CONFIG`. Default: enabled=true, widgets={} (empty, populated below), lazyLoad=true, maxBlockSize=10000, debounceUpdateMs=200.

Add `blockResolver: BlockResolverConfig` to `LiveMdConfig`. Add to `DEFAULT_LIVE_MD_CONFIG`.

### 2. block-resolver.ts — Core Decoration Builder + Widget Registry

Create `sdk/react-emd/src/live-md/block-resolver.ts` with:

**Widget registry functions (singleton per editor, but stored in a module-level Map for simplicity):**
```ts
const widgetRegistry = new Map<string, BlockWidgetConstructor>();

export function registerBlockWidget(tag: string, constructor: BlockWidgetConstructor): void { ... }
export function unregisterBlockWidget(tag: string): void { ... }
export function getBlockWidget(tag: string): BlockWidgetConstructor | undefined { ... }
```

**Known programming languages** — a Set of common language identifiers (javascript, js, typescript, ts, python, py, rust, rs, go, java, c, cpp, csharp, cs, ruby, rb, php, swift, kotlin, scala, elixir, ex, haskell, hs, lua, r, sql, sh, bash, zsh, yaml, yml, json, xml, html, css, scss, sass, less, graphql, gql, dockerfile, docker, toml, ini, cfg, makefile, cmake, perl, pl). If a code fence tag matches one of these, treat it as a standard code block (not an EMD widget block).

**Main builder function:**
```ts
export function buildBlockResolverDecorations(
  tree: Tree,
  _ast: EmdDocument | null,
  config: BlockResolverConfig,
  state: EditorState
): Range<Decoration>[]
```

Logic:
1. If config is disabled, return `[]`
2. Walk lezer tree, find `FencedCode` nodes
3. For each `FencedCode`, find its `InfoString` child to get the tag
4. If tag is empty, matches a known programming language, or is a standard lang — skip (no decoration)
5. Look up tag in `config.widgets` (the config-level registry) — if no widget registered, skip
6. If block content length > config.maxBlockSize, skip with a warning
7. Create a `BlockWidgetDecoration` (a `WidgetType` subclass that manages the BlockWidget lifecycle)
8. Use `Decoration.replace({ widget: blockWidget, block: true }).range(fencedCode.from, fencedCode.to)` to create a block-level replacement

**BlockWidgetDecoration class:**
```ts
class BlockWidgetDecoration extends WidgetType {
  constructor(
    private tag: string,
    private content: string,
    private constructor: BlockWidgetConstructor,
    private sourceSpan: { from: number; to: number },
    private view: EditorView,
  ) { super(); }

  // On mount: create widget, call widget.mount(container)
  // eq: compare by tag + content hash
  // toDOM: create container, mount widget into it
  // On destroy: call widget.destroy()
  // get estimatedHeight from widget
}
```

**InfoString extraction helper:**
```ts
function getCodeFenceTag(infoString: string): string {
  const trimmed = infoString.trim();
  const spaceIndex = trimmed.indexOf(' ');
  return spaceIndex > 0 ? trimmed.slice(0, spaceIndex) : trimmed;
}
```

**Write-back mechanism:**
The `BlockWidgetContext.writeBack` callback replaces the code block's text content (between the fences) in the document. It dispatches a transaction on the EditorView:
```ts
writeBack: (newContent: string) => {
  const doc = view.state.doc;
  const blockContentFrom = /* position after opening fence + newline */;
  const blockContentTo = /* position before closing fence */;
  view.dispatch({
    changes: { from: blockContentFrom, to: blockContentTo, insert: newContent }
  });
}
```

### 3. Built-in Widgets — Empty Stubs with Loading Indicator

Create `sdk/react-emd/src/live-md/block-widgets/` directory with stub widget constructors for:

| File | Tag | Description |
|------|-----|-------------|
| `mermaid.ts` | `mermaid` | Renders Mermaid.js diagrams (lazy-loaded) |
| `katex.ts` | `katex` | Renders KaTeX math (lazy-loaded) |
| `diff.ts` | `diff` | Renders side-by-side diff view |
| `html-widget.ts` | `html` | Renders HTML in sandboxed iframe |

For Phase 06, these are **stubs only** — they render a placeholder `<div>` with:
- The tag name as text
- The block content as a `<pre>` block inside
- A small "widget placeholder" CSS class

Each stub implements the full `BlockWidget` interface (mount, update, destroy, getEstimatedHeight, eq) but only renders the placeholder. The real rendering is implemented in future phases.

**Mermaid stub example:**
```ts
export function createMermaidWidget(content: string, context: BlockWidgetContext): BlockWidget {
  let container: HTMLElement | null = null;
  return {
    mount(el) {
      container = el;
      el.innerHTML = `<div class="emd-block-widget emd-block-placeholder">
        <div class="emd-block-widget-header">mermaid</div>
        <pre>${escapeHtml(content)}</pre>
      </div>`;
    },
    update(content) {
      if (container) this.mount(container);
    },
    destroy() { container = null; },
    getEstimatedHeight() { return 150; },
    eq(other) { return false; },
  };
}
```

### 4. Register built-in widgets on init

Create `sdk/react-emd/src/live-md/block-widgets/index.ts` that exports a `registerBuiltinBlockWidgets(config: BlockResolverConfig)` function which registers all 4 stub widgets into the config's widget map. This is called from the main plugin initialization.

### 5. ViewPlugin update

In `view-plugin.ts`:
1. Import `buildBlockResolverDecorations` from `./block-resolver`
2. Add `(tree, _ast, config, state) => buildBlockResolverDecorations(tree, _ast, config.blockResolver, state)` as the 6th builder in BUILDERS

### 6. Public API

Update `src/live-md/index.ts` and `src/index.ts` to export:
- `BlockResolverConfig`, `DEFAULT_BLOCK_RESOLVER_CONFIG`
- `BlockWidget`, `BlockWidgetContext`, `BlockWidgetConstructor`
- `registerBlockWidget`, `unregisterBlockWidget`, `getBlockWidget`
- `buildBlockResolverDecorations`
- `registerBuiltinBlockWidgets`

### 7. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/block-resolver.test.ts`:

Tests (at least 8):
1. Fenced code with registered tag (`mermaid`) produces a block decoration
2. Fenced code with unregistered tag produces no decoration
3. Fenced code with known programming language tag (javascript/python) produces no decoration
4. Empty info string produces no decoration
5. Disabled config produces no decorations
6. registerBlockWidget / unregisterBlockWidget / getBlockWidget round-trip
7. Block widget stub renders placeholder DOM correctly
8. Block widget stub update and destroy lifecycle works
9. Multiple code blocks in one document get correct decorations
10. Block size exceeds maxBlockSize → no decoration (content too large)

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add BlockWidgetContext/BlockWidget/BlockWidgetConstructor/BlockResolverConfig + default, add to LiveMdConfig |
| `sdk/react-emd/src/live-md/block-resolver.ts` | NEW — widget registry + decoration builder + BlockWidgetDecoration |
| `sdk/react-emd/src/live-md/block-widgets/mermaid.ts` | NEW — Mermaid stub widget |
| `sdk/react-emd/src/live-md/block-widgets/katex.ts` | NEW — KaTeX stub widget |
| `sdk/react-emd/src/live-md/block-widgets/diff.ts` | NEW — Diff stub widget |
| `sdk/react-emd/src/live-md/block-widgets/html-widget.ts` | NEW — HTML stub widget |
| `sdk/react-emd/src/live-md/block-widgets/index.ts` | NEW — registerBuiltinBlockWidgets |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add Fa6 builder to BUILDERS |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/live-md/__tests__/block-resolver.test.ts` | NEW — 10+ tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa6-BlockResolver/TODO.md` | MODIFY — mark tasks [x] |
| `features/F2-ReactSdk/Fa-LiveMd/TODO.md` | MODIFY — update progress note |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (75 existing + ~10 new = ~85)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa6-BlockResolver/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note to include Fa6-BlockResolver ✅
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 06 (Fa6-BlockResolver): widget-resolved code block rendering"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-07-InlineWidgets.md`
