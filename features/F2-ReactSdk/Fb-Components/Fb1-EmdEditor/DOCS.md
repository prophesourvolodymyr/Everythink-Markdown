# Fb1-EmdEditor — Full Editor React Component

The primary component exported by the React SDK. A single `<EmdEditor>` element provides the complete EMD editing experience: a toolbar, a CodeMirror 6 editor surface with live preview decorations, and optional side panels. It is the equivalent of `<textarea>` for plain text, but for EMD — drop it in, pass a file path or initial content, and get a full editor.

The component manages the CodeMirror 6 lifecycle: creating the EditorView on mount, destroying it on unmount, and reconfiguring it when props change. It owns the Fa-LiveMd plugin registration, the theme application, and the keyboard shortcut bindings. It coordinates between the React component tree (toolbar, side panels) and the imperative CodeMirror API (getContent, setContent, focus, undo, redo).

Props include: `file` (path or URL), `initialContent` (raw EMD string, used when file is not provided), `theme` (light, dark, high-contrast, or custom theme name), `readOnly` (disables editing), `plugins` (additional block widget registrations), `aiProvider` (LLM configuration for the AI panel), `toolbar` (boolean or custom toolbar config), `onSave` (callback receiving the current document text), `onChange` (callback on every content change), `onNavigate` (callback when a wiki-link is clicked — the host app handles navigation).

The imperative ref exposes: `focus()`, `blur()`, `getContent()`, `setContent(source)`, `undo()`, `redo()`, `getSelection()`, `getFocusedSection()`, `insertBlock(type, content)`, `getEditorView()` (escape hatch to the raw CodeMirror instance).

File handling: when a `file` prop is provided, the component loads the file through the configured storage provider (OPFS for browser, Tauri IPC for desktop, custom provider for embedded use). The file is parsed via F1-EmdCore WASM on load and re-parsed on save. A dirty indicator appears in the toolbar when unsaved changes exist. Cmd+S triggers save. Auto-save with configurable interval is available.

Theme handling: the `theme` prop sets the CSS class on the editor container. The theme class propagates through all CSS custom property references in the live preview decorations. Theme changes are instant — no re-parse, no re-render of decorations. The theme preference is persisted to localStorage.

Undo/redo: Cmd+Z and Cmd+Shift+Z are handled by CodeMirror's built-in history extension. The undo stack tracks all document changes: text edits, section type changes via badge click, status changes via badge click, checkbox toggles, and AI-applied edits. The undo stack depth is configurable (default 200). Undo/redo toolbar buttons are provided.

Keyboard shortcuts: the component registers standard shortcuts (Cmd+Z undo, Cmd+Shift+Z redo, Cmd+S save, Cmd+F find) and EMD-specific shortcuts (Cmd+Shift+T type picker, Cmd+Shift+S status picker, Cmd+Shift+C toggle AI panel). Shortcuts are configurable through a shortcuts prop or through the settings panel.

The component is about 800-1000 lines of React code managing the lifecycle integration between React's declarative paradigm and CodeMirror's imperative API. Most of the complexity is in the mount/unmount coordination and in ensuring that React state updates don't interfere with CodeMirror's internal state.
