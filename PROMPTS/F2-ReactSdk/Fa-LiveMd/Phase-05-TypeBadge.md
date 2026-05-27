# Phase 05 of Fa5-TypeBadge — Section Type Badge Rendering

## Context
Phases 01 (SyntaxHider), 02 (TextStyler), 03 (LinkRenderer), and 04 (StatusBadge) are complete. The `@everthink/react-emd` package has four decoration builders in `view-plugin.ts`'s `BUILDERS` array. Fa4 added status dot/pill widgets at the end of section headings.

Fa5-TypeBadge renders compact, color-coded type label pills (`[task]`, `[decision]`, `[api]`, etc.) at the beginning of EMD section headings, right after the `##` markers and before the heading text. It pairs with Fa4-StatusBadge to form the complete badge pair: type badge on the left, status badge on the right.

The section type is read from the **EmdDocument AST** (`EmdSection.section_type`), not from regex on document text.

63 tests pass (12 + 13 + 7 + 7 + 8 + 16). `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/status-badge.ts` | Fa4 pattern: widget classes + AST-based builder (the sibling feature) |
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig, DecorationBuilder type, pattern for config interfaces |
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array to add Fa5 as 5th builder |
| `sdk/react-emd/src/live-md/__tests__/status-badge.test.ts` | Test patterns: mock EmdSection/EmdDocument, decoration assertions |
| `sdk/react-emd/src/live-md/index.ts` | Export patterns |
| `sdk/react-emd/src/index.ts` | Top-level export patterns |
| `features/F2-ReactSdk/Fa-LiveMd/Fa5-TypeBadge/DOCS.md` | Full spec: 24 section types, colors, abbreviations, behavior |
| `features/F2-ReactSdk/Fa-LiveMd/Fa5-TypeBadge/TODO.md` | Checklist: 5 tasks |

## Codebase learnings (from Phase 01-04)

**Widget pattern from Fa4:** `StatusDotWidget` and `StatusPillWidget` extend `WidgetType` from `@codemirror/view`. They have `eq()`, `toDOM()`, and store state in private fields. `Decoration.widget({ widget, side: 1 })` is used to insert widgets at positions.

**AST section matching from Fa4:** Sections are matched to lezer headings using `source_span.start`. The `flattenSections()` helper recursively collects all sections including subsections. A `Map<number, EmdSection>` is built from `source_span.start` to section. At each `ATXHeading1-6` lezer node, the map is looked up by `cursor.from`.

**EmdSection fields:**
- `level: number` — heading level (1-6)
- `section_type: string` — the type string like "task", "decision", "api"
- `status: string | null`
- `title: string`
- `source_span: { start: number; end: number }` — byte offset in document
- `subsections: EmdSection[]`

**Decoration types:**
- `Decoration.widget({ widget, side: 1 }).range(pos)` — inserts widget at `pos` with `side: 1` (appears after position)
- `Decoration.mark({ attributes: { style, class } }).range(from, to)` — inline styles on a range
- `Decoration.replace({}).range(from, to)` — hides a text range

**Test approach:** Create real `EditorState` with `markdown({ base: markdownLanguage })`, get `syntaxTree(state)`, create mock `EmdSection[]` and `EmdDocument`, call the builder, assert on returned decorations. Access widget via `(d.value as any).spec.widget`.

**Important:** `dom.style.background` in jsdom normalizes hex colors to `rgb()` format. Test color by checking `widget.color` property directly rather than DOM style.

## What to build

### 1. TypeBadgeConfig

Add to `sdk/react-emd/src/live-md/types.ts`:
```ts
export interface TypeBadgeConfig {
  enabled: boolean;
  abbreviate: boolean;
  colors: Record<string, string>;
}
```

With `DEFAULT_TYPE_BADGE_CONFIG`. Default: enabled=true, abbreviate=false. Colors for all 24 section types. Use CSS variable references where possible (`var(--emd-type-task)`) with fallback hex values.

Add `typeBadge: TypeBadgeConfig` to `LiveMdConfig`. Add to `DEFAULT_LIVE_MD_CONFIG`.

