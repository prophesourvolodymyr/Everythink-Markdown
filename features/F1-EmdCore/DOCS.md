# F1-EmdCore — Rust Core Engine

The shared core of EMD. Written in Rust. No UI. No platform opinions. Consumed by every SDK and every app built on EMD.

## What It Provides

| Module | What | Consumed Via |
|--------|------|-------------|
| Fa-Parser | `.emd` → `EmdDocument` AST. 17 section types, 20+ link relations, wiki-links, transclusions, metadata comments. | WASM, C FFI, direct crate import |
| Fb-Validator | Cross-file link resolution, status consistency checks, graph validation, code block content checks. Returns `Diagnostic[]`. | WASM, C FFI, direct crate import |
| Fc-WasmTarget | `wasm-pack build` → `@everthink/emd` npm package. 383KB gzipped. Browser + Node.js. | npm install |
| Fd-CliToolchain | `emd check`, `emd fmt`, `emd query`, `emd graph`, `emd export`, `emd new`, `emd lsp`. clap + miette. | Binary download |
| Fe-ContextLoader | `EmdIndex` from walkdir. `load_summaries()`, `load_by_type()`, `load_for_task()`. Token budget via tiktoken-rs. Caching with invalidation. | Direct crate import, WASM |
| Ff-LspServer | tower-lsp server. Diagnostics, hover, go-to-def, completion, format-on-save, code actions. VS Code + Neovim + Zed. | Editor extensions |
| Fg-GraphExecutor | ReActAgent, ToolAgent. LLM providers (OpenAI, Anthropic). Graph execution with safety limits. Write-back to `.emd` files. | WASM, direct crate import |

## Status: DONE ✅

All 7 sub-features complete. 52 Rust tests pass. `@everthink/emd` published. CLI binary shipped.
