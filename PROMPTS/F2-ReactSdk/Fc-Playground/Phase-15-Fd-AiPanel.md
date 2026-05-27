# Phase 15 of Fd-AiPanel — AI Chat Panel

## Context
Phase 14 (Fc-Playground) is COMPLETE. The React SDK has a full Vite dev playground at `sdk/react-emd/playground/` with:
- Fc1-DevApp: workspace shell with file explorer, tab bar, EmdEditor integration, inspector panel (theme + feature toggles), console panel
- Fc2-SampleFiles: 12 curated .emd files (all-types, links, code-blocks, nested, tasks, decisions, api-spec, bug-tracker, project, malformed, large, transclusion)
- Fc3-BlockTester: isolated block rendering tool with section selector, raw EMD input, decoration toggle grid, performance meter, overlay mode

The playground runs via `npm run dev` and imports `@everthink/react-emd` via Vite alias (not from dist/), so HMR works across all SDK source files. 218 tests pass, build succeeds.

Fd-AiPanel is the final sub-feature of the React SDK. It adds an AI chat panel to the EmdEditor experience — a sidebar or overlay where users can chat with an LLM, get context-aware responses, and apply AI-generated content directly into the editor.

**The task:** Build the AiPanel React component with chat UI, context bridge, streaming support, and an apply/inline mechanism. Integrate it into the playground as a toggleable panel.

## What you need to read first

| File | Why |
|------|-----|
| `features/F2-ReactSdk/Fd-AiPanel/DOCS.md` | Full spec: chat UI, context bridge, streaming, apply |
| `features/F2-ReactSdk/Fd-AiPanel/TODO.md` | Task checklist |
| `sdk/react-emd/src/editor.ts` | `EmdEditor`, `EmdEditorProps`, `EmdEditorRef` — the editor the AI panel interacts with |
| `sdk/react-emd/src/index.ts` | All exports — what the AiPanel imports |
| `sdk/react-emd/src/live-md/types.ts` | `LiveMdConfig` — theme integration |
| `sdk/react-emd/playground/App.tsx` | DevApp structure — where the AiPanel gets integrated |
| `sdk/react-emd/playground/App.css` | DevApp styles — styling for AiPanel |
| `CYCLES.md` (Phase 5) | Understand where this fits |

## Codebase learnings

**SDK structure:** `sdk/react-emd/src/` contains the library code. `sdk/react-emd/playground/` contains the dev app (not published). The AiPanel component should live in `sdk/react-emd/src/ai-panel.ts` (or similar path within src/) so it's exported from the SDK. The playground integration can live in `playground/ai-panel-integration.tsx` or inline in App.tsx.

**EmdEditor interface:** The editor exposes `EmdEditorRef` with `getContent()`, `setContent(content)`, `getEditorView()`. The ai-panel needs read access to the current editor content and write access to insert/apply AI-generated text.

**Playground architecture:** The App.tsx uses `createElement` (not JSX), uses `@everthink/react-emd` imports (aliased to `src/index.ts`), manages tabs state, feature toggles state, and console logs. The inspector panel on the right sidebar has feature toggles. The AiPanel can be added as another toggleable panel.

**Theme system:** Three themes (light, dark, high-contrast). Theme applied via `config.theme` on EmdEditor and CSS variables. AiPanel should respect the current theme.

**No framework:** The entire project avoids React/Vue frameworks for UI patterns. AiPanel uses plain React patterns with `createElement` or JSX.

**EMD context:** The editor contents are EMD-structured. The AI context bridge should be aware of section types, statuses, and links. The `@everthink/emd` WASM package provides `parse()` for extracting structured context.

## What to build

### Fd-AiPanel — AI Chat Panel Component

Create `sdk/react-emd/src/ai-panel.ts` with:

1. **`AiPanel` React component:**
   - Props:
     - `editorRef: React.RefObject<EmdEditorRef>` — reference to the editor for read/write
     - `theme: ThemeMode` — current theme for styling
     - `className?: string`
     - `isOpen: boolean`
     - `onToggle: () => void`
     - `llmConfig: LlmConfig` — provider, API key, model, endpoint
   - State: messages array, input value, streaming state, loading state
   - Renders as a resizable panel (default width: 350px, draggable resize handle)

2. **Chat UI:**
   - Scrollable message list with user messages (right-aligned) and AI messages (left-aligned)
   - Each message shows a role avatar (👤/🤖), timestamp, and content
   - AI messages render markdown content
   - Typing indicator (...) while streaming
   - Input box at bottom with textarea + send button + stop button (during streaming)
   - Keyboard: Enter to send, Shift+Enter for newline, Escape to close panel
   - Empty state: "Ask me about your EMD document" with suggested prompts

3. **Context Bridge (`buildContext` function):**
   - Takes the current editor content string
   - Uses `@everthink/emd`'s `parse()` to extract structured context
   - Builds a system message with:
     - File summary (filename, section count, types present)
     - Active section context (the section where the cursor/selection is)
     - Recent content (last N characters around cursor)
   - Returns `{ systemMessage, contextSummary }` for injection into LLM calls

