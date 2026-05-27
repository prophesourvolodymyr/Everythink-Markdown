# Phase 12 of Fb1-EmdEditor — React Component Wrapper for Fa-LiveMd

## Context
Fa-LiveMd (Phase 1-11) is COMPLETE. `@everthink/react-emd` exports `liveMarkdownPlugin()` which produces a CodeMirror 6 extension array. The `LiveMdPlugin` class orchestrates 8 decoration builders (syntax hider, text styler, link renderer, status badge, type badge, block resolver, inline widgets, fold widgets) and supports `rebuild()`, `destroy()`, debounce, auto-fold, and fold state change detection. 200 tests pass, build succeeds.

The `EmdEditor` React component at `sdk/react-emd/src/editor.ts` is a stub — it renders `<div>EmdEditor — coming soon</div>`.

**The task:** Replace the stub with a full React component that wraps a CodeMirror 6 `EditorView` with the `liveMarkdownPlugin()` extension.

## What you need to read first

| File | Why |
|------|-----|
| `sdk/react-emd/src/editor.ts` | Current stub — the component to replace |
| `sdk/react-emd/src/live-md/index.ts` | `liveMarkdownPlugin()` export and all type exports |
| `sdk/react-emd/src/live-md/types.ts` | `LiveMdConfig` structure, all 8 sub-configs, `DEFAULT_LIVE_MD_CONFIG` |
| `sdk/react-emd/src/live-md/view-plugin.ts` | `LiveMdPlugin` class, `liveMdViewPlugin`, public `rebuild()`/`destroy()` API |
| `sdk/react-emd/src/live-md/__tests__/integration.test.ts` | Real-world usage patterns: creating views, providing ASTs, using config |
| `features/F2-ReactSdk/Fb-Components/Fb1-EmdEditor/DOCS.md` | Full component spec: props, imperative ref, file handling, theme, undo/redo, keyboard shortcuts |
| `sdk/react-emd/src/index.ts` | Top-level exports (all live-md exports + EmdEditor, EmdViewer) |
| `sdk/react-emd/package.json` | Dependencies: react 18, @codemirror/*, @everthink/emd |

## Codebase learnings (from Fa-LiveMd Phase 1-11)

**`liveMarkdownPlugin(config?, ast?)`** returns `Extension[]` containing the ViewPlugin + foldState/foldService when smartFolds is enabled and AST is provided.

**`LiveMdPlugin`** is the ViewPlugin class with:
- `rebuild()` — forces immediate decoration rebuild
- `destroy()` — clears debounce timer, cleans up block resolver view reference
- Constructor takes `(view, config, ast)`, runs initial `rebuildDecorations`, and sets up auto-fold via setTimeout

**`LiveMdConfig`** defaults are all reasonable. A component user should only need to pass partial config.

**AST management:** The `EmdDocument` AST is needed for EMD-specific decorations (status badges, type badges, fold service). Without an AST, only syntax decorations (syntax hider, text styler, link renderer) are produced.

**Dependencies:** `@codemirror/lang-markdown` provides the markdown language mode. `@codemirror/language` provides fold primitives. `@codemirror/view` provides EditorView keys.

## What to build

### 1. Full `EmdEditor` React Component

Replace the stub in `sdk/react-emd/src/editor.ts` with a production-ready component:

#### Props (`EmdEditorProps`):
```ts
export interface EmdEditorProps {
  /** EMD document content (controlled mode) */
  value?: string;
  /** Called on every content change */
  onChange?: (value: string) => void;
  /** EMD document AST from @everthink/emd */
  ast?: EmdDocument | null;
  /** Partial LiveMdConfig overrides */
  config?: Partial<LiveMdConfig>;
  /** CSS class for the container div */
  className?: string;
  /** Disable editing (default: false) */
  readOnly?: boolean;
  /** Called when a wiki-link is clicked (the host app handles navigation) */
  onNavigate?: (target: string) => void;
  /** Called on Ctrl+S / Cmd+S */
  onSave?: () => void;
}
```

#### Component behavior:
1. `useRef<HTMLDivElement>(null)` for the container div
2. `useRef<EditorView | null>(null)` for the CodeMirror instance
3. `useEffect(() => { ... }, [])` — on mount, create EditorView with `liveMarkdownPlugin(config, ast)` and attach to container div
4. `useEffect(() => { ... }, [value])` — when value prop changes externally (controlled mode), update EditorView content IF the content differs from current editor content
5. `useEffect(() => { ... }, [config])` — when config changes, dispatch a compartment reconfiguration for the LiveMdPlugin  
6. `useEffect(() => { ... }, [ast])` — when AST changes, update the plugin with new AST
7. Cleanup on unmount: destroy EditorView and plugin
8. `onChange` integration: use CodeMirror's `EditorView.updateListener` to detect content changes and call `props.onChange(view.state.doc.toString())`
9. `onSave` integration: add a CodeMirror keymap for `Ctrl+S`/`Cmd+S` that calls `event.preventDefault()` and `props.onSave?.()`

#### Imperative handle:
Expose via `React.forwardRef`:
```ts
export interface EmdEditorRef {
  focus(): void;
  blur(): void;
  getContent(): string;
  setContent(content: string): void;
  undo(): void;
  redo(): void;
  getEditorView(): EditorView | null;
}
```

#### Implementation pattern:
```tsx
export const EmdEditor = React.forwardRef<EmdEditorRef, EmdEditorProps>(
  (props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    
    // Mount: create EditorView
    useEffect(() => {
      if (!containerRef.current) return;
      const exts = [
        markdown({ base: markdownLanguage }),
        ...liveMarkdownPlugin(props.config, props.ast),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            props.onChange?.(update.state.doc.toString());
          }
        }),
        keymap.of([{
          key: 'Mod-s',
          run: () => { props.onSave?.(); return true; },
          preventDefault: true,
        }]),
      ];
      if (props.readOnly) {
        exts.push(EditorState.readOnly.of(true));
      }
      const view = new EditorView({
        doc: props.value ?? '',
        parent: containerRef.current,
        extensions: exts,
      });
      viewRef.current = view;
      return () => view.destroy();
    }, []);
    
    // Handle value prop changes (controlled)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentContent = view.state.doc.toString();
      if (props.value !== undefined && props.value !== currentContent) {
        view.dispatch({
          changes: { from: 0, to: currentContent.length, insert: props.value },
        });
      }
    }, [props.value]);
    
    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      blur: () => viewRef.current?.contentDOM.blur(),
      getContent: () => viewRef.current?.state.doc.toString() ?? '',
      setContent: (content: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: content },
        });
      },
      undo: () => { /* CodeMirror undo */ },
      redo: () => { /* CodeMirror redo */ },
      getEditorView: () => viewRef.current,
    }), []);
    
    return React.createElement('div', {
      ref: containerRef,
      className: `emd-editor ${props.className ?? ''}`.trim(),
    });
  }
);
```

### 2. Tests

Create `sdk/react-emd/src/__tests__/editor.test.tsx` with:

1. **Renders without crashing** — mount `<EmdEditor />`, verify container exists
2. **Displays initial content** — pass `value="## Hello"`, verify the editor shows "## Hello"
3. **Calls onChange when user types** — mount, dispatch a change programmatically, verify onChange called
4. **Calls onSave on Ctrl+S** — mount, dispatch `Mod-s` key event, verify onSave called
5. **Updates content when value prop changes** — mount with "A", update prop to "B", verify editor content is "B"
6. **Imperative ref: focus, getContent, setContent** — verify getContent returns correct content, setContent updates it
7. **Applies className prop** — verify the container div has the custom class

Use `@testing-library/react` for React component tests. For CodeMirror integration, you may need to use `view.dispatch()` programmatically in tests since CM6 doesn't easily support typing simulation in jsdom.

### 3. Viewport-aware dynamic config

When `config`, `ast`, or `value` props change, the component must reconfigure the EditorView. For config and AST changes, use a CodeMirror `Compartment`:

```ts
const configCompartment = new Compartment();
const pluginExtension = configCompartment.of(
  liveMarkdownPlugin(currentConfig, currentAst)
);
// Later, when config or ast changes:
view.dispatch({
  effects: configCompartment.reconfigure(
    liveMarkdownPlugin(newConfig, newAst)
  ),
});
```

This avoids destroying and recreating the EditorView.

### 4. Update index.ts exports

Ensure `EmdEditor` and `EmdEditorRef` are properly exported from `sdk/react-emd/src/index.ts`.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/editor.ts` | MODIFY — full React component implementation |
| `sdk/react-emd/src/__tests__/editor.test.tsx` | CREATE — 7 tests |
| `sdk/react-emd/src/index.ts` | MODIFY — verify exports (likely no change needed) |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit          # Must be clean
npm test                  # All tests pass (~207 total)
npm run build             # Library build succeeds
```

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fb-Components/Fb1-EmdEditor/TODO.md`
2. Update `features/F2-ReactSdk/Fb-Components/DOCS.md` with implementation notes
3. Update `CYCLES.md` — mark Fb1-EmdEditor as `[x]`
4. Run `npx tsc --noEmit`, `npm test`, and `npm run build` — all must pass
5. **Commit everything:** `git add -A && git commit -m "Phase 12 (Fb1-EmdEditor): React component wrapping CM6 + liveMarkdownPlugin with controlled/uncontrolled modes, imperative ref, save/change callbacks, compartment-based reconfiguration"`
6. Generate the next prompt: `PROMPTS/F2-ReactSdk/Fb-Components/Phase-13-Fb2-EmdViewer.md`
