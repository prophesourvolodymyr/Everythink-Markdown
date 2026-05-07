# Validator — TODO

<!-- STATUS: done -->

## Link Resolution
- [x] Cross-file `[[wiki-link]]` resolution against EmdIndex
- [x] Section anchor fuzzy matching (case-insensitive, whitespace-normalized)
- [x] Workspace-relative path resolution
- [x] Unresolvable links → error diagnostics with source span

## Status Consistency
- [x] Done task with pending dependencies → warning
- [x] Blocked task with resolved blocker → stale blockage warning
- [x] Archived decision with active implementors → warning
- [x] Circular dependency detection (depth-limited to 50)
- [x] Status transition validation (pending→in-progress→done allowed, done→pending warning)

## Section Context Validation
- [x] API relations only in `[api]` sections
- [x] Agent relations only in `[agent]` sections
- [x] Graph relations only in `[graph]` sections
- [x] Unknown relation types → info diagnostic
- [x] Custom relations → no diagnostic (intentional)

## Graph Validation
- [x] Edge nodes must exist in same graph section
- [x] Entry node must exist
- [x] All nodes must be reachable from entry
- [x] Max-iterations > 0
- [x] Timeout > 0

## Code Block Content Checks
- [x] Mermaid blocks contain diagram-like content
- [x] KaTeX blocks contain math-like content
- [x] HTML blocks contain markup-like content
- [x] Content-type warnings (not errors)

## Template Variable Checks
- [x] `{{variable}}` placeholders extracted
- [x] Unknown variables → warnings

## Metadata Checks
- [x] DEPENDS_ON matches actual → depends links
- [x] VERSION is valid semver
- [x] OWNER format is valid

## Diagnostic Output
- [x] Error, Warning, Info, Hint severity levels
- [x] Source spans for editor underlining
- [x] Human-readable messages
- [x] `--strict` flag promotes warnings to errors

## Performance
- [x] 100 files × 500 sections validates under 50ms
- [x] EmdIndex built once, incrementally updated on file change

## Tests
- [x] Broken link produces error diagnostic
- [x] Circular dependency produces error diagnostic
- [x] Stale blockage produces warning diagnostic
- [x] Wrong relation context produces warning diagnostic
- [x] Valid document produces zero diagnostics
