# Feature: EMD Core — Graph Executor (emd-graph)

<!-- STATUS: designed -->
<!-- DEPENDS_ON: parser, validator, context-loader -->
<!-- PARENT: emd-core -->

## What This Is

The `emd-graph` crate — the runtime that reads `[agent]` and `[graph]` sections from `.emd` files and executes them as live AI agent workflows. It spawns ReActAgents and ToolAgents, routes their output according to edge conditions in the graph topology, and writes results back to the source `.emd` files (e.g., changing `[task|pending]` to `[task|done]`).

The graph executor is a separate crate from `emd` because it pulls in heavy dependencies: HTTP clients for LLM API calls, `tokio` for async execution, and provider-specific SDKs. The `emd` crate is a pure parser library with zero network dependencies. The `emd-graph` crate is an application runtime. Different consumers, different crates.

## Why It Matters

This is what makes EMD files "executable." Without the graph executor, `[agent]` and `[graph]` sections are just documentation. With the graph executor, they are a fully autonomous AI system defined in a single `.emd` file. The user writes the workflow in markdown, hits "Run" in the interpreter, and the agents execute.

This is also the feature that most clearly demonstrates EMD's value proposition over LangGraph, CrewAI, n8n, and AutoGen: a single markdown file that is both human-readable documentation AND executable workflow. No Python scripts. No JSON blobs. No separate config files. The file IS the system.

## Original User Notes

From the ORIGINAL IDEA: "EMD [graph] + [agent] sections are not documentation about a workflow. They ARE the workflow definition. Like HTML and a browser: HTML describes a page. The browser renders it. EMD describes an agent system. The runtime executes it."

The user's example workflow — autonomous-build.emd with Planner, Executor, and Verifier agents — demonstrated a 3-agent build loop that reads tasks from CYCLES.emd, writes code, runs cargo build, loops on failure, and marks tasks done on success. This is the canonical use case.

## Architecture

### Agent Types

**ReActAgent**: The standard ReAct (Reasoning + Acting) agent. Given a task, it reasons about what to do, calls tools to gather information or take actions, observes the results, and reasons again. The loop continues until the agent determines the task is complete or hits iteration limits. Used for: Planner, Verifier, Code Reviewer — any agent that needs to think and act iteratively.

**ToolAgent**: A single-pass agent that receives a task and calls tools to complete it, then returns results. No iterative reasoning — just execute and return. Used for: Executor — receives a plan from Planner and executes it directly.

The user's original design specified both types. The graph executor implements both.

### Graph Topology

A `[graph]` section defines:
- **Nodes**: Named agents (ReActAgent or ToolAgent) with their configurations from `[agent]` sections
- **Edges**: Directed connections between nodes with conditions. `Planner → Executor [condition: has_plan]` means the edge is followed only when the Planner produces a plan
- **Entry point**: The first node to execute
- **END**: A virtual node representing successful completion
- **Constraints**: `max-iterations` (global loop limit) and `timeout` (wall clock limit)

### Execution Model

The graph executor spawns agents sequentially (not in parallel in V1). The flow:
1. Parse the `[graph]` section to extract nodes, edges, and conditions
2. Load agent configurations from `[agent]` sections referenced by the graph
3. Start at the entry node
4. Run the agent (ReAct loop or ToolAgent single-pass)
5. Evaluate outgoing edge conditions against the agent's output
6. Follow the first matching edge to the next node
7. Repeat until END or iteration limit / timeout
8. Write results back to the source `.emd` file

### Tool System

Agents call tools defined in the `→ tools:` link. Tools are functions the agent can invoke: `read_file`, `write_file`, `search_code`, `bash`, `git_commit`, etc. The tool definitions come from `[api]` sections in the project.

The graph executor maintains a tool registry. When an agent requests a tool call, the executor invokes the tool, captures the output, and returns it to the agent. Tool calls are synchronous within a single agent step — the agent calls a tool, the executor runs it, the agent receives the result.

### Writing Results Back

This is the self-updating mechanism from the original EMD vision. When the graph execution completes successfully:
- `[task|pending]` sections the agent worked on become `[task|done]`
- New sections the agent created (code, docs, tests) are appended to the file
- The agent's summary is appended to a `[summary]` section

On failure:
- The task remains `[task|pending]` or is updated to `[task|blocked: reason]`
- Error details are appended as a `[detail]` section for debugging

All writes go through the storage adapter, so the mechanism works identically on desktop (native fs) and web (OPFS).

## LLM Provider Integration

V1 supports OpenAI (GPT-4o, GPT-4o-mini, o1) and Anthropic (Claude Sonnet 4, Claude Opus 4). The provider interface is pluggable — community crates can add more providers.

API keys are read from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) or from the OS keychain (via Tauri for desktop). Keys are NEVER stored in `.emd` files.

## Safety Constraints

The graph executor enforces safety boundaries:
- Max iterations: the graph cannot loop more than the specified limit (prevents infinite agent loops)
- Timeout: the graph cannot run longer than the timeout (prevents runaway costs)
- Confirmation: by default, the executor requires human confirmation before writing files. This can be overridden with `→ auto-write: true` in the graph or `→ require-approval: false`.
- Pre-flight validation: the validator runs before execution. If the graph has errors (broken edges, missing nodes), execution is refused.
- Token budget: each agent has a per-invocation token limit. The executor tracks cumulative tokens.

## Integration With Other Features

**Parser**: The executor parses `[agent]` and `[graph]` sections from the AST.
**Validator**: Pre-flight validation ensures the graph is valid before execution.
**Context Loader**: Before spawning agents, the executor uses the context loader to verify task readiness.
**Visual Interpreter**: The interpreter's "Run" button triggers the executor. The terminal panel shows streaming output.
**CLI Toolchain**: Future `emd run` command will execute graphs from the CLI.

## Known Limitations

- Sequential agent execution only in V1 (no parallel agents)
- No sub-graphs or nested graphs (one graph per section)
- No dynamic edges (edge conditions are static, evaluated on agent output)
- No agent memory persistence between graph runs (each execution is stateless)
- LLM providers limited to OpenAI and Anthropic in V1

## V2 Plans

- Parallel agent execution: independent graph branches run concurrently
- Sub-graphs: a graph node can reference another `[graph]` section
- Dynamic edge routing: edge conditions can be LLM-evaluated ("is this output ready for review?")
- Agent memory persistence: agents remember previous runs via EMD `[detail]` sections
- Human-in-the-loop pauses: graph pauses at `[human]` nodes, waits for approval
- Provider plugin API: community crates add LLM providers (Ollama, Groq, Gemini)