4. **LLM Provider abstraction:**
   - Interface: `LlmProvider` — `streamChat(messages, config): AsyncIterable<string>`
   - Implementations:
     - `OpenAiProvider` — uses fetch to POST /v1/chat/completions with SSE streaming
     - `AnthropicProvider` — uses fetch to POST /v1/messages with SSE streaming  
     - `MockProvider` — returns preset responses for testing (used when no API key)
   - `LlmConfig` type: `{ provider: 'openai' | 'anthropic' | 'mock', apiKey?: string, model: string, baseUrl?: string }`

5. **Streaming support:**
   - `useStreamingChat` hook:
     - Sends messages to LLM, receives stream
     - Updates the last AI message incrementally as chunks arrive
     - Handles abort (stop button)
     - Handles errors (show error message, allow retry)
   - Parse SSE or streaming JSON chunks

6. **Apply Mechanism:**
   - Each AI message that contains code blocks or content suggestions has action buttons:
     - "Apply" — replaces the current selection or appends at cursor position
     - "Insert Below" — inserts after the current section
     - "Replace Section" — replaces the entire current section
     - "Copy" — copies to clipboard
   - Inline apply: code blocks rendered individually with per-block apply buttons
   - Apply uses `editorRef.current.setContent()` or direct editor view manipulation

7. **Suggested Prompts:**
   - Context-aware: "Summarize this document", "List all tasks", "Explain this decision"
   - General: "Write a spec for...", "Create a task list for..."
   - One-click: clicking a suggested prompt populates the input and sends

8. **Settings (gear icon in panel header):**
   - Provider selector (OpenAI / Anthropic / Mock)
   - API key input (masked, stored in localStorage)
   - Model selector (gpt-4o, claude-sonnet-4-20250514, etc.)
   - Temperature slider
   - Max tokens input
   - System prompt override textarea

9. **Chat History:**
   - Sessions stored in localStorage: `{ id, timestamp, messages, title }`
   - Session list in a sidebar (collapsed by default)
   - New session button
   - Delete session button

### Playground Integration

Add to `playground/App.tsx`:

1. **AiPanel toggle button** in the toolbar:
   - Shows/hides the AiPanel
   - Indicates active/streaming state with a pulse animation

2. **AiPanel rendering** in the main area:
   - Positioned to the right of the editor (between editor and inspector, or replacing inspector when open)
   - Slide-in animation from the right
   - Resize handle to adjust width (300px – 600px)

3. **LLM config state** in App:
   - Provider, API key, model — initialized from localStorage
   - Settings panel accessible from within AiPanel

4. **EditorRef forwarding:**
   - Pass `editorRef` from App to AiPanel for read/write access
   - AiPanel uses `editorRef.current.getContent()` for context
   - AiPanel uses `editorRef.current.setContent()` for apply operations

### Exports from SDK

Update `sdk/react-emd/src/index.ts` to export:
- `AiPanel` component
- `AiPanelProps` type
- `LlmConfig` type
- `LlmProvider` interface
- `OpenAiProvider` class
- `AnthropicProvider` class
- `MockProvider` class
- `useStreamingChat` hook
- `buildContext` function

### Styling

Create `sdk/react-emd/src/ai-panel.css`:
- Dark panel background matching playground theme (#1e1e2e)
- User messages: right-aligned, blue bubble (#4f46e5)
- AI messages: left-aligned, dark bubble (#2d2d3f)
- Streaming cursor: blinking dot
- Resize handle: subtle line with hover indicator
- Code blocks in messages: dark background, syntax-highlighted
- Apply buttons: green (#22c55e), compact
- Use CSS variables for theming: `--emd-ai-bg`, `--emd-ai-user-bubble`, `--emd-ai-bot-bubble`, etc.

## Files to create/modify

| File | Action |
|------|--------|
| `sdk/react-emd/src/ai-panel.ts` | CREATE — AiPanel component, context bridge, LLM hook |
| `sdk/react-emd/src/ai-panel.css` | CREATE — AiPanel styles |
| `sdk/react-emd/src/llm-providers.ts` | CREATE — OpenAI, Anthropic, Mock providers |
| `sdk/react-emd/src/use-streaming-chat.ts` | CREATE — streaming chat hook |
| `sdk/react-emd/src/build-context.ts` | CREATE — EMD context extraction for LLM |
| `sdk/react-emd/playground/App.tsx` | MODIFY — add AiPanel toggle, state, rendering |
| `sdk/react-emd/src/index.ts` | MODIFY — export new AiPanel APIs |

## Verification

```bash
cd sdk/react-emd
npx tsc --noEmit     # Zero errors
npx tsc --noEmit -p playground/tsconfig.json     # Zero errors
npm test             # All existing tests pass (218+ tests)
npm run build        # Library build succeeds
npm run dev          # Playground loads, AiPanel toggle works, chat with mock provider works
```

Note: Mock provider should work without API key. Manual testing: open playground, open a sample file, toggle AiPanel, send a prompt, see mock response, verify context bridge extracts sections, verify apply button inserts text into editor.

## When you finish

1. Mark all tasks `[x]` in `features/F2-ReactSdk/Fd-AiPanel/TODO.md`
2. Update `features/F2-ReactSdk/Fd-AiPanel/DOCS.md` with implementation notes
3. Update `CYCLES.md` — mark Phase 5 task 4 (Fd-AiPanel) as `[x]`
4. Run `npx tsc --noEmit`, `npm test`, and `npm run build` — all must pass
5. **Commit everything**
6. Update Phase 5 checkpoint status
