# EMD — Everything MarkDown

<!-- STATUS: active -->
<!-- SPEC_VERSION: 0.2.0 -->

---

## [summary] What Is EMD?

**EMD** stands for **Everything MarkDown**.

The name says it all: Markdown that became everything — documentation, agent config,
workflow orchestration, memory storage, task tracker, API spec, prompt templates.
One format. One file. Every consumer reads its relevant section.

EMD is NOT just a file format.
EMD is NOT just documentation.
EMD is NOT just a config file.

It is all of them simultaneously — and the Rust runtime executes it directly.

### Key properties

- **100% backwards compatible with Markdown** — any `.emd` file renders fine in any
  markdown viewer. The machine layer is additive and invisible to standard renderers.
- **Typed sections** — every section declares what it is (`[task]`, `[api]`, `[agent]`, etc.)
  enabling selective context loading and massive token savings
- **Semantic links** (`→`) — typed edges between sections form a machine-traversable
  knowledge graph. Not navigation links — reasoning links.
- **Language agnostic** — EMD is a text format. Any language can implement a parser.
  The Rust implementation (`emd` crate) is the reference implementation.
- **Executable** — `[graph]` + `[agent]` sections are not documentation about a workflow.
  They ARE the workflow. The EMD runtime reads and executes them directly.
- **Self-updating** — agents write results back to the same `.emd` files. A `[task|pending]`
  becomes `[task|done]` when complete. The file is always current.

### The name

> EMD = Everything MarkDown
>
> Markdown became the universal writing format.
> EMD is Markdown that became the universal *system* format.
> It starts as a `.md` file. It ends as your entire stack.

---

## [detail] The Paradigm Shift

### Before EMD: two layers, always out of sync

```
Layer 1: Content (Markdown)
  feature-a.md       ← just text
  feature-b.md       ← just text
  decision.md        ← just text

Layer 2: Connections (separate tool)
  Obsidian graph view
  Roam Research backlinks
  Notion linked databases
  lat.md / wiki-links
  LangGraph JSON
  CrewAI YAML
  n8n workflow blobs
```

The connection layer only answers one question: **"what links to what?"**

The lines have no meaning. The tool cannot tell you:
- WHY files are connected
- WHAT the current state of each node is
- WHETHER a dependency is satisfied
- WHAT conclusion to draw

A human reads everything and assembles the answer manually.
An AI loads every file and figures it out from scratch every time.

### After EMD: one layer that contains everything

```
feature-a.emd

## [task|done] Implement provider trait
→ depends: [[feature-b#Config-Spec]]
→ implements: [[decision#Architecture-Choice]]
→ tested-by: [[tests#provider-tests]]
```

The connection board is not a separate tool.
**It is generated from the files themselves.**

Every `→` link is typed. Every section has a status.
The graph has meaning. The system answers questions automatically.

### Old connection board vs EMD link graph

```
OLD (Obsidian/Roam):
  [feature-a] ──────── [feature-b]
        │                    │
   [decision] ────── [feature-c]
  "Lines mean: someone put a link here once"

NEW (EMD):
  [feature-a: done] ──depends──→ [feature-b: done]
          │                               │
    ──implements──→ [decision: archived]  └──tested-by──→ [tests: done]
          │
    ──blocked-by──→ [feature-c: pending ← missing config]
  "Every edge has a type. Every node has a status."
```

### AI reaching conclusions

**Old — "is feature-a ready to ship?"**
```
1. Load feature-a.md  → 800 tokens
2. Load feature-b.md  → 600 tokens
3. Load decision.md   → 400 tokens
4. Load tests.md      → 500 tokens
5. Human assembles answer from 4 files, ~2300 tokens
```

**New — same question**
```
context_loader.resolve_context("feature-a")
  follows → depends:    feature-b [status: done ✓]
  follows → implements: decision  [status: archived ✓]
  follows → tested-by:  tests     [status: done ✓]
  checks  → blocked-by: feature-c [status: pending ✗]

CONCLUSION: NOT READY. Blocked by feature-c.
TOKENS USED: 180
```

The AI traverses the typed link graph. It does not read the files.
The conclusion is machine-derived in 180 tokens instead of 2300.

---

## [detail] EMD as Agent Orchestration Language

### The core insight

EMD `[graph]` + `[agent]` sections are not documentation about a workflow.
They ARE the workflow definition. The EMD runtime reads and executes them.

Like HTML and a browser:
- HTML describes a page. The browser renders it.
- EMD describes an agent system. everthink-graph executes it.

