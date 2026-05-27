# Phase 04 of Fa4-StatusBadge — Section Status Indicator Rendering

## Context

Phase 01 (Fa1-SyntaxHider), 02 (Fa2-TextStyler), and 03 (Fa3-LinkRenderer) are complete. The `@everthink/react-emd` package at `sdk/react-emd/` has three decoration builders registered in `view-plugin.ts`'s `BUILDERS` array. The `DecorationBuilder` type now has 4 params: `(tree, ast, config, state)`.

Fa1 hides syntax markers. Fa2 applies visual styles to headings, emphasis, links, etc. Fa3 renders wiki-links (`[[target]]`) with dotted underline and semantic links (`→ relation: target`) with colored badges.

47 tests pass (12 syntax-hider + 13 text-styler + 7 view-plugin + 7 wiki-link + 8 semantic-link). `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

Fa4-StatusBadge renders small color-coded status indicators next to EMD section headings. Instead of reading raw text like `|done` or `|in-progress`, users see colored dots or pills. The status is read from the **EmdDocument AST** (`EmdSection.status`), not from regex on document text. This guarantees accuracy: unparseable status → unknown indicator → diagnostic.

**EMD section headers** look like `## [task|in-progress] Build UI`. The `|status` annotation is parsed by F1-EmdCore into the `EmdSection.status` field. Status values: `done`, `pending`, `in-progress`, `blocked`, `archived`, `cancelled`, `unknown`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig, DecorationBuilder type, add StatusBadgeConfig |
| `sdk/react-emd/src/live-md/wiki-link.ts` | Pattern: regex scan + tree-based exclusion for non-standard syntax |
| `sdk/react-emd/src/live-md/semantic-link.ts` | Pattern: regex scan + tree-based exclusion + badge colors |
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array to add Fa4; `this.ast` holds EmdDocument |
| `sdk/react-emd/src/live-md/__tests__/wiki-link.test.ts` | Test patterns for decoration assertions |
| `features/F2-ReactSdk/Fa-LiveMd/Fa4-StatusBadge/DOCS.md` | Full spec of status values, colors, pill rendering, interactivity |
| `features/F2-ReactSdk/Fa-LiveMd/Fa4-StatusBadge/TODO.md` | Checklist: 5 tasks to mark done |
| `node_modules/@everthink/emd/dist/emd.d.ts` or types | Check `EmdDocument`, `EmdSection`, `SectionStatus` types |

## Codebase learnings (from Phase 01-03)

**Package structure:** `sdk/react-emd/` is a Vite library-mode package. Source in `src/`, tests in `__tests__/`. Path alias `@live-md/*` → `src/live-md/*`.

**Test approach:** Tests create real `EditorState` with `markdown({ base: markdownLanguage })`, get `syntaxTree(state)`, call the builder, assert on returned decorations. Access decoration attributes via `(decoration as any).spec?.attributes?.style`.

**Lezer markdown nodes:** ATXHeading1-6 wrap entire heading lines including `#` markers. HeaderMark is the `#` part. Heading content text follows.

**Decoration types used so far:**
- `Decoration.mark({ attributes: { style: '...', class: '...' } })` — inline CSS on a text range
- `Decoration.replace({})` — hides a text range
- `Decoration.widget({ widget })` — replaces a position with a DOM element (NOT yet used by any builder, but Fa4 will use it)

**DecorationBuilder signature** (4 params):
```ts
export type DecorationBuilder = (
  tree: Tree,
  ast: EmdDocument | null,
  config: LiveMdConfig,
  state: EditorState
) => Range<Decoration>[];
```

**AST access:** `this.ast` in `LiveMdPlugin` holds the `EmdDocument | null` from F1-EmdCore. The AST is passed to each builder as the 2nd parameter. The `EmdDocument` type has a `sections: EmdSection[]` array. Each `EmdSection` has `status: SectionStatus`, `title: string`, `heading_level: number`, and `source_pos: { from: number, to: number }` (or similar source location info).

**Important:** Check the actual `@everthink/emd` types in `node_modules/@everthink/emd/` to understand the exact `EmdDocument`, `EmdSection`, and `SectionStatus` type structures before implementing. The types determine how you match lezer heading nodes to AST sections.

## What to build

### 1. StatusBadgeConfig

