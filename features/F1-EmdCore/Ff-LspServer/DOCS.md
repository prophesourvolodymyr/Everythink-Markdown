# Feature: EMD Core — LSP Server

<!-- STATUS: designed -->
<!-- DEPENDS_ON: parser, validator -->
<!-- PARENT: emd-core -->

## What This Is

The EMD Language Server Protocol (LSP) server — a background process that any LSP-compatible editor (VS Code, Neovim, Zed, Helix, IntelliJ via plugin) connects to for real-time diagnostics, hover information, go-to-definition navigation, auto-completion, and format-on-save. The LSP server is what makes EMD files feel like a first-class language in any editor, not just the Visual Interpreter.

The server runs over stdio (standard LSP transport) and uses `tower-lsp`, the Rust async LSP framework. It is compiled as a standalone binary and distributed alongside the `emd` CLI. Editors that don't use the Visual Interpreter can still get rich EMD editing through LSP.

## Why It Matters

The LSP server is the bridge between the EMD format and the rest of the editing world. A developer who writes `.emd` files in VS Code gets red underlines on broken links, hover tooltips showing section types and statuses, Cmd+Click navigation to linked sections, and auto-completion of EMD syntax — without ever opening the Visual Interpreter. This is critical for adoption: EMD works everywhere, not just in our editor.

For the Visual Interpreter itself, the LSP server provides the same diagnostics and navigation that CodeMirror displays inline. The interpreter can consume LSP diagnostics directly rather than running its own validator.

## LSP Features

### Diagnostics (on open + on change)
The server runs the validator on every file open and after debounced changes (500ms idle). Diagnostics are published as LSP `PublishDiagnostics` notifications with:
- Range (line/column start to end) for editor underlining
- Severity: Error (red), Warning (amber), Information (blue), Hint (gray)
- Message with source (`emd`)
- Code action suggestions for fixable issues

Diagnostic types: broken wiki-links and `→` links, invalid section type syntax, wrong relation type in section context, status inconsistencies (done task with pending dependencies), circular dependencies, missing graph nodes, stale blockages.

### Hover
When the user hovers over a section header, the server shows:
- Section type and status (e.g., "Task — In Progress")
- Brief description of the section type
- List of incoming and outgoing `→` links with their relation types
- Dependency status summary (e.g., "Depends on 3 tasks: 2 done, 1 pending")

When the user hovers over a `[[wiki-link]]`, the server shows:
- Target file and section
- Section type and status of the target
- Brief excerpt from the target's `[summary]` if available

When the user hovers over a `→` link, the server shows:
- Relation type description (e.g., "depends — this section cannot be completed until the target is done")
- Target section type and status
- Whether the link is valid or broken

### Go-to-Definition
Cmd+Click or F12 on a `[[wiki-link]]` or `→` link target navigates to the referenced section. The server returns the target file URI and the line/column of the section header. For transclusion (`![[...]]`), the server shows the referenced content inline (via LSP's inlay hint or peek definition).

### Completion
The server provides context-aware auto-completion:
- After typing `## [`, suggests section types (summary, detail, task, decision, api, spec, agent, human, verify, config, graph, draw, flow, kanban, example, template)
- After typing `→ `, suggests link relation types appropriate to the current section context (api relations in `[api]` sections, agent relations in `[agent]` sections, graph relations in `[graph]` sections)
- After typing `|` inside a section header, suggests status values (done, pending, in-progress, blocked, archived, cancelled)
- Inside `[[`, suggests existing section titles across the project
- After `` ``` ``, suggests code block tags (verify, html, css, mermaid, katex, diff, todo, vega, 3d, gantt, media, example, schema, prompt, snippet, draw)

### Format on Save
When the editor triggers format-on-save, the server runs `emd fmt` on the file and returns the formatted text as LSP text edits. The formatter is idempotent and never modifies content.

### Code Actions
For common fixable issues, the server provides quick-fix code actions:
- "Rename broken link to [[correct-filename#Section]]" — suggests the closest matching file/section
- "Add missing status" — inserts `|pending` after the section type
- "Remove unused dependency" — deletes a `→ depends:` link to a cancelled section
- "Mark as done" — changes `[task|pending]` to `[task|done]`

### Document Symbols
The server provides a document symbol hierarchy (Cmd+Shift+O outline). Sections are grouped by type and nested by H1→H6 hierarchy. The user sees an outline of their `.emd` file: all sections, their types, statuses, and nesting.

### Workspace Symbols
The server provides workspace-wide symbol search (Cmd+T). Searches across all `.emd` files in the project. The user can fuzzy-search for any section by title, type, or status.

## Performance

The LSP server must respond to requests in under 50ms for a project with 100 files. Diagnostics are debounced (500ms after last change) to avoid excessive re-validation on typing. Completion requests must be under 10ms — the user expects instant auto-complete.

The server maintains an `EmdIndex` in memory, updated incrementally on file changes (via LSP's `didChangeWatchedFiles` or `workspace/didChangeWatchedFiles`). Full re-index is only needed on server startup or workspace folder change.

## Editor Integration

**VS Code**: Extension on the VS Code marketplace. Registers `.emd` file type, connects to `emd lsp` binary. Configuration: path to `emd` binary, format-on-save toggle, severity preferences.

**Neovim**: via `nvim-lspconfig`. Minimal config: `require('lspconfig').emd.setup{}`. The binary is `emd lsp`.

**Zed**: Native support via LSP extension. Zed's LSP integration is automatic — just point to the binary.

**IntelliJ**: via LSP4IJ plugin. Community-maintained.

**Visual Interpreter**: The interpreter uses the LSP server (via WASM or embedded) for inline diagnostics, hover tooltips, and go-to-definition navigation.

## Integration With Other Features

**Parser + Validator**: The LSP server calls the parser on file open/change and the validator on debounced idle. Diagnostics come from the validator.

**CLI Toolchain**: `emd lsp` is the CLI entry point. The CLI binary is the LSP binary — same executable, different mode.

**Visual Interpreter**: The interpreter consumes LSP diagnostics for editor underlines and can delegate validation to the LSP server.

## Known Limitations

- No refactoring support in V1 (rename section, extract section, move section to new file)
- No semantic tokens (syntax highlighting) — V1 relies on TextMate grammars for editor highlighting
- No inlay hints (showing inferred types, status transitions)
- Workspace symbol search is text-based, not semantic (V2: search by link graph context)

## V2 Plans

- Refactoring: rename section (updates all incoming links), extract section to new file, move section between files
- Semantic tokens for richer syntax highlighting in editors
- Inlay hints: show dependency status inline (e.g., "→ depends: feature-x [done ✓]")
- Code lens: show "2 pending tasks" above a `[summary]` section
- Find references: find all sections that link to the current section
