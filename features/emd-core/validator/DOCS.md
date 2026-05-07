# Feature: EMD Core — Validator

<!-- STATUS: designed -->
<!-- DEPENDS_ON: parser -->
<!-- PARENT: emd-core -->

## What This Is

The validator is the semantic checker for EMD documents. While the parser guarantees structural correctness (valid section headers, properly formed links, matched code fences), the validator guarantees semantic correctness: do cross-file links resolve? Are statuses consistent? Do graph edges reference existing nodes? Are the right link relations used in the right section contexts?

The validator operates on the AST produced by the parser, plus an `EmdIndex` that contains all `.emd` files in the project. It produces a list of `Diagnostic` objects with severity levels (error, warning, info), source spans for editor underlining, and human-readable messages. The validator never modifies the AST — it is a read-only analysis pass.

## Why It Matters

The validator is what makes EMD trustworthy as a system format. Without validation, a `→ depends:` link that points to a deleted file silently breaks. An `[agent]` section with a misspelled tool name silently fails at runtime. A `[graph]` with an edge referencing a non-existent node produces undefined behavior. The validator catches these before the context loader, graph executor, or interpreter ever encounter them.

For the user in the interpreter, validation means: broken links show red underlines. Missing dependencies show warnings. Conflicting statuses show amber highlights. The validator is the spell-check for the EMD knowledge graph.

## Original User Notes

The user's ORIGINAL IDEA for EMD emphasizes the semantic link graph as a core value proposition: "The AI traverses the typed link graph. It does not read the files. The conclusion is machine-derived in 180 tokens instead of 2300." For this to work, the link graph must be valid. The validator is what guarantees validity.

The user also emphasizes self-updating files: agents write `[task|done]` back to `.emd` files. If an agent marks a task as done but the task's dependencies are still pending, the validator catches the inconsistency.

## What The Validator Checks

### Cross-File Link Resolution
Every `[[wiki-link]]` and `→` link target is resolved against the `EmdIndex`. Unresolvable links produce errors. The validator handles:
- File references: `[[other-file.emd]]` — does the file exist in the project?
- Section references: `[[file.emd#Section-Title]]` — does the section exist in the file?
- Section anchor fuzzy matching: section titles are matched case-insensitively with whitespace normalization
- Workspace-relative paths: `[[./docs/api.emd#Endpoints]]`

### Status Consistency
The validator enforces consistency rules across linked sections:
- A `[task|done]` section with `→ depends:` links to `[task|pending]` sections is a warning — "task is marked done but depends on incomplete work"
- A `[task|blocked: reason]` section where the blocking task is `[task|done]` is a stale blockage — "blocker is resolved but this task is still marked blocked"
- A `[decision|archived]` section with active `→ implements:` links from non-archived sections is a warning — "archived decision still in use"
- Circular dependencies: A → depends → B → depends → A is an error

### Section Type Context Validation
The validator checks that link relations match their section context:
- `→ param:`, `→ returns:`, `→ errors:` should only appear inside `[api]` sections
- `→ model:`, `→ tools:`, `→ memory:`, `→ persona:` should only appear inside `[agent]` sections
- `→ node:`, `→ edge:`, `→ entry:`, `→ max-iterations:`, `→ timeout:` should only appear inside `[graph]` sections
- `→ depends:`, `→ implements:`, `→ tested-by:` are valid anywhere
- Using graph relations outside a `[graph]` section is a warning
- Using API relations outside an `[api]` section is a warning

### Graph Validation (inside `[graph]` sections)
Special validation for agent workflow graphs:
- Every `→ edge: source → target` must reference nodes that exist in the same `[graph]` section
- The entry node must exist and be a node, not a condition
- Every node should have at least one outgoing edge or reach END
- Unreachable nodes (no path from entry) are warnings
- Max iterations and timeout values must be positive

### Code Block Content Validation
- `[mermaid]` blocks should contain valid Mermaid syntax (the validator doesn't render, but checks for obvious non-diagram content)
- `[katex]` blocks should contain LaTeX math syntax
- `[html]` blocks should contain HTML (not Python, not prose)
- Content-type mismatches are warnings, not errors (the user might be pasting content before switching the tag)

### Template Variable Validation
- `[prompt]` and `[template]` sections with `{{variable}}` placeholders are checked against known context variables
- Unknown template variables are warnings (the variable might be defined elsewhere)

### Metadata Consistency
- `<!-- DEPENDS_ON: feature-a -->` is checked against actual `→ depends:` links — mismatches are warnings
- `<!-- VERSION: 0.1.0 -->` is checked for semver format
- `<!-- OWNER: -->` is checked for valid format

## Validation Levels

The validator produces diagnostics at four severity levels:
- **Error**: Broken link, invalid graph edge, circular dependency. Must be fixed. `emd check` exits non-zero.
- **Warning**: Type-context mismatch, stale blockage, unused dependency. Should be fixed. `emd check` reports but exits zero.
- **Info**: Missing documentation, suggested improvements. Cosmetic. Shown in LSP as hints.
- **Hint**: Style suggestions, best practices. Can be suppressed in settings.

The CLI's `--strict` flag promotes warnings to errors for CI pipelines.

## Performance

The validator runs after the parser, as a separate pass. For a project with 100 `.emd` files and 500 sections each, the validator should complete in under 50ms. The `EmdIndex` is built once at project load and incrementally updated on file changes.

## Integration With Other Features

**Parser**: The validator consumes the AST. The parser guarantees structural correctness. The validator guarantees semantic correctness.

**Context Loader**: The context loader uses the validator's link resolution to traverse the graph. If validation hasn't run, the context loader runs it implicitly.

**CLI Toolchain**: `emd check` = parse + validate. Exit code depends on error presence. `--strict` flag for CI.

**LSP Server**: Validator diagnostics are shown as editor underlines, hover messages, and problem panel entries.

**Visual Interpreter**: Red underlines on broken links in the editor. Amber highlights on warnings. The interpreter calls the validator on file open and after debounced changes.

**Graph Executor**: The executor runs a pre-flight validation before spawning agents. If the graph has errors, the executor refuses to run and shows the diagnostics.

## Known Limitations

- Cross-file validation requires the full project index — single-file validation has limited scope
- Circular dependency detection is depth-limited to 50 hops to prevent infinite loops
- Template variable validation is best-effort — not all variables are known at parse time
- Graph reachability analysis is simple DFS, not a full graph algorithm (intentionally fast over thorough)

## V2 Plans

- Incremental validation: only re-validate sections that changed
- Cross-project validation: validate links to external projects
- Auto-fix: offer to rename broken links to match actual files (with user confirmation)
- Custom validation rules via plugin API: community can add domain-specific checks
