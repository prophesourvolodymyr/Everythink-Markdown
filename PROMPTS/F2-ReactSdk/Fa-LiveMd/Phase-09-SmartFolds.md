# Phase 09 of Fa9-SmartFolds — EMD-Aware Section Folding

## Context
Phases 01-08 are complete. The `@everthink/react-emd` package has 8 sub-features active: SyntaxHider, TextStyler, LinkRenderer, StatusBadge, TypeBadge, BlockResolver, InlineWidgets, and ThemeEngine. Fa8-ThemeEngine defined the `--emd-*` CSS custom property system with 3 built-in themes (light, dark, high-contrast) and a `registerTheme()` API for custom themes.

Fa9-SmartFolds adds CodeMirror 6 fold regions based on EMD section boundaries. Unlike standard markdown folding (which only folds headings), SmartFolds uses the EmdDocument AST to know exact section boundaries — including content after the heading, sub-sections, and code blocks. It also provides auto-fold rules: fold sections by type or status on load (e.g., fold all `[task|done]` sections).

142 tests pass. `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array (now 7 builders), LiveMdPlugin lifecycle, how config flows down |
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig structure, how to add SmartFoldsConfig |
| `sdk/react-emd/src/live-md/theme-engine.ts` | CSS variables available for fold widget styling |
| `sdk/react-emd/src/live-md/inline-widgets.ts` | Example of AST-consuming decoration builder that uses section.source_span |
| `sdk/react-emd/src/live-md/status-badge.ts` | Widget pattern: WidgetType subclasses with toDOM(), eq(), ignoreEvent() |
| `sdk/react-emd/src/live-md/__tests__/inline-widgets.test.ts` | Test pattern: create state, get tree, pass AST, extract widgets, assert DOM |
| `sdk/react-emd/src/index.ts` | Top-level export patterns for new types/functions |
| `sdk/react-emd/package.json` | Check if `@codemirror/language` exports `foldService` / `foldable` utilities |

## Codebase learnings (from Phase 01-08)

**All decoration builders follow the same pattern.** Each is a function `(tree, ast, config, state) => Range<Decoration>[]` added to the `BUILDERS` array in `view-plugin.ts:26-41`. Fa9-SmartFolds adds builder #8 to this array.

**The EmdDocument AST carries section boundaries.** Each `EmdSection` has a `source_span: { start, end }` that defines the byte range from the heading's `##` through the section's last content line. Fa9 uses these spans to create fold regions.

**CodeMirror 6 fold infrastructure.** CM6 provides `foldService` — a state field extension that returns foldable ranges. A `foldService` function receives the editor state and returns `{ from, to }` ranges. When a range is folded, CM6 replaces the folded content with a placeholder widget. Fa9 will register a `foldService` that walks the AST section tree and returns section boundary ranges.

**Fold widgets are standard WidgetType subclasses.** When a section is collapsed, CM6 shows a fold placeholder. Fa9 provides a custom placeholder that shows the section type badge + title + status, so the user knows what's inside without expanding.

**Auto-fold on load** requires hooking into the ViewPlugin's constructor or the `liveMarkdownPlugin` factory function. After the first decoration set is built, Fa9 scans the config's `autoFold` rules and dispatches fold transactions for matching sections.

**Testing folds in CodeMirror** requires either accessing the `foldable` state field or dispatching fold commands. The standard test approach is: create an EditorState with the foldService extension, inspect the `foldable` state for expected ranges, or use `foldCode` / `unfoldCode` commands and check the resulting state.

## What to build

### 1. SmartFolds config types

Add to `sdk/react-emd/src/live-md/types.ts`:

```ts
export type AutoFoldRule = {
  type?: string;
  status?: string;
  level?: number;
};

export interface SmartFoldsConfig {
  enabled: boolean;
  autoFoldRules: AutoFoldRule[];
  showTypeBadgeOnFold: boolean;
  showStatusDotOnFold: boolean;
  foldPlaceholderMaxTitle: number;
}

export const DEFAULT_SMART_FOLDS_CONFIG: SmartFoldsConfig = {
  enabled: true,
  autoFoldRules: [],
  showTypeBadgeOnFold: true,
  showStatusDotOnFold: true,
  foldPlaceholderMaxTitle: 40,
};
```

Add `smartFolds: SmartFoldsConfig` to `LiveMdConfig` and to `DEFAULT_LIVE_MD_CONFIG`.

### 2. smart-folds.ts — fold service and auto-fold logic

Create `sdk/react-emd/src/live-md/smart-folds.ts`:

**Fold service function** that returns foldable ranges from the AST:

```ts
export function emdFoldService(
  ast: EmdDocument | null
): (state: EditorState) => { from: number; to: number }[] {
  return (state) => {
    if (!ast) return [];
    return ast.sections.map((section) => ({
      from: section.source_span.start,
      to: section.source_span.end,
    }));
  };
}
```

**Auto-fold function** that dispatches fold commands for sections matching rules:

```ts
export function autoFoldMatchingSections(
  view: EditorView,
  ast: EmdDocument | null,
  rules: AutoFoldRule[]
): void {
  if (!ast || rules.length === 0) return;
  // For each section matching a rule, dispatch foldCode command
}
```

Uses CM6's `foldCode` command from `@codemirror/language`.

**Fold placeholder widget** — a `WidgetType` subclass shown when a section is collapsed:

