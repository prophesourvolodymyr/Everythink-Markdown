# Fd1-ChatUi — AI Chat Interface Component

The React component that renders the chat conversation interface within the AI panel sidebar. It displays a scrollable message list, a text input area, a model selector, a token counter, and a cancel button. It is the visible surface of the Fd-AiPanel sub-feature — the user sees Fd1-ChatUi, but Fd2-ContextBridge and Fd3-Streaming do the invisible work behind it.

The message list renders each message as a distinct card. User messages are aligned to the right with a subtle background color derived from the theme's accent. AI messages are aligned to the left with a model badge (small pill showing "GPT-4o" or "Claude Sonnet 4") and a timestamp. System messages (context loaded, token budget warnings, errors) appear as centered muted text without a card background.

AI messages support markdown rendering: bold, italic, inline code, code blocks with syntax highlighting, lists, and links. Code blocks within AI messages receive a copy button and, when the content appears to be a proposed edit to the current document, an Apply button. The Apply button extracts the code block content and passes it to Fd4-ApplyEdit for diff computation and preview.

The message list auto-scrolls to the bottom when new messages arrive, but if the user has manually scrolled up to read earlier messages, auto-scroll is suppressed. A "scroll to bottom" floating button appears when the user is scrolled up and new content arrives.

The input area at the bottom is a textarea that auto-resizes to fit its content up to a maximum height of six lines. Enter sends the message; Shift+Enter inserts a newline. A paperclip button allows attaching file context (not implemented in v1). The send button is disabled when the input is empty or when a response is currently streaming.

The header area contains a model selector dropdown listing available LLM providers and their models. The dropdown groups models by provider. Each model shows its name, context window size, and a brief description. The selected model is persisted to localStorage. Next to the model selector, a token counter shows current token usage out of the budget (e.g., "1,240 / 8,192"). The counter updates in real time as context is gathered and as the conversation grows.

The cancel button appears during streaming, replacing the send button. Clicking it closes the stream connection. The partially received content remains in the chat. The user can continue the conversation or retry.

The chat history is persisted to a file in the workspace's `.emdenv/` directory. On reload, the conversation is restored. The history file uses a simple JSON format with message role, content, timestamp, and model.
