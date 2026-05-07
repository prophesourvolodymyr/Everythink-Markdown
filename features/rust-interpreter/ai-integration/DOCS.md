# Feature: Rust Interpreter — AI Integration

<!-- STATUS: designed -->
<!-- DEPENDS_ON: emd-core, block-engine -->
<!-- PARENT: rust-interpreter -->

## What This Is

Three AI modes woven into the interpreter: a floating highlight menu ("rocket launcher"), an inline AI popup for quick explain/replace/rewrite actions, a context-aware chat panel, and the agent runner that executes `[agent]` + `[graph]` sections. Plus proactive AI suggestions that appear when the user opens relevant EMD sections.

The AI integration is what transforms the interpreter from "markdown editor" to "AI-augmented system dashboard." The highlight menu makes AI feel native to text editing — not a separate chatbot tab. The chat panel carries full EMD context: the current file's `[summary]`, focused section, and `→` dependency graph. The agent runner makes `[agent]` and `[graph]` sections executable with a single "Run" button.

## Original User Notes

From the mockup: "When you highlight the text, 4 options will appear: Replace, Chat, T1, T2." The user later clarified T1/T2 are formatting actions (H1, H2, H3, etc.), not AI actions. The mockup also showed an AI explanation popup below selected text and an arrow icon that sends the conversation to the main chat panel.

The user confirmed: "Inline AI + chat panel + agent runner" as the three AI modes. Chat panel is a side panel that pops out. Agent runner shows terminal output in a bottom panel. Proactive suggestions appear on relevant sections.

## Three AI Modes

### 1. Highlight Menu ("Rocket Launcher")

Appears 50ms after text selection ends (not during selection drag). Positioned above selected text, centered. Three rows:

**Row 1 — Formatting**: H1, H2, H3, Bold (B), Italic (I), Inline Code (<>), Link (🔗). All standard markdown actions — no AI required.

**Row 2 — Turn Into EMD Section**: Task, Decision, API, Code, Table, Mermaid, Draw. Dropdown for additional types: Spec, Agent, Verify, Config, Graph, Kanban, Flow. Wraps selected text in the appropriate EMD section syntax.

**Row 3 — AI Actions**: ✦ Replace (rewrites highlighted text), ⚡ Chat (explains/answers about highlighted text, shows popup below).

**Customizable**: Settings → Highlight Menu → add/remove/reorder items per row. Custom T1/T2 actions: user-defined AI prompts with configurable model. Offline mode: AI actions grayed out if no provider configured. Cmd+K opens menu on current word without selection.

**Positioning**: shifts near viewport edges to stay visible. Fade in (100ms), slide up (4px). Dismisses on click outside, Escape, or after action taken.

### 2. Inline AI Popup

Appears below highlight menu when ⚡ Chat is clicked. Smooth height transition (200ms). Max 300px height, internal scroll.

Streams AI response word-by-word (typing effect). Shows the highlighted word in context within the prompt. User can edit the response inline. "Replace with AI response" button replaces highlighted text. Arrow button (↗) promotes the conversation to the main chat panel. Close button (✕) dismisses. Cancel button stops generation mid-stream.

The AI prompt includes: the selected text, the surrounding paragraph for context, the section type and title, relevant `→` links. The user's default model is used (configurable in settings).

### 3. AI Chat Panel

Side panel (right, toggle Cmd+Shift+C). Width: 400px, resizable via left edge drag handle. Full conversation with message history.

**Context awareness**: Every message includes the current file's `[summary]` sections and the focused section's data. User can @-mention files/sections: `@filename.emd#Section-Title` to add specific context. Token counter: "Context: 1,240 / 8,192 tokens" shows usage.

**Message UI**: User messages right-aligned, theme-colored bubble. AI messages left-aligned, neutral bubble with model badge. Code blocks in AI responses have syntax highlighting, copy button, and "Apply" button (inserts into current file). Loading: three-dot pulse animation. Scroll to bottom with indicator button if user scrolled up.

**Model selector**: Dropdown at top of panel. Shows available models from configured providers (OpenAI: GPT-4o, GPT-4o-mini, o1. Anthropic: Claude Sonnet 4, Claude Opus 4). Provider setup in Settings → AI.

**Chat history**: Saved per workspace in `.emdenv/chat-history.emd` using standard EMD `[chat]` sections. Survives app restart. "Clear chat" button to start fresh.

### 4. Agent Runner (V1 — Terminal Stream)

"Run" button appears on `[agent]` and `[graph]` sections (as a toolbar button or badge). Clicking it triggers the emd-graph executor.

**V1 UX**: Bottom panel (200px, resizable) opens. Terminal-green text on dark background, monospace font. Streams agent output line-by-line: which node is running, tool calls made, token usage per step, any errors. Color-coded: green for success, red for errors, yellow for warnings. Stop button cancels execution. On completion: the panel shows "Graph completed. 3 nodes executed. 2,450 tokens used. Results written to file."

**Writing results**: The executor writes back to the source `.emd` file (e.g., `[task|pending]` → `[task|done]`). The file tab shows a dirty indicator (●). User reviews and saves (Cmd+S) or accepts auto-save.

**V2 dashboard**: Visual timeline with expandable node cards. Active node highlighted. Per-node token usage, tool calls. Graph topology visualization.

### 5. Proactive AI Suggestions

Banner appears at the top of specific sections:
- `[task|pending]`: "Run agent to implement this task?" with Run and Dismiss buttons
- `[verify]`: "Run verification?" with Run and Dismiss buttons
- `[graph]`: "Execute this workflow?" with Run and Dismiss buttons
- Suggestions NEVER auto-execute. Always require explicit confirmation.
- Dismiss is permanent per section type (configurable in settings).

## LLM Provider Architecture

Provider-agnostic interface. Built-in: OpenAI, Anthropic. Community plugins add more (Ollama, Groq, Gemini via `registerLLMProvider()`).

API keys stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret). Never stored in `.emd` files, never committed to Git. The interpreter prompts for keys on first AI use if not found in keychain.

## Settings Panel — AI Section

- Default provider + model (dropdown, populated from registered providers)
- API key entry (masked, stored in keychain on save)
- Custom T1/T2 prompt templates
- Token budget per chat message
- Proactive suggestions: enable/disable per section type
- Per-provider parameters: temperature, max_tokens, top_p

## Integration

**Block Engine**: AI actions modify block content through BlockManager. Replace rewrites text. Apply inserts generated code. Chat adds context from block's section.

**EMD Core**: Chat panel uses ContextLoader for efficient token usage. Agent runner uses emd-graph executor. Parser + validator check agent-written content.

**Workspace**: Chat history saved to workspace. API keys scoped to workspace (or global).

**Distribution**: OpenAI + Anthropic bundled. Additional providers via npm plugins.

## Known Limitations

- V1 agent runner: terminal output only, no visual dashboard
- Chat context: limited to current file + @-mentions, no automatic workspace scan
- Proactive suggestions: simple banner, not contextually aware of cross-file dependencies
- No streaming in chat completion for OpenAI o1 models (reasoning models have different API)

## V2 Plans
- Visual agent runner dashboard with expandable node cards
- Chat context: automatic workspace scan for relevant sections
- Multi-modal chat: paste images, get visual analysis
- Agent memory persistence: agents remember previous runs
- Provider plugin API: community adds Ollama, Groq, Gemini