```ts
class SectionFoldWidget extends WidgetType {
  constructor(
    private sectionType: string,
    private status: string | null,
    private title: string,
    private config: SmartFoldsConfig
  ) {}
  
  toDOM(): HTMLElement {
    // Returns a compact line showing:
    // [type badge if showTypeBadgeOnFold] [status dot if showStatusDotOnFold] title
    // Styled with --emd-* CSS variables
  }
}
```

**Build decorations function** — wraps `foldService` registration:

```ts
export function buildSmartFoldsExtension(
  ast: EmdDocument | null,
  config: SmartFoldsConfig
): Extension {
  if (!config.enabled || !ast) return [];
  const service = emdFoldService(ast);
  return [
    foldService.of(service),
    // Add custom fold placeholder if needed
  ];
}
```

Note: CM6's `foldService` is an extension facet, not a decoration builder. Fa9 integrates differently than other builders — it registers an extension rather than producing decorations. The `liveMarkdownPlugin` factory in `live-md/index.ts` must be updated to include fold extensions alongside the ViewPlugin.

Alternatively, if keeping everything as a decoration builder is preferred, Fa9 can produce `WidgetDecoration` objects positioned at section boundaries that implement fold behavior, but this is less efficient than using CM6's built-in fold infrastructure.

**Recommended approach:** Add the fold extension directly in `liveMarkdownPlugin()`, not in the BUILDERS array, since folds are a separate CM6 mechanism from decorations. The auto-fold dispatch happens in the ViewPlugin constructor after the AST is available.

### 3. Integration with liveMarkdownPlugin

Update `sdk/react-emd/src/live-md/index.ts`:

```ts
export function liveMarkdownPlugin(
  config?: Partial<LiveMdConfig>,
  ast?: EmdDocument | null
): Extension[] {
  const mergedConfig = { ...DEFAULT_LIVE_MD_CONFIG, ...config };
  const resolvedAst = ast ?? null;
  
  const extensions: Extension[] = [
    liveMdViewPlugin(config, resolvedAst),
  ];
  
  if (mergedConfig.smartFolds.enabled && resolvedAst) {
    extensions.push(
      ...buildSmartFoldsExtension(resolvedAst, mergedConfig.smartFolds)
    );
  }
  
  return extensions;
}
```

### 4. Auto-fold trigger

Auto-fold is triggered in the ViewPlugin constructor. After `rebuildDecorations` runs, the plugin checks `config.smartFolds.autoFoldRules` and dispatches fold commands:

```ts
// In LiveMdPlugin constructor, after rebuildDecorations:
if (this.config.smartFolds.enabled && this.ast) {
  setTimeout(() => {
    autoFoldMatchingSections(this.view, this.ast, this.config.smartFolds.autoFoldRules);
  }, 0);
}
```

The `setTimeout` ensures the fold service has been registered before we try to fold.

### 5. Public API

Update `sdk/react-emd/src/live-md/index.ts` and `sdk/react-emd/src/index.ts` to export:
- `SmartFoldsConfig`, `AutoFoldRule`, `DEFAULT_SMART_FOLDS_CONFIG`
- `emdFoldService`, `autoFoldMatchingSections`, `buildSmartFoldsExtension`

### 6. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/smart-folds.test.ts`:

Tests (at least 14):
1. `emdFoldService` returns fold ranges for each section in the AST (2 sections → 2 fold ranges)
2. `emdFoldService` returns empty array when AST is null
3. `emdFoldService` returns empty array when AST has no sections
4. Fold range `from` matches `section.source_span.start`
5. Fold range `to` matches `section.source_span.end`
6. `autoFoldMatchingSections` folds sections matching a type rule (e.g., `{ type: 'task' }`)
7. `autoFoldMatchingSections` folds sections matching a status rule (e.g., `{ status: 'done' }`)
8. `autoFoldMatchingSections` folds sections matching combined type+status rule
9. `autoFoldMatchingSections` does not fold sections that don't match any rule
10. `autoFoldMatchingSections` with empty rules array does nothing (no dispatch)
11. `autoFoldMatchingSections` handles null AST gracefully (no error)
12. SectionFoldWidget `toDOM()` shows type badge when `showTypeBadgeOnFold` is true
13. SectionFoldWidget `toDOM()` hides type badge when `showTypeBadgeOnFold` is false
14. SectionFoldWidget `toDOM()` shows status dot when status is non-null and `showStatusDotOnFold` is true
15. SectionFoldWidget `toDOM()` shows truncated title when title exceeds `foldPlaceholderMaxTitle`
16. SectionFoldWidget `eq()` returns true for same section type/title/status

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add SmartFoldsConfig, AutoFoldRule, DEFAULT_SMART_FOLDS_CONFIG, add smartFolds to LiveMdConfig |
| `sdk/react-emd/src/live-md/smart-folds.ts` | NEW — fold service, auto-fold logic, SectionFoldWidget |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — integrate fold extensions into liveMarkdownPlugin, export new types/functions |
| `sdk/react-emd/src/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — auto-fold trigger in constructor |
| `sdk/react-emd/src/live-md/__tests__/smart-folds.test.ts` | NEW — 16 tests |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (142 existing + ~16 new = ~158)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa9-SmartFolds/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note to include Fa9-SmartFolds ✅
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 09 (Fa9-SmartFolds): EMD-aware section folding"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-10-FoldWidgets.md`
