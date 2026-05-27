# Feature: EMD Core — Parser

<!-- STATUS: designed -->
<!-- DEPENDS_ON: none -->
<!-- PARENT: emd-core -->

## What This Is

The EMD parser is the reference implementation of the Everything MarkDown format specification. It reads raw `.emd` text and produces a fully typed Abstract Syntax Tree (EmdDocument) that every other component in the EMD ecosystem consumes. The parser is a Rust library — compiled natively for desktop/CLI and to WASM for web/npm hosts — with zero network dependencies. It is the single source of truth that the Visual Interpreter, CLI tools, LSP server, context loader, and agent graph executor all depend on.

The parser is NOT a full markdown parser from scratch. It extends `pulldown-cmark`, the same battle-tested markdown parser used by Rust's documentation tooling. EMD adds a machine layer on top of standard markdown: typed section headers, semantic link arrows, tagged code fences, transclusion directives, and metadata comments. Everything the parser adds is invisible to standard markdown renderers — the file remains 100% backward compatible with GitHub, Obsidian, VS Code, and any markdown viewer.

## Why It Matters

The parser is the foundation of the entire EMD ecosystem. Without it, there are no typed sections, no semantic link graph, no context loading, no agent execution, no visual blocks in the interpreter. Every token of context savings — the 50x reduction from loading full files to loading targeted `[summary]` sections — starts with the parser being able to identify what kind of section something is.

The parser must be fast enough to run on every keystroke in the interpreter (under 5ms for 500 sections) so the AST stays in perfect sync with the editor content. It must be robust enough to never return a null AST — even on malformed input, it produces valid AST nodes with diagnostic markers attached. It must be small enough to compile to WASM and ship as an npm package under 200KB gzipped.

## Original User Notes

From the EMD ORIGINAL IDEA: EMD is "Markdown that became everything — documentation, agent config, workflow orchestration, memory storage, task tracker, API spec, prompt templates." The parser must handle all of these section types meaningfully, not just parse them as text. Each section type carries different semantic weight — a `[task]` section has status tracking, a `[graph]` section has nodes and edges, a `[config]` section has runtime values. The parser must capture these semantics in the AST.

The user explicitly stated: "100% backwards compatible with Markdown — any .emd file renders fine in any markdown viewer. The machine layer is additive and invisible to standard renderers." This means the parser must treat all EMD syntax as optional annotations on valid markdown. A header is still a header. A code fence is still a code fence. The `[type]` and `→` annotations are metadata, not a new language grammar.

## Section Types The Parser Must Handle

The EMD specification defines seventeen section types, each with distinct parsing behavior:

**Documentation types**: `[summary]` — always safe to load, one-paragraph overview of any concept. `[detail]` — deep content, loaded on demand only. The parser distinguishes these so the context loader can filter by safety level. A summary section should never be deep technical content. A detail section should never be a one-line overview. The parser validates this structural contract.

**Task tracking types**: `[task]` — work items with mandatory status tracking (`[task|pending]`, `[task|done]`, `[task|in-progress]`, `[task|blocked: reason]`, `[task|archived]`, `[task|cancelled]`). The parser extracts the status from the header and validates it against the six known statuses. Unknown statuses produce diagnostics but still parse. The status reason (after `blocked:`) is captured as a string.

**Decision types**: `[decision]` — architecture decision records. Supports status modifiers like tasks. The parser treats these as permanent historical records that should never be deleted, only archived.

**API types**: `[api]` — tool and interface definitions. The parser enters a special sub-mode where `→ param:`, `→ returns:`, and `→ errors:` link types are expected. These links define the contract that the language bindings generator (V2) consumes.

**Specification types**: `[spec]` — requirements and acceptance criteria. Used during verification phases. The parser flags spec sections that have no linked `[verify]` sections (unverified specs are a warning).

**Agent types**: `[agent]` — AI agent configuration. The parser enters agent sub-mode where `→ model:`, `→ tools:`, `→ memory:`, `→ context:`, and `→ persona:` link types are expected. These define the agent that the graph executor will spawn. The parser validates that model and tools links are present (an agent without tools is a warning).

**Human checkpoint types**: `[human]` — always visible, never filtered. Human-in-the-loop checkpoints that the context loader must always include regardless of token budget. The parser marks these with a special flag.

