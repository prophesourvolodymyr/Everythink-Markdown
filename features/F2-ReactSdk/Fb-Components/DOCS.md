# Fb-Components — React Component Public API

The public interface of the React SDK. This sub-feature exports the five React components, hooks, and registration functions that external developers use to embed EMD editing in their React applications. It wraps Fa-LiveMd's CodeMirror extensions inside idiomatic React components with props, refs, and hooks.

## Sub-sub-features

**Fb1-EmdEditor** — the primary full-editor component. Accepts props for file path, initial content, theme, plugins, AI configuration, read-only mode, and save callback. Manages the CodeMirror instance lifecycle (create on mount, destroy on unmount). Handles file open, parse, render, and save operations through F1-EmdCore WASM calls. Exposes an imperative ref for programmatic control: focus, getContent, setContent, undo, redo, getSelection. The component renders a toolbar (configurable), the CodeMirror editor surface, and optional side panels (file explorer, AI chat). All internal state (current file, dirty flag, undo stack) is managed through React state and exposed via the ref.

**Fb2-EmdViewer** — the read-only viewer component. Renders EMD content as styled HTML without any editing capability. Lighter than the full editor because it does not instantiate CodeMirror or load editing extensions. Uses the same decoration pipeline (Fa-LiveMd) but in a non-interactive mode where widgets are display-only. Ideal for documentation sites, blog posts, and preview panes. Accepts a `source` string prop and optional `theme` prop.

**Fb3-EmdBlock** — a single-section renderer. Accepts an `EmdSection` object (from the WASM parser output) and renders that one section with its type badge, status badge, styled text, and any block widgets. Used when the host application wants to display EMD sections in a custom layout rather than a full scrollable editor. For example, a dashboard might render task sections as cards in a grid, each using EmdBlock.

**Fb4-ReactHooks** — a set of React hooks for imperative access to editor state without needing refs. `useEmdDocument(filePath)` loads and parses an .emd file, returning the EmdDocument AST, loading state, and error state. `useEmdParser(source)` parses a raw EMD string, returning the AST on every source change. `useEmdSelection(editorRef)` subscribes to the editor's current selection, returning the focused section's type, status, title, and content. These hooks handle WASM initialization, parse debouncing, and cleanup automatically.

**Fb5-PluginAPI** — the React binding for the block widget registration system. Exports `registerBlockWidget(tag, ReactComponent)` and `unregisterBlockWidget(tag)`. The React component receives the block content as a prop and a `onChange` callback for write-back. Wraps the imperative widget API from Fa6-BlockResolver in a declarative React interface. Also exports `registerLLMProvider(config)` for AI panel provider registration.

## Status: Not Started

All sub-sub-features planned, none implemented. The existing `interpreter/` code provides block rendering patterns but uses CustomElements rather than React components and will be rewritten.
