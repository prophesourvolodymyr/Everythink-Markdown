# Feature: EMD Core — Context Loader

<!-- STATUS: designed -->
<!-- DEPENDS_ON: parser, validator -->
<!-- PARENT: emd-core -->

## What This Is

The ContextLoader is the component that makes EMD's 5-10x token savings real. It takes a token budget, an `EmdIndex` of all `.emd` files in the project, and a query, and returns the minimal set of sections needed to answer that query — under the token budget. It walks the typed link graph, reads only statuses (not full body content) from linked sections, and assembles a `ContextSlice` that an AI agent or human can use as their working context.

The ContextLoader is the answer to the question posed in the original EMD vision: "is feature-a ready to ship?" Without context loading, answering that question requires loading 4 files and ~2300 tokens. With context loading, the same answer requires 180 tokens. The ContextLoader traverses the graph, checks statuses, and derives the conclusion — the AI doesn't need to read the files.

## Why It Matters

Every AI agent working on an EMD project uses the ContextLoader to understand what's happening without burning thousands of tokens on irrelevant content. Every `[summary]` section loaded by default. Every `[task]` section filtered by status. Every `→ depends:` link followed to check if dependencies are satisfied. The ContextLoader is the difference between EMD being "cool format" and "transformative infrastructure."

For the Visual Interpreter's AI features, the ContextLoader provides the context for chat messages, inline AI popups, and agent runner pre-flight checks. Without it, the AI chat panel would load entire DOCS files and burn tokens pointlessly.

## How It Works

The ContextLoader maintains an internal token counter (using `tiktoken-rs` for accurate OpenAI/Anthropic tokenization). It starts with an empty ContextSlice and a budget.

**Loading strategy by priority**:

Priority 1 (always load): The sections directly matching the query. If querying for "build cache layer", the `[task|pending] Build cache layer` section is loaded first.

Priority 2 (traverse links): Walk `→ depends:`, `→ implements:`, `→ tested-by:` links. But only load the STATUS of each linked section (not the body). The status alone tells you if it's done, pending, or blocked. This is where the massive token savings come from — you get the answer without the content.

Priority 3 (load summaries): For sections whose status is ambiguous or relevant, load their `[summary]` (not full `[detail]`). Summaries are designed to be ~50-100 tokens — the minimum needed to understand what a section does.

Priority 4 (load details, budget permitting): If token budget remains, load `[detail]` sections that are directly relevant. This is rarest — the point of EMD is to avoid loading details.

**Filtering rules**:

- `[summary]` sections: always eligible for loading. Designed to be safe and concise.
- `[detail]` sections: loaded only when explicitly queried or budget permits.
- `[task]` sections: loaded when status matches query (e.g., "all pending tasks").
- `[human]` sections: always loaded. Human-in-the-loop checkpoints must never be hidden.
- `[config]` sections: loaded at startup, cached for session.
- `[agent]` sections: loaded when spawning agents or when queried.
- `[graph]` sections: loaded when executing graphs or when queried.
- `[draw]`, `[flow]`, `[kanban]`: never loaded in context (visual data has no token value for LLMs).

**Token budget enforcement**: The ContextLoader stops loading when the budget is exhausted. It returns partial results with a warning that the context was truncated. The consumer (AI agent, chat panel) can decide to increase the budget or work with partial context.

## Original User Notes

From the ORIGINAL IDEA: the token savings analysis was a core part of the EMD pitch. The user demonstrated:
- Project orientation: 1500 tokens → 200 tokens (87% reduction)
- Current task context: 800 tokens → 150 tokens (81% reduction)
- API contracts: 2400 tokens → 1000 tokens (58% reduction)
- Workflow definitions: 2000 tokens → 400 tokens (80% reduction)
- Feature dependencies: 3000 tokens → 200 tokens (93% reduction)

The ContextLoader is the engine behind every one of these reductions.

## API Methods

The ContextLoader exposes a query API, not a file-loading API:

- `load_summaries()` — Returns all `[summary]` sections in the project. This is the project orientation context. Typically 200-500 tokens for a 10-feature project. The user opens a chat and the AI immediately understands what the project is about.

- `load_by_type(kind)` — Returns all sections of a given type. Used by the CLI `emd query "tasks"` command and by the kanban board to populate columns.

- `load_by_status(status)` — Returns all sections with a given status. Used by the kanban board and task list. "Show me everything blocked."

- `load_for_task(task_name)` — The most important method. Given a task name, loads the task section, walks its `→ depends:` links, checks statuses, and returns a context that answers "is this task ready to work on?" In 180 tokens instead of 2300.

- `resolve_context(entry)` — Given a starting section, walks all links, loads relevant summaries and statuses, and returns the complete context for that section. Used by the AI chat panel when the user asks about a specific section.

- `load_within_budget(priority)` — Loads as much as the budget allows, ordered by the given priority strategy (by status, by recency, by relevance to current task).

## Token Budgeting

The default budget is 8000 tokens (matching GPT-4's default context window). This is configurable per query. The ContextLoader tracks:
- Tokens consumed so far
- Tokens remaining
- Which sections were loaded (token count per section)
- Which sections were skipped (due to budget or filtering)
- A timestamp of the load (for cache invalidation)

Budget enforcement is strict: never exceed the budget by more than 5%. The 5% slack allows finishing a section that was started near the budget limit rather than returning a half-loaded section.

## Caching

The ContextLoader caches context slices per query signature. If the same query is made twice without file changes, the cached result is returned. The cache is invalidated when:
- Any `.emd` file in the project changes (based on file modification timestamps or file watcher events)
- The token budget changes
- The loading priority changes

This is critical for the interpreter's AI chat panel — the user might ask follow-up questions about the same section without file changes. Caching prevents re-loading on every message.

## Performance

Context loading for a 10-feature project should complete in under 1ms (after the EmdIndex is built). The graph walk is the most expensive operation, but section statuses are indexed for O(1) lookup. Token counting via tiktoken-rs adds overhead but is necessary for accurate budgeting.

## Integration With Other Features

**Parser + Validator**: The ContextLoader requires a validated AST and a resolved link graph. If validation hasn't run, the loader runs it implicitly on first query.

**CLI Toolchain**: `emd query "tasks|pending"` uses load_by_type + load_by_status internally. The CLI outputs the result as JSON.

**Visual Interpreter**: The AI chat panel calls load_for_task() and resolve_context() to build context for LLM calls. The context is included in the system prompt automatically.

**Graph Executor**: Before spawning agents, the executor calls load_for_task() to verify the task is unblocked and all dependencies are satisfied.

**TypeScript Compiler**: The TS compiler implements the same ContextLoader logic in TypeScript for environments without WASM.

## Known Limitations

- Token counting uses tiktoken-rs which matches OpenAI's tokenizer exactly but may differ slightly from Anthropic's
- Cache invalidation is file-level, not section-level — changing one section invalidates the full file's cache entries
- Graph walk depth is limited to 100 hops to prevent infinite loops
- Large workspaces (1000+ files) may exceed the index memory budget; V2 will add on-disk index

## V2 Plans

- Section-level cache invalidation for more granular caching
- On-disk EmdIndex for large workspaces (memory-mapped)
- Semantic search: find sections by meaning, not just by type/status/title (requires embeddings)
- Custom priority strategies via plugin API
- Streaming context: return initial results while loading deeper links