**Verification types**: `[verify]` — validation rules and test commands. The parser expects code blocks with shell commands. The CLI can execute these directly.

**Configuration types**: `[config]` — runtime configuration values. The parser expects key-value pairs. Validates against a known config schema.

**Graph types**: `[graph]` — workflow topology. The parser enters graph sub-mode where `→ node:`, `→ edge:`, `→ entry:`, `→ max-iterations:`, and `→ timeout:` link types are expected. This is the most complex section type — the parser must validate that edges reference existing nodes, that entry points exist, and that the graph is a valid directed graph (no orphan nodes, at least one path to END).

**Visual types**: `[draw]` — freehand drawing canvas data. Stores Excalidraw-compatible JSON in code blocks. `[flow]` — WYSIWYG flowchart editor data. `[kanban]` — kanban board auto-generated from task links. The parser treats these as visual containers with special rendering hints for the interpreter.

**Template types**: `[template]` — LLM prompt templates. The parser identifies `{{variable}}` placeholders and extracts them as template variables for the interpreter's template editor.

**Example types**: `[example]` — usage examples. The parser marks these as safe-to-load demonstration content.

## Code Block Tags The Parser Must Handle

The EMD specification defines seventeen code block tags, each signaling different rendering behavior in the interpreter:

**Execution tags**: `[verify]` — shell commands that can be executed. The parser marks these as executable and extracts the shell command. `[prompt]` — LLM prompts with template variables. `[snippet]` — illustrative code, explicitly NOT runnable.

**Visual render tags**: `[html]` and `[css]` — live preview in sandboxed iframe. The parser links adjacent HTML and CSS blocks so the interpreter applies the CSS to the sibling HTML. `[mermaid]` — diagram source that the interpreter renders as SVG. `[katex]` — math that the interpreter renders as formatted equations. `[diff]` — unified diff that the interpreter renders side-by-side. `[todo]` — interactive checklist. `[vega]` — chart specification. `[3d]` — 3D model viewer config. `[gantt]` — timeline data. `[media]` — video/audio embed URLs.

**Data tags**: `[schema]` — JSON schema that the interpreter renders as a tree viewer. `[draw]` — canvas drawing data in Excalidraw JSON format.

The parser must validate that tagged code blocks contain content appropriate to their tag — a `[mermaid]` block containing Python code is a warning. A `[katex]` block containing prose is an error.

## Semantic Link Syntax

Lines beginning with `→` are the machine-readable typed edges that form the knowledge graph. The parser treats these as graph edges with named relation types, not as document text.

**Link format**: `→ relation: target [condition: value]`

The parser extracts three components: the relation type, the target (which can be a `[[wiki-link]]`, a file path with anchor, or a raw string), and an optional condition (used in graph edge definitions).

**Relation types the parser recognizes**:
- Dependency relations: `depends`, `implements`, `tested-by`, `supersedes`, `compatible-with`, `alternative-to`, `extends`, `blocked-by`
- API definition relations: `param`, `returns`, `errors`
- Agent definition relations: `model`, `tools`, `memory`, `context`, `persona`
- Graph definition relations: `node`, `edge`, `entry`, `max-iterations`, `timeout`
- Memory relations: `store-in`, `recall-from`, `compress-after`
- Custom: `Custom(String)` — unknown relations are captured as custom types rather than rejected

The parser validates that relation types match their section context. A `→ param:` link inside a `[summary]` section is a warning. A `→ returns:` link inside a `[task]` section is an error. The graph definition relations (`node`, `edge`, `entry`) are only valid inside `[graph]` sections.

## Transclusion

The `![[filename.emd#Section-Title]]` syntax inlines another EMD section at parse time. The parser resolves this during AST construction by loading the referenced file and extracting the matching section. This is the mechanism that allows the context loader to compose minimal context windows from many files without loading entire documents.

The parser must handle: local file references (`![[./docs/api.emd#Endpoints]]`), workspace-relative references (`![[docs/api.emd#Endpoints]]`), and section anchor references where the section title matches the anchor text. Unresolvable transclusions produce diagnostics but do not fail the parse.

## Metadata Comments

Standard HTML comments (`<!-- -->`) carry machine-readable metadata. The parser extracts these as key-value pairs:
- `<!-- STATUS: done -->` — section-level status override
- `<!-- DEPENDS_ON: feature-a, feature-b -->` — cross-file dependency declarations
- `<!-- VERSION: 0.1.0 -->` — document version
- `<!-- OWNER: agent:Builder | human:@user -->` — ownership tracking

