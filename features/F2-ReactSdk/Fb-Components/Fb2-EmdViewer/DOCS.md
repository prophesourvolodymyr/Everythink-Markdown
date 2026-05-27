# Fb2-EmdViewer — Read-Only Viewer Component

A lightweight React component that renders EMD content as styled HTML without any editing capability. The viewer does not instantiate CodeMirror 6 — it uses a simplified rendering pipeline that walks the EmdDocument AST from F1-EmdCore WASM and produces React DOM elements directly. This makes it significantly lighter than the full editor, with no editing extensions, no keyboard handlers, and no undo stack.

The viewer accepts two props: `source` (a raw EMD string) and `theme` (light, dark, or high-contrast). It parses the source on mount and whenever the source prop changes, using the same WASM parser as the editor. The parsed AST is walked and each section produces a React element tree: a section container with type and status badges, styled text content, and rendered block widgets. Block widgets in the viewer are display-only — a Mermaid diagram renders but cannot be zoomed, a canvas renders its content but cannot be drawn on, a kanban board appears but cards cannot be dragged.

The viewer is intended for three use cases. First, documentation sites that display .emd files as styled pages. Second, preview panes in applications that want to show EMD content without enabling editing. Third, comment or note systems where EMD is the storage format but the display is read-only.

The viewer is approximately 200 lines of React code plus the reuse of the AST-walking logic from Fa-LiveMd, stripped of the CodeMirror integration layer. It does not load CodeMirror or any of its dependencies, reducing the viewer's bundle size to roughly 60KB gzipped versus the editor's 380KB.

## Status: Not Started

Depends on Fb1-EmdEditor's AST-to-React-element pipeline being extracted into a reusable function that both the editor and viewer can call.