```markdown
# autonomous-build.emd

## [agent] Planner
→ model: claude-sonnet-4
→ tools: read_file, search_code, bash
→ memory: short-term
→ context: ![[CYCLES.emd#What-To-Build-Next]]

## [agent] Executor
→ model: claude-sonnet-4
→ tools: read_file, write_file, bash, git
→ memory: short-term

## [agent] Verifier
→ model: claude-sonnet-4
→ tools: bash, read_file
→ memory: none

## [graph] feature-build-loop
→ node: Planner (ReActAgent)
→ node: Executor (ToolAgent)
→ node: Verifier (ReActAgent)
→ edge: Planner → Executor [condition: has_plan]
→ edge: Executor → Verifier [condition: code_written]
→ edge: Verifier → Planner [condition: cargo_build_failed]
→ edge: Verifier → END    [condition: cargo_build_clean]
→ entry: Planner
→ max-iterations: 10
→ timeout: 30m
```

The EMD runtime reads this file → spawns three agents → runs the loop → writes results back.

### Comparison to existing orchestration tools

| Property | LangGraph | CrewAI | n8n | AutoGen | EMD |
|----------|-----------|--------|-----|---------|-----|
| Format | Python | Python + YAML | JSON blob | Python | Markdown |
| Human-readable | medium | medium | no | medium | **yes** |
| Editable in notepad | no | partial | no | no | **yes** |
| Self-documenting | no | no | no | no | **yes** |
| Single binary deploy | no | no | no | no | **yes** |
| Writes results back | no | no | no | no | **yes** |
| Memory layer built-in | no | no | no | no | **yes** |
| Token-efficient context | no | no | no | no | **yes** |
| Language agnostic format | no | no | no | no | **yes** |

---

## [spec] Full EMD Syntax Specification

### Section Header Syntax

```
## [type] Title
## [type|status] Title
## [type|blocked: reason] Title
```

All sections are standard Markdown headers (H1–H6).
The `[type|status]` annotation is the EMD machine layer.
Without it, the file renders as normal Markdown — fully backwards compatible.

---

### Section Types

| Type | Purpose | Loaded by default? |
|------|---------|-------------------|
| `[summary]` | High-level overview. Always safe to load. | YES |
| `[detail]` | Deep content. Loaded on demand only. | no |
| `[task]` | Work item with status tracking. | filtered by status |
| `[decision]` | Architectural decision record (ADR). | no |
| `[api]` | Interface / tool definition. | when calling tools |
| `[spec]` | Requirements and acceptance criteria. | when verifying |
| `[agent]` | Agent configuration and role definition. | when spawning agents |
| `[human]` | Human-in-the-loop checkpoint. | always |
| `[verify]` | Validation rules and test definitions. | when checking |
| `[config]` | Runtime configuration values. | at startup |
| `[graph]` | Workflow / agent graph topology. | when orchestrating |
| `[draw]` | Freehand drawing canvas (Excalidraw-compatible). | on demand |
| `[flow]` | WYSIWYG flowchart / node editor. | on demand |
| `[kanban]` | Kanban board auto-generated from `[task]` links. | on demand |
| `[example]` | Usage examples. | on demand |
| `[template]` | Prompt templates for LLM calls. | when prompting |

---

### Status Modifiers

```markdown
## [task|done] Implement Tab struct
## [task|pending] Write test suite
## [task|in-progress] Implement EMD parser
## [task|blocked: waiting for F15] EMD runtime integration
## [decision|archived] Use SQLite for sessions
## [task|cancelled] Migrate to Python
```

Full status vocabulary:

| Status | Meaning |
|--------|---------|
| `done` | Completed. |
| `pending` | Not started. |
| `in-progress` | Currently being worked on. |
| `blocked: reason` | Cannot proceed. Reason required. |
| `archived` | No longer active, preserved for history. |
| `cancelled` | Explicitly dropped. |

---

### Semantic Link Syntax (`→`)

Lines beginning with `→` are machine-readable typed edges.
They render as plain text in any Markdown viewer.
The EMD parser treats them as graph edges with named relation types.

#### Dependency + relationship links

```markdown
→ depends: [[feature-b#Config-Spec]]
→ implements: src/tui/tabs.rs#Tab
→ tested-by: [[tests#multi-tab-tests]]
→ supersedes: [[old-design#Tab-Struct]]
→ compatible-with: [[everthink >= 0.8]]
→ alternative-to: [[langchain]]
→ extends: [[tools-system#Tools]]
```

