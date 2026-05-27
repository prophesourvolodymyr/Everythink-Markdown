# Fd2-ContextBridge — Document Context Gathering for AI

The bridge between the editor's document state and the LLM's context window. Fd2-ContextBridge is responsible for gathering, formatting, and budgeting the document context that is sent to the LLM with every chat message. It answers the question: "what does the AI need to know about the document to provide useful responses?" and enforces the constraint: "how much context can fit in the token budget?"

## What Context Is Gathered

The context bridge collects information at multiple granularity levels, prioritizing by relevance to the current conversation.

The highest-priority context is the section the user is currently focused on. Its full text, type, status, title, and all child content are included unconditionally. If the focused section is a task with semantic links, the linked sections' statuses and titles are also included. If the focused section is inside a code block, the full code block content is included. The focused section represents what the user is most likely asking about.

The second-priority context is the current file's structure: a table of contents listing every section's type, status, title, and one-line summary. This gives the AI an overview of the document without consuming the token budget on full text. The table of contents is compact — typically 100-300 tokens for a moderately sized document.

The third-priority context is linked files. For every `→ depends:` link and `[[wiki-link]]` in the current file, the target file's summary section and section structure are loaded via F1-EmdCore's ContextLoader. This gives the AI awareness of the document's dependency graph. If the linked files are large, only their summaries and section titles are included, not full content.

The fourth-priority context is the project overview: the EmdIndex summary of all `.emd` files in the workspace, their top-level sections, and their statuses. This gives the AI project-wide awareness. The project overview is trimmed heavily to fit within remaining budget.

The context also includes the conversation history. Previous user messages, AI responses, and any applied edits are included in chronological order. The history is included after the document context so that recent conversation takes precedence over older context when the budget is tight.

## Token Budgeting

The token budget is configurable per LLM provider (default 8,192 for GPT-4o, 200,000 for Claude). The context bridge uses F1-EmdCore's tiktoken-rs integration for accurate token counting. Before sending any message, the bridge counts the tokens in the gathered context plus the conversation history plus the new user message. If the total exceeds the budget, it trims context in reverse priority order: project overview first, then linked file content, then document structure details, and finally — if absolutely necessary — older conversation history. The focused section and the most recent conversation turns are never trimmed.

The token counter is displayed in the chat UI as "N / budget" and updates as the user types their message. If the user's message alone exceeds the budget (unlikely but possible with very long pasted content), the input is restricted and a warning is shown.

## Context Formatting

The gathered context is formatted into a structured system prompt. The format includes explicit section markers that help the LLM understand the document structure:

The formatting is designed to be parseable by both the LLM (which uses semantic understanding) and by Fd4-ApplyEdit (which needs to locate specific sections by their identifiers). Section references in the AI's response can use these identifiers to specify which section an edit targets.

## Provider-Specific Optimizations

Different LLM providers benefit from different context formatting. OpenAI models perform better with XML-tagged context sections. Anthropic Claude models prefer a more conversational, markdown-structured format. The context bridge applies provider-specific formatting templates. Provider selection is automatic based on the active model, but the template can be overridden for custom providers.

## Caching

Context gathering is cached per document state fingerprint. The fingerprint includes the file content hash and the set of linked file content hashes. If the user sends a second message without modifying any file, the context is reused from cache without re-gathering from the ContextLoader. The cache is invalidated on any file change. This makes multi-turn conversations fast — only the first message in a turn incurs the context gathering cost.

## Security

Context sent to LLM providers may contain sensitive information. The context bridge supports a configurable sensitive data filter that redacts API keys, passwords, and personally identifiable information patterns from the gathered context before sending. The filter is regex-based and configurable. By default, environment variable patterns and common secret formats are redacted.