Add to `sdk/react-emd/src/live-md/types.ts`:
```ts
export interface StatusBadgeConfig {
  enabled: boolean;
  mode: 'dot' | 'pill';
  colors: Record<string, string>;
}
```

With a `DEFAULT_STATUS_BADGE_CONFIG` constant. Default mode: `'dot'`. Default colors:
- done: `#22c55e`, pending: `#9ca3af`, in-progress: `#f59e0b`
- blocked: `#ef4444`, archived: `#6b7280`, cancelled: `#6b7280`
- unknown: `#9ca3af`

Add `statusBadge: StatusBadgeConfig` to `LiveMdConfig`.

### 2. status-badge.ts — Status Indicator Widget

Create `sdk/react-emd/src/live-md/status-badge.ts` with:

**Widget class:**
```ts
class StatusDotWidget extends WidgetType {
  constructor(private status: string, private color: string) { super(); }
  eq(other: StatusDotWidget): boolean { return this.status === other.status; }
  toDOM(): HTMLElement {
    const dot = document.createElement('span');
    dot.className = 'emd-status-badge';
    dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${this.color};margin-right:6px;vertical-align:middle;`;
    dot.title = this.status;
    return dot;
  }
}
```

**Main builder function:**
```ts
export function buildStatusBadgeDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: StatusBadgeConfig
): Range<Decoration>[]
```

Logic:
1. If config disabled or AST is null, return `[]`
2. Walk the lezer tree with a cursor, find all `ATXHeading1`-`ATXHeading6` nodes
3. For each heading:
   a. Extract the heading text (from `HeaderMark` end to end of heading node)
   b. Find the matching `EmdSection` in the AST by comparing heading level and title text. Use a simple heuristic: find the first AST section whose `heading_level` matches the lezer heading level and whose title is a substring of the heading text.
   c. If a matching section is found and has a status other than `unknown`-like (check exact enum name from `@everthink/emd`), create a `Decoration.widget()` at the position after `HeaderMark` + 1 (to put it right after the `#` markers, before the section type badge area)
   d. The widget should be a `StatusDotWidget` or `StatusPillWidget` based on `config.mode`

**Alternative simpler approach for matching:** If the AST has `source_pos` or byte positions for sections, match headings by their line number or byte range. If not available, match by title substring.

**If the AST is null or has no sections**, the builder should gracefully return `[]` (no crash, no decoration).

### 3. ViewPlugin update

In `view-plugin.ts`:
1. Import and add `(tree, ast, config, _state) => buildStatusBadgeDecorations(tree, ast, config.statusBadge)` as the 4th builder in BUILDERS

### 4. Public API

Update `src/live-md/index.ts` and `src/index.ts` to export `StatusBadgeConfig`, `DEFAULT_STATUS_BADGE_CONFIG`, `buildStatusBadgeDecorations`.

### 5. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/status-badge.test.ts`:

**Test strategy:** Since the AST is needed for status extraction, tests can:
1. Create a mock `EmdDocument` with one section that has a known status and heading level
2. Create an `EditorState` with a matching heading and pass the mock AST to the builder
3. Assert on the returned decorations

Tests:
1. `|done` section produces a green dot widget (#22c55e)
2. `|in-progress` section produces an amber dot widget (#f59e0b)
3. `|blocked` section produces a red dot widget (#ef4444)
4. Section with no status in AST produces no decoration
5. AST is null → returns `[]`
6. Disabled config produces no decorations
7. Pill mode produces pill-shaped widget (check class and border-radius)
8. Unknown status produces the unknown indicator widget

**Important:** The exact test approach depends on the `EmdDocument`/`EmdSection` types from `@everthink/emd`. Mock the AST structure to match the real types. For tests that require the real WASM parser, you can also parse actual `.emd` text through F1-EmdCore — but for unit test speed, mocking is preferred.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add StatusBadgeConfig + default, add to LiveMdConfig |
| `sdk/react-emd/src/live-md/status-badge.ts` | NEW — status dot/pill widget + decoration builder |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add Fa4 builder to BUILDERS |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/index.ts` | MODIFY — export StatusBadgeConfig |
| `sdk/react-emd/src/live-md/__tests__/status-badge.test.ts` | NEW — 8 tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa4-StatusBadge/TODO.md` | MODIFY — mark tasks [x] |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (47 existing + ~8 new = ~55)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa4-StatusBadge/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 04 (Fa4-StatusBadge): section status indicator rendering"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-05-TypeBadge.md`