#### API / tool definition links (inside `[api]` sections)

```markdown
→ param: name (string, required) — the name of the file to read
→ param: offset (usize, optional) — line number to start from
→ returns: String — file contents as UTF-8
→ errors: FileNotFound, PermissionDenied, EncodingError
```

#### Agent definition links (inside `[agent]` sections)

```markdown
→ model: claude-sonnet-4
→ tools: read_file, write_file, bash, search_code
→ memory: short-term
→ context: [[docs#Config-Spec]], [[docs#Error-Spec]]
→ persona: You are a senior Rust engineer...
```

#### Graph definition links (inside `[graph]` sections)

```markdown
→ node: Planner (ReActAgent)
→ node: Executor (ToolAgent)
→ node: Verifier (ReActAgent)
→ edge: Planner → Executor [condition: has_plan]
→ edge: Executor → Verifier [condition: code_written]
→ edge: Verifier → Planner [condition: failed_check]
→ edge: Verifier → END [condition: passed_check]
→ entry: Planner
→ max-iterations: 10
→ timeout: 30m
```

#### MemPalace memory links (inside `[summary]` / `[detail]` sections)

```markdown
→ store-in: [[MemPalace/architectural-decisions]]
→ recall-from: [[MemPalace/provider-patterns]]
→ compress-after: 30d
```

---

### Code Block Tags

Standard Markdown code fences with EMD type annotations:

````markdown
```[verify]
cargo test --test integration
cargo clippy -- -D warnings
```

```[example]
let doc = EmdParser::parse(include_str!("feature.emd"))?;
let tasks = doc.sections_of_type(SectionType::Task);
```

```[schema]
{ "type": "object", "properties": { ... } }
```

```[prompt]
You are working on {{feature.title}}.
Current status: {{feature.status}}.
Pending tasks: {{feature.tasks | filter: pending}}.
```

```[snippet]
// inline reference — not runnable, illustrative only
```

```[html]
<h1>Hello World</h1>
<style>body { background: #111; color: #fff; }</style>
```

```[css]
body { background: #111; color: #fff; }
```

```[mermaid]
graph LR
  A[Parser] --> B[AST]
  B --> C[Validator]
```

```[katex]
E = mc^2
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
```

```[diff]
- old line
+ new line
```

```[todo]
- [x] Implement parser
- [ ] Write tests
- [ ] Add documentation
```

```[vega]
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {"url": "data.csv"},
  "mark": "bar",
  "encoding": {"x": {"field": "category"}, "y": {"field": "value"}}
}
```

```[3d]
{
  "model": "./scene.gltf",
  "camera": {"x": 0, "y": 2, "z": 5}
}
```

```[gantt]
Project Timeline
  Phase 1: 2024-01, 2024-03
  Phase 2: 2024-04, 2024-06
  Phase 3: 2024-07, 2024-09
```

```[media]
![video](https://example.com/demo.mp4)
![audio](https://example.com/sound.wav)
```
````

---

### Transclusion

Inline another EMD section at parse time:

```markdown
![[core-foundation/DOCS.emd#Provider-Trait]]
![[emd/spec.emd#Section-Types]]
```

Used by the context loader to compose a minimal context window from many files
without loading entire documents.

---

### Metadata Comments

HTML comments carry machine-readable metadata. Invisible in rendered Markdown.

```markdown
<!-- STATUS: done -->
<!-- STATUS: pending -->
<!-- DEPENDS_ON: feature-a, feature-b -->
<!-- VERSION: 0.1.0 -->
<!-- OWNER: agent:Planner | human:@user -->
```

---

### File Extensions

| Extension | Usage |
|-----------|-------|
| `.emd` | Primary. Full EMD parser and tooling support. |
| `.md` | Backwards compatible. Renders as standard Markdown anywhere. |

Convention: start with `.md` during early development.
Rename to `.emd` when the parser is stable and published.

---

## [detail] MemPalace Integration

### How MemPalace maps to EMD

MemPalace uses Wing → Room → Drawer spatial hierarchy
backed by ChromaDB + SQLite. With EMD, the
storage layer IS the file system:

| MemPalace concept | EMD equivalent |
|-------------------|----------------|
| Wing | EMD file (e.g., `architectural-decisions.emd`) |
| Room | `[summary]` or `[detail]` section |
| Drawer | `###` subsection inside a section |
| Knowledge graph | `→` link graph across all EMD files |
| Retrieval | Semantic search over `[summary]` sections |
| Compression | Summarize `[detail]` → rewrite as `[summary]`, mark `[detail|archived]` |
| Forget | Archive `[detail]`, keep `[summary]` |

