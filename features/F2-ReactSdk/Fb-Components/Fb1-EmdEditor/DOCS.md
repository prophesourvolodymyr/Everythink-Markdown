# Fb1-EmdEditor — Full Editor React Component

## Implementation Status: DONE (Phase 12)

The `EmdEditor` React component at `sdk/react-emd/src/editor.ts` is implemented as a production-ready component wrapping CodeMirror 6 with the `liveMarkdownPlugin()`.

### Architecture

- **React.forwardRef** component with `useRef` for the container div and EditorView instance
- **CodeMirror Compartment**-based reconfiguration for `config`, `ast`, and `readOnly` prop changes — avoids destroying/recreating the EditorView
- **Controlled mode**: when `value` prop changes externally, diff against current editor content and dispatch only if different
- **Uncontrolled mode**: omit `value` prop, editor manages its own content; `onChange` still fires
- **Imperative ref** exposes: `focus()`, `blur()`, `getContent()`, `setContent()`, `undo()`, `redo()`, `getEditorView()`
- **onChange integration**: `EditorView.updateListener` fires `props.onChange(view.state.doc.toString())` on every doc change
- **onSave integration**: `Mod-s` keymap (Ctrl+S on Windows, Cmd+S on macOS) calls `props.onSave?.()` with `event.preventDefault()`
- **History**: `@codemirror/commands` `history()` extension enables undo/redo via imperative ref and Ctrl+Z/Cmd+Z
- **Test strategy**: 7 vitest tests using `@testing-library/react` with jsdom; keyboard shortcut testing uses `HTMLElement.prototype.addEventListener` interception to verify the CM6 key handler invokes `onSave`

### Dependencies Added

- `@codemirror/commands` — for `history()`, `undo()`, `redo()`
- `@testing-library/react` (dev) — for React component tests

### Verified

- `npx tsc --noEmit` — clean
- `npm test` — 207/207 passing
- `npm run build` — succeeds, 42KB gzipped chunk

The component is about 800-1000 lines of React code managing the lifecycle integration between React's declarative paradigm and CodeMirror's imperative API. Most of the complexity is in the mount/unmount coordination and in ensuring that React state updates don't interfere with CodeMirror's internal state.