These are invisible in rendered markdown but critical for the validator and context loader.

## Error Recovery Strategy

The parser NEVER returns a null AST. Malformed sections produce valid AST nodes with `Diagnostic` markers attached. This is critical for the interpreter — the user types `#` and the parser produces a tentative header, not a crash. The validator later reports the issues.

Error recovery behaviors:
- Unknown section type → parsed as generic section with `[unknown: typename]` diagnostic
- Malformed status → parsed with `SectionStatus::Unknown` and diagnostic
- Unknown link relation → captured as `LinkRelation::Custom(String)`, no error
- Unclosed code fence → parser assumes fence closes at end of file
- Invalid transclusion → produces diagnostic, section content becomes the raw `![[...]]` text
- Nested sections at wrong level → flattened with diagnostic about hierarchy violation

## Performance Requirements

The parser must parse a 500-section `.emd` file in under 5 milliseconds. This enables keystroke re-parsing in the interpreter with a 50ms debounce. The benchmark target is derived from the user's token savings analysis: if we're going to save 5-10x on token costs, the parsing itself must be effectively free.

Performance is achieved through: zero-copy string handling where possible, the `logos` lexer generator (compile-time state machine, no runtime regex), incremental parsing of only changed sections when possible (not in V1 but designed for), and lazy validation — the parser produces the AST fast, the validator runs as a separate pass.

## Integration With Other Features

**Validator**: The parser produces the AST. The validator consumes it. The parser makes no claims about link resolution or semantic correctness — that's the validator's job. The parser only guarantees structural correctness.

**Context Loader**: The parser provides the section type and status for every section. The context loader uses this to filter what to include in context windows.

**CLI Toolchain**: The CLI calls the parser, then the validator, then dispatches to the appropriate command. `emd check` = parse + validate. `emd fmt` = parse + format + write. `emd query` = parse + filter + serialize.

**LSP Server**: The LSP server calls the parser on every file open and change. Parser performance directly impacts editor responsiveness.

**Visual Interpreter**: The interpreter calls the WASM-compiled parser on every keystroke. The AST drives block rendering. If the parser is slow, the editor feels laggy.

**Graph Executor**: The graph executor parses `[agent]` and `[graph]` sections to extract the workflow topology before spawning agents.

**TypeScript Compiler**: The TS compiler reimplements the parser in TypeScript following the same specification, producing the same AST types but without the Rust/WASM dependency.

## Audit Decisions

During the audit conversation, the following decisions were locked in:

- **Rust reference implementation**: The `emd` crate is the reference parser. Community ports (Python, TypeScript, Go) follow the spec. The TS compiler is a parallel implementation, not a port.
- **Single `emd` crate, native + WASM**: One codebase, compiled to both targets via `wasm-pack`. No separate "emd-core" and "emd-wasm" crates.
- **Partial parse with diagnostics**: The parser never fails completely. Malformed input produces valid AST nodes with error markers. This is non-negotiable for the interactive editor use case.
- **Under 5ms parse target**: Enables keystroke re-parse with debounce. If the parser can't hit this, the interpreter falls back to parse-on-blur.
- **pulldown-cmark as base**: Not writing a markdown parser from scratch. EMD extends an existing, well-tested parser.
- **MIT license**: Maximum adoption. No copyleft restrictions.

## Known Limitations

- No incremental parsing in V1 — the entire file is re-parsed on every change. For files under 500 sections, this is fine at <5ms. Longer files may need V2 incremental parsing.
- Wiki-link resolution is deferred to the validator — the parser captures `[[links]]` as unresolved references. Resolution happens in a separate pass.
- Transclusion is synchronous and blocking in V1 — the parser loads referenced files during AST construction. Large transclusion chains could cause parse delays.
- No streaming parse — the parser needs the full file content. Large files (10,000+ sections) could exceed memory/time budgets.
- Custom link relations are captured but not validated — any string is accepted as `Custom(String)`. The validator later warns about unknown relation types.

## V2 Plans

- Incremental parsing: only re-parse sections that changed since last parse
- Streaming parse for large files: begin producing AST nodes before the full file is loaded
- Parallel transclusion resolution: load referenced files concurrently
- Section type extension API: allow plugins to register custom section types with custom validation rules
