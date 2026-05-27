# Phase 07 of Fa7-InlineWidgets — Interactive Inline Element Rendering

## Context
Phases 01-06 are complete. The `@everthink/react-emd` package now has six decoration builders in `view-plugin.ts`'s `BUILDERS` array. Fa6-BlockResolver was just completed, providing a widget registry, 4 stub block widgets (mermaid, katex, diff, html), and the ability to replace fenced code blocks with block-level widget decorations.

Fa7-InlineWidgets renders small interactive UI elements embedded directly within the text flow — checkboxes on task items, progress bars below task section headings, approve/reject buttons in human checkpoint sections, and link popover tooltips. Unlike Fa6's block widgets that replace entire code fence regions, inline widgets are positioned at specific character offsets and flow with surrounding text. They replace specific syntax patterns and their interactive state is always reflected in the underlying document characters.

92 tests pass (12 + 13 + 7 + 7 + 8 + 16 + 12 + 17). `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/block-resolver.ts` | Fa6 widget pattern: BlockWidgetDecoration, module-level view, write-back |
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig, DecorationBuilder type, BlockWidget interfaces |
| `sdk/react-emd/src/live-md/view-plugin.ts` | BUILDERS array (now 6 builders), setBlockResolverView pattern |
| `sdk/react-emd/src/live-md/__tests__/block-resolver.test.ts` | Latest test patterns: EditorState, syntaxTree, decoration assertions |
| `sdk/react-emd/src/live-md/index.ts` | Export patterns |
| `sdk/react-emd/src/index.ts` | Top-level export patterns |
| `features/F2-ReactSdk/Fa-LiveMd/Fa7-InlineWidgets/DOCS.md` | Full spec: checkboxes, progress bars, approve buttons, link popovers |
| `features/F2-ReactSdk/Fa-LiveMd/Fa7-InlineWidgets/TODO.md` | Checklist: 5 tasks |

## Codebase learnings (from Phase 01-06)

**Widget pattern:** All widgets extend `WidgetType` from `@codemirror/view`. They have `eq()`, `toDOM()`, and store state in private fields. `Decoration.widget({ widget, side: 1 })` is used to insert inline widgets at positions. `Decoration.replace({ widget, block: true })` is used for block-level widget replacements.

**Fa6's module-level view pattern:** `setBlockResolverView(view)` stores the current `EditorView` in a module-level variable, so decoration widgets can access it for write-back without needing the view passed through the builder chain. The view is set in `rebuildDecorations()` before running builders.

**Lezer tree navigation:** Use `tree.cursor()` to iterate lezer nodes. Key node types for Fa7:
- `TaskMarker` — the `- [ ]` or `- [x]` in task list items
- `ATXHeading1-6` — headings where progress bars or approve buttons appear
- `URL`, `WikiLink`, `SemanticLink` — link nodes for popover targets
- `FencedCode` — skip contents of code blocks (no inline widgets inside)

**Lezer node structure for task items:** A task list item has node type `Task` containing:
- `ListMark` — the `- ` bullet marker
- `TaskMarker` — the `[ ]` or `[x]` with the space or check character inside

**Decoration types:**
- `Decoration.widget({ widget, side: 1 }).range(pos)` — inserts inline widget at `pos`
- `Decoration.replace({}).range(from, to)` — hides a text range (used by Fa1-SyntaxHider)
- `Decoration.mark({ attributes: { style, class } }).range(from, to)` — inline styling

**Write-back via dispatch:** State changes from widget interaction must be dispatched as CodeMirror transactions (not direct DOM manipulation). This ensures undo/redo works. Example from Fa6:
```ts
view.dispatch({ changes: { from: position, to: position + 1, insert: 'x' } });
```

**Test approach:** Create real `EditorState` with `markdown({ base: markdownLanguage })`, get `syntaxTree(state)`, create mock `EmdDocument`/`EmdSection` ASTs, call the builder, assert on returned decorations. Access widget via `(d.value as any).spec.widget`. Test DOM via `widget.toDOM()`. For widgets with interaction, test that the widget's event handler dispatches the correct transaction.

**Fa1 interaction:** Fa1-SyntaxHider hides markup markers including `TaskMarker` and `ListMark`. Fa7's inline widgets will visually replace these same text patterns. The SyntaxHider's `Decoration.replace({})` and Fa7's `Decoration.widget()` should target complementary positions so they don't visually conflict — if Fa1 hides the `[ ]` range, Fa7 inserts a checkbox widget at the same position.

**Known lezer node traits:** The lezer parser for `@codemirror/lang-markdown` uses `CodeInfo` (not `InfoString`) for the fenced code tag, `CodeMark` (not `CodeFence`) for the fence markers, and `TaskMarker` for checkbox brackets.