### Memory operations as EMD operations

```
STORE:    append new [summary] section to relevant .emd file
RECALL:   semantic search over [summary] sections → return top-k
COMPRESS: llm summarize [detail] → rewrite as [summary], mark [detail|archived]
FORGET:   set [detail|archived], remove from active context index
NAVIGATE: walk → links from current file to related files
```

### What EMD eliminates

- SQLite for structured knowledge → replaced by EMD files
- Separate config files → replaced by `[config]` sections
- Separate prompt template files → replaced by `[template]` sections
- ChromaDB for structured docs → replaced by EMD index (vectors still needed for embeddings)

---

## [detail] Token Savings Analysis

### Per context load

| What gets loaded | Without EMD | With EMD | Reduction |
|-----------------|-------------|---------|-----------|
| Project orientation | Full AGENTS.md ~1,500 tok | `[summary]` sections ~200 tok | **87%** |
| Current task context | Full TODO.md ~800 tok | `[task\|pending]` only ~150 tok | **81%** |
| API contracts | JSON schema ~120 tok × 20 tools | EMD `[api]` ~50 tok × 20 | **58%** |
| Workflow definitions | LangGraph JSON ~2,000 tok | EMD `[graph]` ~400 tok | **80%** |
| Agent config | YAML/JSON ~500 tok | EMD `[config]` + `[agent]` ~150 tok | **70%** |
| Feature dependencies | 5 full DOCS.md ~3,000 tok | Pre-resolved `→` links ~200 tok | **93%** |

### Full session estimate

```
Without EMD:
  Initial load: ~8,100 tokens
  × 15 re-loads during session
  = ~121,500 tokens in documentation

With EMD context loader:
  Initial load: ~3,950 tokens (source files unchanged)
  × 15 re-loads (only EMD layer reloads, not source)
  = ~22,500 tokens in documentation

Documentation reduction: 5.4x
Overall session cost reduction: ~50–65%
```

### Combined with memory layer

| Layer | Mechanism | Reduction |
|-------|-----------|-----------|
| EMD alone | Selective section loading | 3–7x docs |
| Memory layer alone | Vector compression | ~30x |
| EMD + Memory layer | Structural + vector | **10–20x docs** |

---

## [detail] Language Agnostic Usage

EMD is a text format. The spec is a document. Any language can implement a parser.

```
EMD Spec (github.com/everthink/emd/spec/EMD-SPEC.md)
        ↓ anyone implements
  emd (Rust)         ← reference implementation, crates.io
  emd-py (Python)    ← community implementation, PyPI
  emd-ts (TypeScript)← community implementation, npm
  emd-go (Go)        ← community implementation, pkg.go.dev
```

Non-Rust projects use EMD via:

| Method | How | Requirement |
|--------|-----|-------------|
| CLI binary | `emd check ./my-project` | download one binary |
| LSP server | any editor speaks LSP | download LSP binary |
| Native parser | implement spec in your language | community crate/package |
| Copy the format | write `.emd` files, read them yourself | nothing |

Same model as Prettier, ripgrep, ESLint — Rust binary, zero runtime, any project.

---

## [detail] The Rust Stack (`emd` crate)

### Repository

```
github.com/everthink/emd           ← standalone repo, NOT this IDE repo
```

### Architecture

```
raw .emd text
      ↓
Lexer (line scanner, regex-based, logos crate)
      ↓  tokens: SectionHeader, LinkArrow, CodeFence, Text, ...
Parser (builds EmdDocument AST, extends pulldown-cmark)
      ↓  typed sections + semantic link edges
Validator (resolves links, checks statuses, finds broken refs)
      ↓  validated document + Diagnostic list
Context Loader (selective section loading, token-budgeted)
      ↓  ContextSlice
Consumers:
   emd check CLI
   EMD runtime (executes [graph] + [agent] sections)
   Visual Interpreter (block-based editor)
   LSP server (hover, go-to-def, completion, diagnostics)
```

### Core AST Types

