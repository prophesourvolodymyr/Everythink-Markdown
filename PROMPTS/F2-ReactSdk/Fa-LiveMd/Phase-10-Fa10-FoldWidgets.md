# Phase 10 of Fa10-FoldWidgets — Inline Fold State Decorations

## Context
Phases 01-09 are complete. Fa9-SmartFolds added `foldService` registration based on EMD section boundaries, `autoFoldMatchingSections()` for auto-folding on load, and the `SectionFoldWidget` class. 166 tests pass, `npm run build` succeeds.

Fa9 registers foldable ranges but does not yet read the fold state back into CM6 decorations. When a section is folded via CM6's built-in fold commands (click gutter, Ctrl-Shift-[), the editor shows a generic "..." placeholder. Fa10-FoldWidgets reads the active `foldedRanges` state and exposes it through decorations so the EMD editor can render custom fold widgets inside the document.

**Core problem:** CM6's default fold placeholder is a single "…" character. We need to show section type badges, status dots, and truncated titles instead — identical to what `SectionFoldWidget` produces — when a section is collapsed.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/smart-folds.ts` | `SectionFoldWidget`, `buildSmartFoldsExtension`, `autoFoldMatchingSections` — what Fa9 built |
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array (7 builders), how to add an 8th decoration builder for fold state |
| `sdk/react-emd/src/live-md/types.ts` | SmartFoldsConfig structure, LiveMdConfig |
| `sdk/react-emd/src/live-md/__tests__/smart-folds.test.ts` | Test patterns for fold-related assertions |
| `sdk/react-emd/src/index.ts` | Top-level export patterns |
| `node_modules/@codemirror/language/dist/index.d.ts` | `foldedRanges(state): DecorationSet` — the API to read current folded ranges |

## Codebase learnings (from Phase 01-09)

**Fa9 integrated folds as an extension, not a decoration builder.** `buildSmartFoldsExtension()` returns `[foldState, foldService.of(...)]` — extension facets added in `liveMarkdownPlugin()`. The fold state lives in CM6's `foldState` field, not in the LiveMdPlugin's decoration set.

**The gap:** When a range is folded, CM6 renders a default "…" placeholder. There is no hook in CM6's fold API to customize the placeholder per-fold-range through the `foldService` alone.

**The solution:** Add a new decoration builder (builder #8) to the `BUILDERS` array that reads `foldedRanges(state)` and creates `Decoration.replace()` decorations with `SectionFoldWidget` for sections that are currently folded. This overlaps the default fold placeholder with our own widget.

**SectionFoldWidget already exists.** Fa9 defined `SectionFoldWidget extends WidgetType` with `toDOM()` that shows type badge + status dot + truncated title. Fa10 reuses it to populate the fold placeholder decorations.

**Auto-fold interaction:** When `autoFoldMatchingSections` dispatches fold effects, the `foldState` updates and the rebuilt decorations will pick up the new folded ranges through the 8th builder.

## What to build

### 1. Fold state decoration builder

Create the 8th decoration builder function. It reads the current `foldedRanges` from the editor state, intersects them with known EMD section boundaries from the AST, and creates `Decoration.replace()` decorations with `SectionFoldWidget` for each folded section.

```ts
export function buildFoldWidgetDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: SmartFoldsConfig,
  state: EditorState
): Range<Decoration>[] {
  if (!config.enabled || !ast) return [];

  const decorations: Range<Decoration>[] = [];
  const folded = foldedRanges(state);
  const flatSections = flattenSections(ast.sections);

  folded.between(0, state.doc.length, (from, to) => {
    // Find the section that matches this fold range
    const section = flatSections.find((s) => s.source_span.start === from);
    if (section) {
      const widget = new SectionFoldWidget(
        section.section_type,
        section.status,
        section.title,
        config
      );
      decorations.push(
        Decoration.replace({
          widget,
          inclusive: false,
        }).range(from, to)
      );
    }
    return false; // continue iteration
  });

  return decorations;
}
```

**Important:** `Decoration.replace` with a widget replaces the content in the range. When used alongside the fold system, it effectively replaces the default "…" with the `SectionFoldWidget` DOM.

**Flatten sections helper:** Extract the `flattenSections` function from `smart-folds.ts` into a shared utility or duplicate it in the new file. The cleanest approach is to export it from `smart-folds.ts`.

### 2. Export flattenSections from smart-folds.ts

```ts
export { flattenSections };
```

### 3. Register builder #8 in view-plugin.ts

Add `buildFoldWidgetDecorations` to the `BUILDERS` array after the inline-widgets builder (#7):

```ts
import { buildFoldWidgetDecorations } from './smart-folds';

const BUILDERS: DecorationBuilder[] = [
  // ... existing 7 builders ...
  (tree, _ast, config, state) =>
    buildInlineWidgetDecorations(tree, _ast, config.inlineWidgets, state),
  (tree, _ast, config, state) =>
    buildFoldWidgetDecorations(tree, _ast, config.smartFolds, state),
];
```

**Note:** `buildFoldWidgetDecorations` must be the last builder so its `Decoration.replace` widgets overwrite any other decoration at the same position.

### 4. Update smart-folds.ts imports

The `buildFoldWidgetDecorations` function uses `Decoration` from `@codemirror/view`. The import must include `Decoration`:

```ts
import { EditorView, WidgetType, Decoration } from '@codemirror/view';
import type { Range } from '@codemirror/state';
```

### 5. Export buildFoldWidgetDecorations

Update `live-md/index.ts` and `src/index.ts` to export `buildFoldWidgetDecorations`.

### 6. Unit tests

Add tests to `sdk/react-emd/src/live-md/__tests__/smart-folds.test.ts` (or a new file `fold-widgets.test.ts`):

Tests (at least 12):
1. `buildFoldWidgetDecorations` returns empty array when config is disabled
2. `buildFoldWidgetDecorations` returns empty array when AST is null
3. `buildFoldWidgetDecorations` returns empty array when no sections are folded
4. `buildFoldWidgetDecorations` produces a `Decoration.replace` for a folded section
5. The decoration's widget is a `SectionFoldWidget` with the correct section_type
6. The decoration's widget has the correct title
7. The decoration's widget has the correct status
8. The decoration range matches the fold range (from/to)
9. Multiple folded sections produce multiple decorations
10. Unfolded sections produce no decorations
11. The `Decoration.replace` uses `block: false` (inline replacement)
12. Sub-sections that are folded also produce decorations

### 7. Integration test

Add a test that:
1. Creates an EditorView with the fold service extension
2. Auto-folds a section matching a rule
3. Verifies the decoration set contains a fold widget decoration at the folded range

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/smart-folds.ts` | MODIFY — export flattenSections, add buildFoldWidgetDecorations, add Decoration/Range imports |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add buildFoldWidgetDecorations as builder #8 in BUILDERS array |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export buildFoldWidgetDecorations |
| `sdk/react-emd/src/index.ts` | MODIFY — export buildFoldWidgetDecorations |
| `sdk/react-emd/src/live-md/__tests__/smart-folds.test.ts` | MODIFY — add ~12 fold widget tests |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (~166 existing + ~12 new = ~178)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa10-FoldWidgets/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note to include Fa10-FoldWidgets
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 10 (Fa10-FoldWidgets): inline fold state decorations"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-11-*.md`