## What to build

### 1. InlineWidgetsConfig

Add to `sdk/react-emd/src/live-md/types.ts`:

```ts
export interface InlineWidgetsConfig {
  enabled: boolean;
  renderCheckboxes: boolean;
  renderProgressBars: boolean;
  renderApproveButtons: boolean;
}

export const DEFAULT_INLINE_WIDGETS_CONFIG: InlineWidgetsConfig = {
  enabled: true,
  renderCheckboxes: true,
  renderProgressBars: true,
  renderApproveButtons: true,
};
```

Add `inlineWidgets: InlineWidgetsConfig` to `LiveMdConfig`. Add to `DEFAULT_LIVE_MD_CONFIG`.

### 2. inline-widgets.ts — Core Decoration Builder

Create `sdk/react-emd/src/live-md/inline-widgets.ts` with:

**Main builder function:**
```ts
export function buildInlineWidgetDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: InlineWidgetsConfig,
  state: EditorState
): Range<Decoration>[]
```

Logic:
1. If config is disabled, return `[]`
2. Walk lezer tree
3. For each `TaskMarker` node → create a `CheckboxWidget` if `renderCheckboxes` is true
4. For each `ATXHeading1-6` with an AST section that has task children → create a `ProgressBarWidget` if `renderProgressBars` is true
5. For each `ATXHeading1-6` with section type `human` → create an `ApproveButtonWidget` if `renderApproveButtons` is true
6. Skip nodes inside `FencedCode` blocks

**CheckboxWidget class:**
```ts
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean, private markerFrom: number) { super(); }

  eq(other: CheckboxWidget): boolean { return this.checked === other.checked; }

  toDOM(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'emd-inline-checkbox';
    input.checked = this.checked;
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      if (currentView) {
        const checkPos = this.checked
          ? this.markerFrom + 1 + this.markerText.indexOf('x')
          : this.markerFrom + 1;
        currentView.dispatch({
          changes: {
            from: this.markerFrom + 1,
            to: this.markerFrom + 2,
            insert: this.checked ? ' ' : 'x',
          },
        });
      }
    });
    // The checkbox toggle dispatches a transaction that replaces
    // the character at position markerFrom+1 (the space or x inside brackets)
    // with the opposite state.
    return input;
  }
}
```

The checkbox widget is placed at the `TaskMarker` node's position. The `TaskMarker` range `[from, to]` covers `[ ]` or `[x]` (3 characters). The checkbox replaces the visual representation but the write-back only changes the middle character (space → x or x → space).

**ProgressBarWidget class:**
```ts
class ProgressBarWidget extends WidgetType {
  constructor(private total: number, private checked: number) { super(); }

  eq(other: ProgressBarWidget): boolean {
    return this.total === other.total && this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'emd-progress-bar';
    const pct = this.total > 0 ? Math.round((this.checked / this.total) * 100) : 0;

    // Color interpolation: red (0%) → amber (50%) → green (100%)
    const red = pct < 50 ? 239 : Math.round(239 - (pct - 50) * (239 - 34) / 50);
    const green = pct < 50 ? Math.round(68 + pct * (168 - 68) / 50) : Math.round(168 + (pct - 50) * (34 - 168) / 50);
    const blue = 68;

    container.style.cssText = `display:flex;align-items:center;gap:6px;margin:4px 0;font-size:0.8em;`;

    const track = document.createElement('div');
    track.style.cssText = `flex:1;height:6px;border-radius:3px;background:var(--emd-progress-track,#e5e7eb);overflow:hidden;`;

    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:${pct}%;border-radius:3px;background:rgb(${red},${green},${blue});transition:width 0.3s;`;
    track.appendChild(fill);

    const label = document.createElement('span');
    label.textContent = `${this.checked}/${this.total}`;
    label.style.cssText = `color:var(--emd-progress-label,#6b7280);white-space:nowrap;`;

    container.appendChild(track);
    container.appendChild(label);
    return container;
  }
}
```

The progress bar widget is placed at the end of the section heading line (using `Decoration.widget` with `side: 1`). It reads the checklist state from the EmdDocument AST. To count checkboxes in a section's children, walk the section's `content` array looking for task list items.

**Progress bar counting helper:**
```ts
function countCheckboxes(content: string[]): { total: number; checked: number } {
  let total = 0;
  let checked = 0;
  for (const line of content) {
    const match = line.match(/^-\s+\[(.)\]/);
    if (match) {
      total++;
      if (match[1] !== ' ') checked++;
    }
  }
  return { total, checked };
}
```

**ApproveButtonWidget class:**
```ts
class ApproveButtonWidget extends WidgetType {
  constructor(private headingPos: number) { super(); }