```rust
pub struct EmdDocument {
    pub sections: Vec<EmdSection>,
    pub metadata: DocumentMetadata,
    pub source_path: PathBuf,
}

pub struct EmdSection {
    pub kind: SectionType,
    pub status: Option<SectionStatus>,
    pub status_reason: Option<String>,
    pub title: String,
    pub level: u8,                    // H1=1 through H6=6
    pub links: Vec<EmdLink>,
    pub code_blocks: Vec<EmdCodeBlock>,
    pub body: String,
    pub children: Vec<EmdSection>,
    pub span: SourceSpan,
}

pub struct EmdLink {
    pub relation: LinkRelation,
    pub target: LinkTarget,
    pub condition: Option<String>,
    pub span: SourceSpan,
}

pub enum SectionType {
    Summary, Detail, Task, Decision, Api, Spec,
    Agent, Human, Verify, Config, Graph,
    Draw, Flow, Kanban,
    Example, Template,
}

pub enum SectionStatus {
    Done,
    Pending,
    InProgress,
    Blocked(String),   // reason required
    Archived,
    Cancelled,
}

pub enum LinkRelation {
    // Dependency
    Depends, Implements, TestedBy, Supersedes,
    CompatibleWith, AlternativeTo, Extends,
    // API
    Param, Returns, Errors,
    // Agent
    Node, Edge, Entry, Model, Tools, Memory, Context, Persona,
    // Memory
    StoreIn, RecallFrom, CompressAfter,
    // Escape hatch
    Custom(String),
}
```

### Context Loader API

```rust
pub struct ContextLoader {
    pub token_budget: usize,
    pub index: EmdIndex,     // pre-built index of all .emd files in project
}

impl ContextLoader {
    pub fn load_summaries(&self) -> ContextSlice;
    pub fn load_by_type(&self, kind: SectionType) -> ContextSlice;
    pub fn load_by_status(&self, status: SectionStatus) -> ContextSlice;
    pub fn load_for_task(&self, task: &str) -> ContextSlice;
    pub fn resolve_context(&self, entry: &EmdSection) -> ContextSlice;
    pub fn load_within_budget(&self, priority: LoadPriority) -> ContextSlice;
}
```

### Rust crates used

| Crate | Purpose |
|-------|---------|
| `pulldown-cmark` | Base Markdown parser (EMD extends it) |
| `logos` | Lexer generator for EMD-specific tokens |
| `regex` | Pattern matching for link/section syntax |
| `serde` + `serde_json` | Serialize AST for LSP protocol |
| `tower-lsp` | LSP server framework |
| `tiktoken-rs` | Token counting for context budget |
| `walkdir` | Traverse project to build EmdIndex |
| `thiserror` | Error types |
| `miette` | Rich user-facing error reporting |

---

## [decision] Separate Repository

EMD lives in its own standalone repository.

Reasons:
1. **EMD spec is language-agnostic** — community implementations in Python, Go, TS
2. **`emd` crate publishes independently** — own semver, own release cycle on crates.io
3. **LSP server is its own binary** — editors download only the LSP
4. **Community adoption** — contributors improve EMD without understanding the interpreter
5. **Signals "open standard"** — not tied to any specific editor

The Visual Interpreter consumes EMD as a dependency:
```toml
[dependencies]
emd = { version = "0.1", features = ["context-loader", "validator"] }
```

---

## [summary] Integration with the Visual Interpreter

| Interpreter Feature | How it uses EMD |
|--------------------|----------------|
| Block-based editor | `[task]`, `[code]`, `[draw]`, `[table]` etc. sections → interactive blocks |
| File tabs | Each `.emd` file → one editor tab |
| AI inline (explain/replace) | Selected text + current section context → LLM call |
| AI chat panel | Current file + workspace context from `[summary]` sections → chat |
| Agent runner | Reads `[agent]` + `[graph]` sections → spawns agents, shows dashboard |
| Breadcrumbs | File path + section hierarchy from `[type]` headers |
| Graph visualization | `→` links across files → interactive knowledge graph |
| Task checklist | `[todo]` code blocks → checkable interactive list |
| Kanban board | `[kanban]` section → auto-generated from `→ depends` links to `[task]` sections |

---

## [summary] What EMD Replaces

| Replaced | With |
|----------|------|
| OpenAI function calling JSON schema | `[api]` sections (auto-generated) |
| LangChain/CrewAI agent YAML | `[agent]` sections |
| LangGraph/n8n workflow JSON | `[graph]` sections |
| AGENTS.md monolith | Distributed `[summary]` sections per feature |
| Separate prompt template files | `[template]` sections |
| Obsidian/Roam connections board | Native `→` typed link graph |
| SQLite for structured knowledge | EMD files (F17) |
| Separate config files | `[config]` sections |
