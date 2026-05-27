# LSP Server — TODO

<!-- STATUS: done -->

## Core Server
- [x] LSP server binary (uses tower-lsp, runs over stdio)
- [x] Initialize handshake with editor capabilities
- [x] Workspace folder detection and EmdIndex building

## Diagnostics
- [x] Publish diagnostics on file open
- [x] Re-validate after debounced changes (500ms)
- [x] Error, Warning, Info, Hint severity levels
- [x] Source spans for underline ranges
- [x] Code action suggestions for fixable issues

## Hover
- [x] Section header hover: type, status, incoming/outgoing links
- [x] Wiki-link hover: target type, status, summary excerpt
- [x] → link hover: relation type description, target status, validity
- [x] Dependency status summary on hover

## Go-to-Definition
- [x] Cmd+Click wiki-link → navigate to target file + line
- [x] Cmd+Click → link → navigate to target section
- [x] Transclusion: show referenced content (peek definition)

## Completion
- [x] Section type completion after `## [`
- [x] Link relation completion after `→ ` (context-aware)
- [x] Status completion after `|` in header
- [x] Wiki-link target completion inside `[[`
- [x] Code block tag completion after `` ``` ``
- [x] Completion under 10ms response time

## Format on Save
- [x] Format file via emd fmt engine
- [x] Return text edits for editor to apply
- [x] Idempotent output

## Code Actions
- [x] "Rename broken link to closest match"
- [x] "Add missing status"
- [x] "Remove unused dependency"
- [x] "Mark as done"

## Document Symbols
- [x] Section hierarchy as document symbols
- [x] Grouped by type, nested by H1→H6
- [x] Status and type shown in symbol name

## Workspace Symbols
- [x] Fuzzy search across all project .emd files
- [x] Search by title, type, status
- [x] Under 50ms response

## Performance
- [x] Request response under 50ms for 100-file project
- [x] Completion under 10ms
- [x] Incremental index updates on file changes
- [x] Full re-index only on startup/workspace change

## Editor Extensions
- [x] VS Code extension (marketplace)
- [x] Neovim config via nvim-lspconfig
- [x] Zed extension
- [x] Documentation for manual LSP setup in other editors

## Tests
- [x] Diagnostics published on file open with broken link
- [x] Hover shows correct section type on header
- [x] Go-to-def navigates to correct file and line
- [x] Completion suggests section types after `## [`
- [x] Format on save returns idempotent output
- [x] Code action fixes broken link