### 2. type-badge.ts — Type Label Pill

Create `sdk/react-emd/src/live-md/type-badge.ts` with:

**Widget class:**
```ts
class TypePillWidget extends WidgetType {
  constructor(private sectionType: string, private color: string) { super(); }
  eq(other: TypePillWidget): boolean { return this.sectionType === other.sectionType; }
  toDOM(): HTMLElement {
    const pill = document.createElement('span');
    pill.className = 'emd-type-badge';
    pill.style.cssText = `...`;
    pill.textContent = this.sectionType;
    return pill;
  }
}
```

Pill styling: small rounded rectangle (border-radius: 4px), small padding (2px 6px), font-size: 0.75em, background from config color, white text for dark backgrounds (since the fallback colors are medium-dark), vertical-align: middle, margin-right: 6px.

**Main builder function:**
```ts
export function buildTypeBadgeDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: TypeBadgeConfig
): Range<Decoration>[]
```

Logic:
1. If config disabled or AST is null, return `[]`
2. Flatten sections and build section map (same pattern as Fa4)
3. Walk lezer tree, find ATXHeading1-6 nodes
4. For each heading, look up EmdSection by `source_span.start`
5. If section has a non-empty `section_type`, create `TypePillWidget` with the color from config
6. Place widget at `cursor.from` (start of the heading, i.e., before the `##` or right after — the Fa1 syntax-hider will hide the `##` markers, so placing at the position right after HeaderMark would visually appear as the first element)
7. Use `Decoration.widget({ widget, side: 1 }).range(pos)` where `pos` is the position right after the HeaderMark (you can find it by navigating to the first child of the heading node, or simply use a heuristic: `cursor.from + headingLevel + 1` which accounts for `## ` plus the space)

**HeaderMark detection:** Within an ATXHeading node, the `HeaderMark` child node covers the `##` part. You can find it by iterating into the heading's children. The widget should be placed at `HeaderMark.to` (end of `##`), so it appears right after the `##` marks.

**Alternative simpler approach:** Place the widget at `cursor.from + level + 1` where level is the heading level (number of `#` characters). This is `cursor.from + level + 1` accounts for `## ` format. This avoids needing to navigate child nodes.

### 3. ViewPlugin update

In `view-plugin.ts`:
1. Import `buildTypeBadgeDecorations` from `./type-badge`
2. Add `(tree, _ast, config, _state) => buildTypeBadgeDecorations(tree, _ast, config.typeBadge)` as the 5th builder in BUILDERS

### 4. Public API

Update `src/live-md/index.ts` and `src/index.ts` to export `TypeBadgeConfig`, `DEFAULT_TYPE_BADGE_CONFIG`, `buildTypeBadgeDecorations`.

### 5. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/type-badge.test.ts`:

Tests (at least 8):
1. `[task]` section produces a pill with correct color
2. `[decision]` section produces a pill with correct color
3. `[api]` section produces a pill with correct color
4. Section with null/empty section_type produces no decoration
5. AST is null → returns `[]`
6. Disabled config produces no decorations
7. Multiple headings in one document get correct type badges
8. Nested sections (via subsections) get correct type badges
9. Unknown/custom section types get the default color from config

Mock EmdSections with the same pattern as Fa4 tests: set `source_span.start` to match the heading's starting byte offset in the document text.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add TypeBadgeConfig + default, add to LiveMdConfig |
| `sdk/react-emd/src/live-md/type-badge.ts` | NEW — TypePillWidget + decoration builder |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add Fa5 builder to BUILDERS |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/index.ts` | MODIFY — export TypeBadgeConfig |
| `sdk/react-emd/src/live-md/__tests__/type-badge.test.ts` | NEW — 8+ tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa5-TypeBadge/TODO.md` | MODIFY — mark tasks [x] |
| `features/F2-ReactSdk/Fa-LiveMd/TODO.md` | MODIFY — update progress note |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (63 existing + ~8 new = ~71)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa5-TypeBadge/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note to include Fa5-TypeBadge ✅
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 05 (Fa5-TypeBadge): section type badge rendering"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-06-BlockResolver.md`
