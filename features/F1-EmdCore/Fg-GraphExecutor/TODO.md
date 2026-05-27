# Graph Executor — TODO

<!-- STATUS: done -->

## Core Execution
- [x] Parse [agent] sections into AgentConfig structs
- [x] Parse [graph] sections into GraphTopology (nodes, edges, conditions, constraints)
- [x] ReActAgent implementation (reason → act → observe loop)
- [x] ToolAgent implementation (single-pass execute)
- [x] Sequential node execution with edge condition routing
- [x] Entry node → follow edges → END or limit/timeout

## LLM Providers
- [x] LLMProvider trait (chat, stream_chat, list_models)
- [x] OpenAI implementation (GPT-4o, GPT-4o-mini, o1)
- [x] Anthropic implementation (Claude Sonnet 4, Opus 4)
- [x] API key from env var or OS keychain
- [x] Streaming response support

## Tool System
- [x] ToolRegistry with tool registration
- [x] Tool invocation: agent requests tool → executor runs → returns result
- [x] Built-in tools: read_file, write_file, search_code, bash, git_commit
- [x] Tool definitions from [api] sections
- [x] Tool sandboxing: write within project boundaries only

## Result Writing
- [x] Write task status updates back to .emd file
- [x] Append new sections (code, docs, tests) to file
- [x] Error logging on failure
- [x] Confirm before writing (configurable)

## Safety
- [x] Max iterations enforcement
- [x] Timeout enforcement
- [x] Human confirmation before writes (default)
- [x] Pre-flight graph validation (validator integration)
- [x] Token budget per agent invocation
- [x] Cumulative token tracking across graph execution

## Execution Output
- [x] Streaming text output for terminal panel
- [x] Structured execution log (node, tool calls, tokens, status)
- [x] Progress events for interpreter dashboard
- [x] Error context with retry option

## Testing
- [x] ReActAgent completes a simple task end-to-end
- [x] Graph executor runs 3-node workflow successfully
- [x] Edge conditions route correctly
- [x] Max iterations stops loop at limit
- [x] Timeout kills long-running execution
- [x] Writes results back to .emd file correctly
- [x] Pre-flight validation catches broken graph
