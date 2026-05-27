# F2-ReactSdk — React Markdown Editor SDK

The web SDK. Developers `npm install @everthink/react-emd` and drop `<EmdEditor />` into any React application to get a full EMD editing experience with live preview, all section type renderers, AI chat panel, and theming.

## Architecture

```
F2-ReactSdk/
  Fa-LiveMd/           CodeMirror 6 ViewPlugin engine. The heart.
  Fb-Components/        React component exports. Public API surface.
  Fc-Playground/        Local dev preview. Not published. For us.
  Fd-AiPanel/           AI chat sidebar. Streaming, apply-edit, context.
```

Everything in Fa-LiveMd runs inside the CodeMirror 6 `ViewPlugin` lifecycle. It receives the lezer-parsed markdown syntax tree, walks it, and produces `Decoration` objects that tell CodeMirror what to hide, style, or replace with widgets. This is the exact same mechanism Obsidian uses for their Live Preview mode. The difference is that Fa-LiveMd understands EMD section types, statuses, and semantic links — it decorates those specifically, not just standard CommonMark.

Fa-LiveMd does not import React. It is a pure CodeMirror 6 extension. Fb-Components wraps it in React components, hooks, and an imperative plugin registration API. Fc-Playground is a standalone Vite + React app that consumes the SDK exactly as an external developer would, giving us a live preview while we build. Fd-AiPanel is a React component that communicates with F1-EmdCore via WASM for context gathering and LLM streaming.

## Dependencies

| Dependency | Why |
|-----------|-----|
| `@everthink/emd` | WASM parser. Produces `EmdDocument` AST. |
| `@codemirror/view` | EditorView, ViewPlugin, Decoration system. |
| `@codemirror/state` | EditorState, StateField, Facet, Transaction. |
| `@codemirror/lang-markdown` | Lezer markdown parser, produces syntax tree. |
| `@codemirror/language` | SyntaxHighlighting, LanguageSupport. |
| `react` / `react-dom` | Component framework for Fb-Components and Fd-AiPanel. |
| `mermaid` | Diagram rendering for ```mermaid blocks. |
| `katex` | Math rendering for ```katex blocks. |
| `handsontable` | Data table for pipe tables. |

No other UI frameworks. No CSS libraries. Theming uses CSS custom properties only (`--emd-*`).

## Status: Not Started

All sub-features are planned. None implemented. The existing `interpreter/` codebase serves as a reference for block rendering patterns but will be rewritten into this SDK architecture.
