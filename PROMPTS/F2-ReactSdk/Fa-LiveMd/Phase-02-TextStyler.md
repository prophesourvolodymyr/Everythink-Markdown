# Phase 02 of F2-ReactSdk Fa-LiveMd Fa2-TextStyler — Inline Text Visual Styling

## Context

Phase 01 is complete. The `@everthink/react-emd` package is scaffolded at `sdk/react-emd/`. Fa1-SyntaxHider is implemented and tested — it walks the lezer markdown syntax tree and produces `Decoration.replace({})` ranges for all syntax markers (heading `#`, emphasis `*`/`**`, code backticks, link brackets/parens, quote `>`, list `-`, task `[ ]`). It skips descendants of `FencedCode` and `HTMLBlock` nodes since those will be handled by Fa6-BlockResolver.

The ViewPlugin skeleton (`view-plugin.ts`) is in place with a debounced decoration rebuild cycle. It currently only calls `buildSyntaxHiderDecorations`. The `BUILDERS` array in `view-plugin.ts` is where Fa2-TextStyler's builder function will be added.

All 19 tests pass (12 syntax-hider + 7 view-plugin). `npm run build` produces `dist/index.js`, `dist/editor.js`, `dist/viewer.js`.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/live-md/types.ts` | LiveMdConfig, DecorationBuilder signature, style config types to extend |
| `sdk/react-emd/src/live-md/syntax-hider.ts` | Pattern reference: how Fa1 walks the tree and creates decorations |
| `sdk/react-emd/src/live-md/view-plugin.ts` | Where to register Fa2 in the BUILDERS array |
| `sdk/react-emd/src/live-md/__tests__/syntax-hider.test.ts` | Test patterns: creating EditorState, getting tree, calling builder, asserting |
| `features/F2-ReactSdk/Fa-LiveMd/Fa2-TextStyler/DOCS.md` | Full spec of style mappings, theme vars, edge cases |
| `features/F2-ReactSdk/Fa-LiveMd/Fa2-TextStyler/TODO.md` | Checklist: 5 tasks to mark done |
| `interpreter/index.html` | CSS variable names in `--emd-*` namespace that Fa2 references |

## Codebase learnings (from Phase 01)

**Package structure:** `sdk/react-emd/` is a Vite library-mode package. Source in `src/`, tests alongside source in `__tests__/`. All imports use the path alias `@live-md/*` resolving to `src/live-md/*` (configured in tsconfig.json and vite.config.ts).

**Test approach:** Tests create real `EditorState` instances with `markdown({ base: markdownLanguage })`, get the `syntaxTree(state)`, call the builder function, and assert on the returned decorations. No mocking of lezer trees — we use real markdown documents.

**Lezer markdown node types** (verified empirically in Phase 01):
- `ATXHeading1` through `ATXHeading6` — heading containers. Contain `HeaderMark` child.
- `HeaderMark` — the `#`/`##`/etc characters at start of heading.
- `StrongEmphasis` — container for `**text**`. Contains `EmphasisMark` children.
- `Emphasis` — container for `*text*`. Contains `EmphasisMark` children.
- `EmphasisMark` — the `*`, `**`, `***` marker characters (used for both italic and bold markers).
- `InlineCode` — container for `` `code` ``. Contains `CodeMark` children.
- `CodeMark` — backticks around inline code AND fence markers in FencedCode.
- `Link` — container for `[text](url)`. Contains `LinkMark` and `URL` children.
- `LinkMark` — the `[`, `]` brackets (also used for images).
- `URL` — the `(url)` part.
- `Image` — container for `![alt](url)`.
- `BulletList` — unordered list container.
- `OrderedList` — ordered list container.
- `ListItem` — single list item. Contains `ListMark` child.
- `ListMark` — the `-` or `1.` marker.
- `Blockquote` — container. Contains `QuoteMark` child.
- `QuoteMark` — the `>` prefix.
- `FencedCode` — whole fenced code block. Contains `CodeMark` (fence), `CodeInfo` (lang), `CodeText` (content).
- `Task` — container for `- [ ]` or `- [x]`. Contains `TaskMarker`.
- `TaskMarker` — the `[ ]` or `[x]` part.
- `HorizontalRule` — the `---`/`***`/`___` line (the whole thing).

**Tree walk pattern:** Use `tree.cursor()` with `do { ... } while (cursor.next())` for full pre-order DFS. Track `skipUntil` boundary to skip descendants of `FencedCode`/`HTMLBlock`.

**Decoration types:**
- `Decoration.replace({})` — hides a range (no DOM). Used by Fa1 for markers.
- `Decoration.mark({ attributes: { class: '...' } })` — applies CSS classes to a range. This is what Fa2 will use.
- `Decoration.widget({ widget })` — replaces a range with a DOM element. Used by Fa4-Fa7.
- `Decoration.set.of(ranges, true)` — creates the sorted DecorationSet.

## What to build

### 1. Fa2-TextStyler implementation

Create `sdk/react-emd/src/live-md/text-styler.ts` with:

- Export: `buildTextStylerDecorations(tree: Tree, config: TextStylerConfig) → Range<Decoration>[]`
- `TextStylerConfig` type to add to `types.ts`:
  ```ts
  export interface TextStylerConfig {
    enabled: boolean;
    styleHeadings: boolean;
    styleEmphasis: boolean;
    styleInlineCode: boolean;
    styleBlockquotes: boolean;
    styleLinks: boolean;
    styleHorizontalRules: boolean;
  }
  ```
- Default config: all true.

**Style mappings by node type:**

For each heading node `ATXHeading1` through `ATXHeading6`, apply `Decoration.mark()` to the ENTIRE heading line (not just the HeaderMark — hide that, then style the rest). The style should use CSS custom properties:
- H1: `{ fontWeight: '700', fontSize: '2em', color: 'var(--emd-heading-color, var(--emd-text))' }`
- H2: `{ fontWeight: '600', fontSize: '1.5em', color: 'var(--emd-heading-color, var(--emd-text))' }`
- H3: `{ fontWeight: '600', fontSize: '1.17em', color: 'var(--emd-heading-color, var(--emd-text))' }`
- H4: `{ fontWeight: '600', fontSize: '1em', color: 'var(--emd-heading-color, var(--emd-text))' }`
- H5: `{ fontWeight: '600', fontSize: '0.83em', color: 'var(--emd-heading-color, var(--emd-text))' }`
- H6: `{ fontWeight: '600', fontSize: '0.67em', color: 'var(--emd-heading-color, var(--emd-text))' }`

For `StrongEmphasis` nodes: apply `{ fontWeight: '700' }`.
For `Emphasis` nodes: apply `{ fontStyle: 'italic' }`.

For `InlineCode` nodes: apply `{ fontFamily: 'var(--emd-mono, monospace)', backgroundColor: 'var(--emd-code-bg, var(--emd-bg-secondary))', borderRadius: '3px', padding: '0.1em 0.3em', fontSize: '0.9em' }`.

For `Blockquote` nodes: apply border and padding. Note: Blockquote is a block-level node. Use `{ borderLeft: '3px solid var(--emd-accent)', paddingLeft: '1em', color: 'var(--emd-text-muted)' }`.

For `Link` nodes: apply `{ color: 'var(--emd-accent)', textDecoration: 'underline' }`.

For `HorizontalRule` nodes: the whole node should be hidden (`Decoration.replace({})`) since Fa1 doesn't hide HR nodes yet. This ensures the `---` text disappears.

For `Strikethrough` (if present in the lezer grammar as `Strikethrough` node with `StrikethroughMark`): apply `{ textDecoration: 'line-through' }`.

**Skip logic:** Same as Fa1 — skip descendants of `FencedCode` and `HTMLBlock`. Also skip heading `HeaderMark` children (they're already hidden by Fa1, the style applies to the ATXHeadingN parent).

**Style application:** Use `Decoration.mark({ attributes: styleObject })`. The attributes are applied as inline CSS styles to the text span. This is the simplest approach for Phase 02. Later, Fa8-ThemeEngine can refactor to use CSS classes for performance.

**How to convert a style object to attributes:** Create a helper `styleToInline(style: Record<string, string>): string` that converts `{ fontWeight: '700' }` to `"font-weight: 700"` and passes it as `{ attributes: { style: styleToInline(style) } }` to `Decoration.mark()`.

### 2. Register Fa2 in the ViewPlugin

In `view-plugin.ts`, add the builder to the `BUILDERS` array (after the syntax hider builder):

```ts
const BUILDERS: DecorationBuilder[] = [
  (tree, _ast, config) => buildSyntaxHiderDecorations(tree, config.syntaxHider),
  (tree, _ast, config) => buildTextStylerDecorations(tree, config.textStyler),
];
```

Also add a `textStyler` field to `LiveMdConfig` in `types.ts` and the default config.

### 3. Update public API

Update `src/live-md/index.ts` to export the new types and builder function. Update `src/index.ts` to export `TextStylerConfig`.

### 4. Unit tests

Create `sdk/react-emd/src/live-md/__tests__/text-styler.test.ts` with vitest:

1. Test that an `ATXHeading2` node receives the correct font weight and size.
2. Test that `StrongEmphasis` text receives `fontWeight: '700'`.
3. Test that `Emphasis` text receives `fontStyle: 'italic'`.
4. Test that `InlineCode` receives monospace font and background.
5. Test that `Blockquote` receives left border.
6. Test that `Link` receives accent color and underline.
7. Test that when a `StrongEmphasis` is inside a heading, both styles apply (bold + heading size).
8. Test that `FencedCode` descendants are skipped (no styles applied inside code blocks).
9. Test that disabled config options produce no decorations for that type.
10. Test that `HorizontalRule` is hidden by Fa2 (since Fa1 doesn't handle it).

Test pattern: same as Fa1 tests — create real `EditorState`, parse with `@codemirror/lang-markdown`, get `syntaxTree(state)`, call `buildTextStylerDecorations(tree, config)`, assert on returned decorations. For mark decorations, check that `decoration.spec.attributes.style` contains the expected CSS.

To inspect the decoration's attributes: `Decoration.mark({ attributes: { style: '...' } })` stores them in the decoration's spec. Access via `decoration.spec.attributes.style`.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/live-md/types.ts` | MODIFY — add TextStylerConfig + default, add textStyler to LiveMdConfig |
| `sdk/react-emd/src/live-md/text-styler.ts` | NEW — Fa2 implementation |
| `sdk/react-emd/src/live-md/view-plugin.ts` | MODIFY — add Fa2 builder to BUILDERS array |
| `sdk/react-emd/src/live-md/index.ts` | MODIFY — export new types and function |
| `sdk/react-emd/src/index.ts` | MODIFY — export TextStylerConfig |
| `sdk/react-emd/src/live-md/__tests__/text-styler.test.ts` | NEW — 10 tests |
| `features/F2-ReactSdk/Fa-LiveMd/Fa2-TextStyler/TODO.md` | MODIFY — mark tasks [x] |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (19 existing + 10 new = 29)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all 5 tasks `[x]` in `features/F2-ReactSdk/Fa-LiveMd/Fa2-TextStyler/TODO.md`
2. Update `features/F2-ReactSdk/Fa-LiveMd/TODO.md` progress note
3. Run `npx tsc --noEmit` and `npm test` — both must pass
4. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fa-LiveMd/Phase-03-LinkRenderer.md`
