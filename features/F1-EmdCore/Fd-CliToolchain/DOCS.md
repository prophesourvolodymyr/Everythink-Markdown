# Feature: EMD Core — CLI Toolchain

<!-- STATUS: designed -->
<!-- DEPENDS_ON: parser, validator, context-loader -->
<!-- PARENT: emd-core -->

## What This Is

The `emd` command-line tool — a single binary that validates, formats, queries, exports, scaffolds, and serves EMD projects. It is the non-GUI entry point to the EMD ecosystem: developers use it in terminals, CI pipelines use it for validation, and scripts use it for automation.

The CLI is the Rust reference implementation's public face. It is distributed via crates.io (`cargo install emd`) and as standalone binaries on GitHub Releases for macOS, Linux, and Windows. No runtime dependencies. Single binary. Same model as ripgrep, Prettier, and ESLint.

## Why It Matters

The CLI is what makes EMD an "open standard" rather than "editor-specific format." Anyone can validate an EMD project with `emd check ./project` regardless of what editor they use. CI pipelines can block merges on broken EMD links with `emd check --strict`. Documentation sites can build from `.emd` files with `emd export --html`.

The CLI also serves as the reference implementation for community ports. When someone writes `emd-py` for Python, they test against the Rust CLI's output. The CLI's behavior is the spec, not just the spec document.

## Subcommands

### `emd check ./project`
Validates all `.emd` files in a project directory. Parses every file, runs the validator, and reports diagnostics. Exit code 0 for clean, non-zero for errors. `--strict` flag treats warnings as errors.

**CI integration**: `emd check --strict --format json` outputs machine-readable JSON for CI tooling. GitHub Actions, GitLab CI, Jenkins — any pipeline can gate merges on EMD validation.

**Output modes**: default (human-readable with colors and source snippets), `--format json` (machine-readable), `--format minimal` (file:line:message only), `--quiet` (only exit code).

### `emd fmt file.emd`
Auto-formats an EMD file. Standardizes section header spacing, link arrow formatting, code block tag formatting, trailing whitespace, and blank line separation between sections. The formatter is idempotent — running it twice produces the same output. Never modifies content, only formatting.

**Formatting rules**: consistent spacing around `[type]` headers, consistent `→` arrow indentation, blank line before each H2 section, code fence language tags on their own line, sorted link order within sections.

### `emd query "expression"`
Queries the project's indexed EMD files and returns matching sections as JSON. Uses the ContextLoader internally. Expression format: `type|status` (e.g., `tasks|pending`, `tasks|blocked`, `decisions|archived`). `--format table` for human-readable output.

### `emd graph ./project`
Exports the typed link graph as DOT (Graphviz) or JSON. The DOT output can be piped to Graphviz for visualization: `emd graph . | dot -Tpng -o graph.png`. The JSON output is the full link graph with nodes, edges, relation types, and statuses — used by the Visual Interpreter's graph visualization panel.

### `emd export file.emd`
Exports EMD files to multiple formats:
- `--html` — standalone HTML with rendered sections. Uses the interpreter's block renderers (or a minimal built-in renderer). Suitable for publishing documentation.
- `--json` — full AST as JSON. Machine-readable for tooling.
- `--md` — strips EMD annotations (`[type]`, `→` links, tagged code fences) and produces pure markdown. For publishing in standard markdown viewers.
- `--dot` — link graph as DOT (same as `emd graph` but for single file).
- `--static` — static HTML website of the entire project. Used for collaboration preview.

### `emd new project --template [name]`
Scaffolds a new EMD project. Creates the directory structure, an `AGENTS.emd` file, and a `CYCLES.emd` file. `--template` selects from the template gallery: `project-starter`, `autonomous-builder`, `daily-standup`, `architecture-review`, `bug-report`, `api-docs`, `kanban-project`. `--list` shows available templates.

### `emd lsp`
Starts the EMD Language Server Protocol server. Editors connect via stdio and receive diagnostics, hover info, go-to-definition, completion, and formatting. The CLI delegates to the LSP server feature.

### `emd generate --lang [language]` (V2)
Generates type-safe client code from `[api]` sections. Reads `→ param:`, `→ returns:`, `→ errors:` definitions and generates TypeScript interfaces, Python dataclasses, Go structs, or Rust structs with HTTP client functions.

## Original User Notes

The user's vision: "EMD is a text format. The spec is a document. Any language can implement a parser." And: "Same model as Prettier, ripgrep, ESLint — Rust binary, zero runtime, any project." The CLI embodies this: one binary, no dependencies, works on any project that uses `.emd` files.

## Performance

All subcommands that parse files should complete in under 100ms for a project with 100 files and 500 sections each. The `check` subcommand is the slowest (parse + validate all files). The `query` subcommand is the fastest (index pre-built, just filter). The `export` subcommand's speed depends on the number and size of files.

## Error Handling

The CLI uses `miette` for rich error reporting: colored output, source snippets with underlines, contextual help text. Errors should tell the user not just what went wrong, but why and how to fix it. A broken link should show: "Link `→ depends: [[deleted-feature#Section]]` points to file `deleted-feature.emd` which does not exist. Did you mean `[[feature-x#Section]]`?"

## Integration With Other Features

**Parser**: All subcommands that read files go through the parser first.
**Validator**: `emd check` runs the validator. `emd export` runs the validator before exporting.
**Context Loader**: `emd query` uses the context loader internally.
**LSP Server**: `emd lsp` delegates to the LSP server feature.
**Graph Executor**: Commands that need `[agent]` or `[graph]` execution delegate to `emd-graph`.
**Visual Interpreter**: The interpreter calls `emd check` (or uses the WASM equivalent) when the user triggers validation. The interpreter's "Share" button calls `emd export --static`.
**Template Gallery**: `emd new --template` fetches from the template gallery.

## Known Limitations

- No watch mode in V1 (re-run on file changes) — user calls `emd check` manually or via file watcher script
- `export --html` uses a simple renderer in V1, not the full interpreter block renderers
- Template gallery is CLI-only in V1 — in-app gallery in V1.5
- `generate` subcommand in V2 (language bindings generator)

## V2 Plans

- `emd watch` — file watcher that re-runs check/export on changes
- `emd serve` — local development server with hot reload for the Visual Interpreter
- `emd publish` — publish workspace as static site (collaboration preview)
- `emd doctor` — diagnose project health: unused sections, stale links, orphaned tasks