  eq(_other: ApproveButtonWidget): boolean { return true; }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'emd-approve-buttons';
    container.style.cssText = `display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle;`;

    const approve = document.createElement('button');
    approve.textContent = 'Approve';
    approve.className = 'emd-btn-approve';
    approve.style.cssText = `padding:2px 8px;border-radius:4px;border:1px solid var(--emd-accent,#2563eb);background:var(--emd-accent,#2563eb);color:#fff;cursor:pointer;font-size:0.75em;`;
    approve.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentView) {
        // Find the heading line and append |done after the section title
        const doc = currentView.state.doc;
        const line = doc.lineAt(this.headingPos);
        const lineText = line.text;
        currentView.dispatch({
          changes: { from: line.to, insert: ' |done\n' },
        });
      }
    });

    const reject = document.createElement('button');
    reject.textContent = 'Reject';
    reject.className = 'emd-btn-reject';
    reject.style.cssText = `padding:2px 8px;border-radius:4px;border:1px solid #ef4444;background:#ef4444;color:#fff;cursor:pointer;font-size:0.75em;`;
    reject.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentView) {
        const doc = currentView.state.doc;
        const line = doc.lineAt(this.headingPos);
        currentView.dispatch({
          changes: { from: line.to, insert: ' |cancelled\n' },
        });
      }
    });

    container.appendChild(approve);
    container.appendChild(reject);
    return container;
  }
}
```

The approve buttons are placed at the end of a `[human]` section heading line (after the heading text, before the newline). The buttons only appear when the section status is not already `done` or `cancelled`.

**Module-level view reference** — share the `currentView` with Fa7. Import `setBlockResolverView` and `currentView` by exporting it from `block-resolver.ts` and importing it in `inline-widgets.ts`:

In `block-resolver.ts`, already have:
```ts
export { setBlockResolverView }
```
Add a getter: `export function getBlockResolverView(): EditorView | null { return currentView; }`

Then in `inline-widgets.ts`, import and use `getBlockResolverView()` to access the view for write-back.

**Builder entry point** (in `view-plugin.ts` BUILDERS, as the 7th builder):
```ts
(tree, _ast, config, state) =>
  buildInlineWidgetDecorations(tree, _ast, config.inlineWidgets, state),
```

### 3. ViewPlugin update

In `view-plugin.ts`:
1. Import `buildInlineWidgetDecorations` from `./inline-widgets`
2. Add `(tree, _ast, config, state) => buildInlineWidgetDecorations(tree, _ast, config.inlineWidgets, state)` as the 7th builder in BUILDERS

### 4. Public API

Update `sdk/react-emd/src/live-md/index.ts` and `sdk/react-emd/src/index.ts` to export:
- `InlineWidgetsConfig`, `DEFAULT_INLINE_WIDGETS_CONFIG`
- `buildInlineWidgetDecorations`

### 5. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/inline-widgets.test.ts`:

Tests (at least 8):
1. Task list item `- [ ]` produces a CheckboxWidget with unchecked state
2. Task list item `- [x]` produces a CheckboxWidget with checked state
3. Task list item `- [ ]` checkbox click dispatches a transaction that toggles to `[x]`
4. Multiple task list items produce separate checkbox widgets
5. Task item inside FencedCode produces no checkbox widget
6. Disabled config produces no decorations
7. [human] section heading with no status produces ApproveButtonWidget
8. [human] section heading with |done status produces no approve buttons
9. Task section heading with child checkboxes produces ProgressBarWidget
10. Task section heading with no child checkboxes produces no progress bar
11. Progress bar with 2 of 5 checked shows correct ratio and color
12. renderCheckboxes: false skips checkboxes but includes other widgets

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add InlineWidgetsConfig + default, add to LiveMdConfig |
| `sdk/react-emd/src/live-md/block-resolver.ts` | MODIFY — export getBlockResolverView() |
| `sdk/react-emd/src/live-md/inline-widgets.ts` | NEW — CheckboxWidget, ProgressBarWidget, ApproveButtonWidget, builder |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add Fa7 builder to BUILDERS |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/index.ts` | MODIFY — export new types and functions |
| `sdk/react-emd/src/live-md/__tests__/inline-widgets.test.ts` | NEW — 10+ tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa7-InlineWidgets/TODO.md` | MODIFY — mark tasks [x] |
| `features/F2-ReactSdk/Fa-LiveMd/TODO.md` | MODIFY — update progress note |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (92 existing + ~12 new = ~104)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa7-InlineWidgets/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note to include Fa7-InlineWidgets ✅
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. **Commit everything:** `git add -A && git commit -m "Phase 07 (Fa7-InlineWidgets): interactive inline element rendering"`
5. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-08-ThemeEngine.md`
