# Phase 11 of Fa-LiveMd — Integration & Wrap-Up

## Context
All 10 Fa-LiveMd sub-features are complete (Fa1-Fa10). 180 tests pass, `npm run build` succeeds, `npx tsc --noEmit` is clean.

The `liveMarkdownPlugin()` function in `live-md/index.ts` assembles all decoration builders through `liveMdViewPlugin()`. The `BUILDERS` array in `view-plugin.ts` contains 8 builders (syntax hider, text styler, link renderer, status badge, type badge, block resolver, inline widgets, fold widgets). All are registered and producing decorations.

**Current state:** Each builder works in isolation (tested individually). The module exports are clean. The `LiveMdPlugin` orchestrates them.

**What's missing before this module is production-ready:**
1. No end-to-end (E2E) test that exercises all 8 builders simultaneously in a single EditorView
2. No performance benchmark or stress test for large documents with all builders enabled
3. The `liveMarkdownPlugin()` hardcodes a single `liveMdViewPlugin` — there's no way to add builders dynamically after creation
4. No `destroy()` or `rebuild()` public method on LiveMdPlugin for external control
5. The `update()` method's fold change detection uses reference comparison (`!==`) which is brittle — should use a proper comparison

**Core problem:** Each decoration builder was built in isolation. We need to verify they work together under realistic load before handing the module off to `Fb1-EmdEditor` (the React component wrapper).

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array, LiveMdPlugin class, update logic |
| `sdk/react-emd/src/live-md/index.ts` | `liveMarkdownPlugin()` assembly |
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig structure, all 8 sub-configs |
| `sdk/react-emd/src/live-md/__tests__/view-plugin.test.ts` | Existing plugin tests (7 tests) |
| `sdk/react-emd/src/live-md/__tests__/smart-folds.test.ts` | Fold widget + auto-fold tests |
| `sdk/react-emd/src/index.ts` | Top-level exports |

## Codebase learnings (from Phase 01-10)

**8 builders in BUILDERS:** Each builder function receives `(tree, ast, config, state)` and returns `Range<Decoration>[]`. They run sequentially in the order listed. The last builder (fold widgets) uses `Decoration.replace` which can overwrite decorations from earlier builders.

**Plugin update triggers:** Currently only triggers on `docChanged` or fold state reference change. The fold detection uses `foldedRanges(startState) !== foldedRanges(state)` — this works when the reference changes but is fragile. A better approach: compare the serialized fold ranges (using `foldState.toJSON`).

**LiveMdConfig is complete:** All 8 sub-configs + theme + debounce are in the config. Defaults are reasonable. No missing config options.

**Auto-fold on load:** `LiveMdPlugin.constructor` calls `autoFoldMatchingSections` in a `setTimeout` after construction. This works but there's no public method to trigger auto-fold manually later.

**Decorations rebuild on every state-changing update:** The `rebuildDecorations()` runs ALL builders, which is O(n*m) where n=doc size and m=section count. For large documents (>500 sections), this could cause frame drops.

## What to build

### 1. End-to-end integration test

Create a new test file `sdk/react-emd/src/live-md/__tests__/integration.test.ts` that:

1. Creates an `EditorView` with `liveMarkdownPlugin()` and a realistic EMD document containing all section types, statuses, links, code blocks, inline widgets, and nested sections
2. Verifies that all 8 decoration types are produced when viewing the document
3. Verifies that typing a character triggers debounced rebuild
4. Verifies that auto-fold rules work in the context of all other decorations
5. Verifies that toggling a fold (via `foldEffect`) updates the fold widget decoration

The test document should look like:

```emd
## [task|done] Completed Task → depends: other.emd

- [x] Subtask 1
- [ ] Subtask 2

## [spec] API Spec

Endpoints defined here. See [[architecture]] for details.

```mermaid
graph TD
  A --> B
```

## [bug|in-progress] Login Broken

Failed on Safari 17.4. Progress: 60%
```

Tests (at least 5):
1. All 8 builder types produce decorations for a rich EMD document
2. Auto-fold rules execute correctly when plugin is initialized
3. Typing triggers rebuild (debounce works)
4. Manually folding a section updates decorations via builder #8
5. Unfolding a section removes the fold widget decoration

### 2. Public API improvements on LiveMdPlugin

Add two methods to `LiveMdPlugin`:

```ts
rebuild(): void — forces an immediate rebuild of all decorations
destroy(): void — clears debounce timer and cleans up block resolver view reference
```

Export these from the module.

#### `rebuild()` method:
```ts
rebuild(): void {
  this.rebuildDecorations(this.view.state);
}
```

#### `destroy()` method:
```ts
destroy(): void {
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
}
```

### 3. Robust fold detection in `update()`

Replace the brittle `!==` reference comparison with a proper fold state check:

```ts
private foldStateChanged(update: ViewUpdate): boolean {
  const oldRanges = JSON.stringify(foldedRanges(update.startState).toJSON(update.startState));
  const newRanges = JSON.stringify(foldedRanges(update.state).toJSON(update.state));
  return oldRanges !== newRanges;
}
```

Note: Use `foldState.field(startState)` with `toJSON` if available, or count fold ranges via `foldedRanges().between()`. The goal is to avoid false positives from reference changes.

### 4. Performance baseline test

Add a test in the integration file that:
1. Creates an EditorView with a 500-section EMD document (use `Array.from` to generate sections)
2. Measures `rebuildDecorations()` time
3. Asserts that rebuild completes in <50ms on modern hardware

### 5. Update DOCS.md

Update `features/F2-ReactSdk/Fa-LiveMd/DOCS.md` with a summary of all 10 sub-features, the decoration builder architecture, and performance characteristics.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add `rebuild()`, `destroy()` methods; improve `foldStateChanged` detection |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export `LiveMdPlugin` methods (already exported, just verify) |
| `sdk/react-emd/src/live-md/__tests__/integration.test.ts` | CREATE — 5+ E2E tests + 1 performance test |
| `features/F2-ReactSdk/Fa-LiveMd/DOCS.md` | MODIFY — update with Fa10 details + full architecture summary |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (~186 total)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/TODO.md`
2. Update `CYCLES.md` progress for Phase 4 (Fa-LiveMd column moved to complete)
3. Run `npx tsc --noEmit`, `npm test`, and `npm run build` — all must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 11 (Fa-Integration): E2E tests, public API, robust fold detection, performance baseline"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fb-Components/Phase-12-Fb1-EmdEditor.md`
