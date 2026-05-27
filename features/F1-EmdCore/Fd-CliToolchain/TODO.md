# CLI Toolchain — TODO

<!-- STATUS: done -->

## check
- [x] `emd check ./project` — validate all .emd files
- [x] Exit non-zero on errors, zero on clean/warnings
- [x] `--strict` flag promotes warnings to errors
- [x] `--format json` for machine-readable output
- [x] `--format minimal` for file:line:message
- [x] `--quiet` for exit code only
- [x] Colored output with source snippets (miette)
- [x] Suggest fixes for common errors (wrong relation context, broken links)

## fmt
- [x] `emd fmt file.emd` — auto-format
- [x] `emd fmt ./project` — format all .emd files in project
- [x] Idempotent: running twice produces same output
- [x] Never modifies content, only spacing/formatting
- [x] `--check` flag: exit non-zero if formatting needed (CI mode)
- [x] Consistent section header spacing
- [x] Consistent → arrow indentation
- [x] Blank lines between H2 sections
- [x] Sorted link order within sections

## query
- [x] `emd query "tasks|pending"` — JSON output
- [x] `emd query "decisions|archived"` — filter by type + status
- [x] `--format table` for human-readable output
- [x] `--format json` (default) for machine-readable
- [x] `--count` for count-only output

## graph
- [x] `emd graph ./project` — DOT output for Graphviz
- [x] `--format json` for full link graph as JSON
- [x] `--format dot` (default)
- [x] Pipe to Graphviz: `emd graph . | dot -Tpng -o graph.png`

## export
- [x] `emd export file.emd --html` — standalone HTML
- [x] `emd export file.emd --json` — full AST
- [x] `emd export file.emd --md` — strip EMD annotations, pure markdown
- [x] `emd export file.emd --dot` — link graph as DOT
- [x] `emd export ./project --static` — static HTML website
- [x] `--output dir/` flag for output directory

## new
- [x] `emd new project` — scaffold empty project
- [x] `emd new project --template name` — from template gallery
- [x] `emd new --list` — show available templates
- [x] Creates directory, AGENTS.emd, CYCLES.emd

## lsp
- [x] `emd lsp` — start LSP server on stdio
- [x] Delegates to LSP server feature

## generate (V2)
- [x] `emd generate --lang typescript`
- [x] `emd generate --lang python`
- [x] `emd generate --lang go`
- [x] `emd generate --lang rust`
- [x] Reads [api] sections, generates type-safe clients

## UX
- [x] `emd help` with subcommand-specific help
- [x] `emd version` with build info
- [x] Shell completions (bash, zsh, fish) via `emd completions`
- [x] Colored output, disabled with `--no-color` or NO_COLOR env var

## CI Integration
- [x] `emd check --strict --format json` for CI pipelines
- [x] GitHub Actions example in docs
- [x] GitLab CI example in docs

## Testing
- [x] Every subcommand smoke-tested
- [x] fmt is idempotent on all sample files
- [x] check catches broken links, invalid types
- [x] export produces valid HTML/JSON/MD
