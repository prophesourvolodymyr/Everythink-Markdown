# @everthink/react-emd — Complete Build Plan

What we are building: a single npm package that gives any React app a full EMD editor.
What the user types: `npm install @everthink/react-emd`
What they get: `<EmdEditor file="notes.emd" theme="dark" />` — full editing experience.

Each phase produces ONE file that adds a visual layer. After every phase, `npm run dev` shows the result.

---

## FILE STRUCTURE (what exists when done)

```
sdk/react-emd/
├── package.json              ✅ done
├── tsconfig.json             ✅ done
├── vite.config.ts            ✅ done
├── BUILD.md                  ← this file
│
├── src/
│   ├── index.ts              ← public: exports EmdEditor, EmdViewer, liveMarkdownPlugin
│   ├── editor.ts             ← <EmdEditor> component export (stub now, Phase 09)
│   ├── viewer.ts             ← <EmdViewer> component export (stub now, Phase 10)
│   │
│   ├── live-md/              ← Fa-LiveMd: the CM6 rendering engine (NO React)
│   │   ├── types.ts           ✅ done — LiveMdConfig, SyntaxHiderConfig types
│   │   ├── index.ts           ✅ done — liveMarkdownPlugin(config)
│   │   ├── view-plugin.ts     ◐ 82 lines — ViewPlugin skeleton, debounce, merge
│   │   ├── syntax-hider.ts    ◐ 78 lines — Fa1: hides ## ** * `` [] () via Decoration.replace
│   │   ├── text-styler.ts     ⬜ Phase 02 — Fa2: bold→700, italic→oblique, heading→size
│   │   ├── link-renderer.ts   ⬜ Phase 03 — Fa3: [[wiki]] & → links as clickable badges
│   │   ├── status-badge.ts    ⬜ Phase 04 — Fa4: ⏳ done ✅ in-progress 🚫 blocked
│   │   ├── type-badge.ts      ⬜ Phase 05 — Fa5: TASK DECISION API DRAW labels
│   │   ├── block-resolver.ts  ⬜ Phase 06 — Fa6: ```mermaid → diagram, ```draw → canvas
│   │   ├── inline-widgets.ts  ⬜ Phase 07 — Fa7: checkbox toggle, progress bar
│   │   ├── theme-engine.ts    ⬜ Phase 08 — Fa8: light/dark/high-contrast CSS vars
│   │   └── __tests__/
│   │       ├── syntax-hider.test.ts   ◐ 119 lines
│   │       └── view-plugin.test.ts    ◐ 114 lines
│   │
│   ├── components/           ← Fb-Components: React wrappers (consumes live-md)
│   │   ├── EmdEditor.tsx     ⬜ Phase 09 — full editor React component
│   │   ├── EmdViewer.tsx     ⬜ Phase 10 — read-only viewer (no CM6, no editing)
│   │   ├── EmdBlock.tsx      ⬜ Phase 11 — single section renderer
│   │   ├── hooks.ts          ⬜ Phase 12 — useEmdDocument, useEmdParser, useEmdSelection
│   │   ├── plugin-api.ts     ⬜ Phase 13 — registerBlockWidget(tag, Component)
│   │   └── __tests__/
│   │
│   ├── ai-panel/             ← Fd-AiPanel: AI chat sidebar
│   │   ├── ChatUi.tsx        ⬜ Phase 15 — message list, input, model selector
│   │   ├── ContextBridge.ts  ⬜ Phase 16 — gather doc context, token budget
│   │   ├── Streaming.ts      ⬜ Phase 17 — token-by-token response rendering
│   │   ├── ApplyEdit.tsx     ⬜ Phase 18 — diff preview + apply to doc
│   │   └── __tests__/
│   │
│   └── dev/                  ← Fc-Playground: NOT published, dev only
│       ├── index.html        ⬜ Phase 14 — simple Vite+React app loading SDK
│       ├── App.tsx           ⬜ Phase 14 — emulates a real consumer app
│       ├── sample-files/     ⬜ Phase 14 — one .emd per section type
│       │   ├── task.emd
│       │   ├── decision.emd
│       │   ├── canvas.emd
│       │   └── ...
│       └── block-tester.tsx  ⬜ Phase 14 — isolate one block, toggle decorations
```

---

## PHASES — What Gets Built, One After Another

Each phase = one agent prompt = one new file in `src/live-md/` or `src/components/` or `src/ai-panel/`.

---

### Phase 01 — Syntax Hider + Scaffold  ◐ IN PROGRESS

**File:** `src/live-md/syntax-hider.ts` (78 lines done)
**File:** `src/live-md/view-plugin.ts` (82 lines done)
**File:** `package.json`, `tsconfig.json`, `vite.config.ts` (done)

**What it does:** Hides markdown formatting characters so the editor looks like a document. `##` → invisible title prefix, `**` → invisible bold markers, `` ` `` → invisible code backticks, `[]()` → invisible link syntax, `- ` → invisible list marker, `> ` → invisible quote prefix. All hiding uses CodeMirror 6 `Decoration.replace({})` which collapses the range to zero width.

**What you see in the playground:** A single-page Vite app with a CodeMirror 6 editor. Type `## Hello **world**` — the `##` and `**` disappear visually but remain in the document. Click to edit and they reappear.

**Tests:** 6 (syntax-hider.test.ts + view-plugin.test.ts)

---

### Phase 02 — Text Styler  ⬜ NEXT

**File:** `src/live-md/text-styler.ts`

**What it does:** Styles the visible text. Bold text gets `font-weight: 700`. Italic gets `font-style: italic`. Headings get larger font sizes. Inline code gets monospace + gray background. Blockquotes get a left border. Horizontal rules become visual lines. All styles use CSS custom properties (`--emd-*`).

**What you see:** After Phase 01, the hidden characters are gone but all text looks the same. After Phase 02, headings look like headings (big, bold), bold text is bold, italic is slanted, code has a background color. The editor looks like a formatted document.

**Tests:** 4

---

### Phase 03 — Link Renderer  ⬜

**File:** `src/live-md/link-renderer.ts`

**What it does:** Links become interactive. `[[wiki-link]]` becomes clickable text that opens the target file. `→ depends: design.emd` becomes a colored badge ("depends" in amber) with the target next to it. Standard `[text](url)` links become underlined blue text. External links get a small icon. Hovering any link shows a popover with the target file's title and status.

**What you see:** All links in the document are styled and clickable. EMD semantic links show their relation type as colored badges. Wiki-links show file icons. Broken links (pointing to nonexistent files) show a red dashed underline.

**Tests:** 5

---

### Phase 04 — Status Badge  ⬜

**File:** `src/live-md/status-badge.ts`

**What it does:** Every section heading with a status annotation `|done`, `|in-progress`, `|blocked`, `|pending`, `|archived`, `|cancelled` gets a small colored dot or pill next to the heading. Done = green, In-progress = amber/yellow, Blocked = red, Pending = gray, Archived = gray strikethrough, Cancelled = gray italic. Clicking the badge cycles the status or opens a dropdown.

**What you see:** Section headings now have colored status indicators. The raw `|in-progress` text is hidden and replaced with a colored dot. Hovering shows the status name. Clicking changes it.

**Tests:** 3

---

### Phase 05 — Type Badge  ⬜

**File:** `src/live-md/type-badge.ts`

**What it does:** Every section heading with a type annotation `[task]`, `[decision]`, `[api]`, `[draw]`, etc. gets a small colored pill with the type name. Each of the 24 section types has a unique color. The raw `[task]` text is hidden and replaced with the pill. Right-clicking the badge opens a dropdown to convert the section to a different type.

**What you see:** Section headings now have colored type pills (TASK in amber, DECISION in teal, API in blue, DRAW in pink, etc.) plus the status dot next to them. The editor looks like a structured document with color-coded sections.

**Tests:** 4

---

### Phase 06 — Block Resolver  ⬜

**File:** `src/live-md/block-resolver.ts`

**What it does:** Code blocks with EMD tags get replaced by interactive widgets. ````mermaid` becomes a rendered diagram. ````draw` becomes a full drawing canvas. ````katex` becomes rendered math. ````html` becomes a sandboxed iframe. ````diff` becomes a side-by-side diff view. ````media` becomes a video/audio player. ````kanban` becomes an interactive board. External developers can register their own widget renderers via `registerBlockWidget(tag, Component)`.

**What you see:** The document now contains live, interactive components embedded between text sections. A Mermaid diagram renders as SVG with zoom/pan. A canvas block lets you draw. A kanban board has draggable cards. All widgets write changes back to the document text.

**Tests:** 6

---

### Phase 07 — Inline Widgets  ⬜

**File:** `src/live-md/inline-widgets.ts`

**What it does:** Small interactive elements inside the text flow. `- [ ]` checkboxes become clickable toggles that change the underlying `[ ]` to `[x]`. Task sections with checkboxes show a progress bar (e.g., "3 of 7 completed"). `[human]` sections get Approve/Reject buttons. Link hover shows a popover with the target section's info.

**What you see:** Checkboxes work — click them to toggle. Progress bars auto-update as you check items. Approval buttons appear on human checkpoint sections. Link popovers show target file summaries on hover.

**Tests:** 4

---

### Phase 08 — Theme Engine  ⬜

**File:** `src/live-md/theme-engine.ts`

**What it does:** Three themes (light, dark, high-contrast) defined as CSS custom properties. `theme="dark"` on `<EmdEditor>` swaps the container class from `.emd-theme-light` to `.emd-theme-dark` and all colors change instantly — no re-render, no decoration recompute. Custom themes can be registered by providing CSS variable overrides. The theme respects `prefers-color-scheme` for automatic dark mode.

**What you see:** Switch themes with a button or prop. Light mode: white background, dark text, blue accents. Dark mode: dark blue-gray background, light text, lighter blue accents. High-contrast: black background, white text, yellow accents. Everything updates instantly.

**Tests:** 3

---

### Phase 09 — EmdEditor React Component  ⬜

**File:** `src/components/EmdEditor.tsx`

**What it does:** The main `<EmdEditor>` component. Wraps CodeMirror 6 with all live-md extensions, adds a toolbar, handles file open/save, undo/redo, keyboard shortcuts, theme switching, and AI panel toggle. Props: `file`, `theme`, `readOnly`, `plugins`, `aiProvider`, `onSave`, `onChange`. Exposes an imperative ref: `focus()`, `getContent()`, `setContent()`, `undo()`, `redo()`.

**What you see:** The full editor as a React component. Drop it in any app. Toolbar at the top. Live preview in the editor area. Keyboard shortcuts work (Cmd+Z undo, Cmd+S save). The playground starts consuming it.

**Tests:** 5

---

### Phase 10 — EmdViewer Component  ⬜

**File:** `src/components/EmdViewer.tsx`

**What it does:** A read-only viewer. No CodeMirror, no editing, no keyboard handlers. Parses EMD source via WASM, walks the AST, renders React DOM elements directly. Much lighter than the editor (~60KB gzipped vs ~380KB). Props: `source`, `theme`. Used for documentation sites, blog posts, preview panes.

**What you see:** The same visual output as the editor but non-interactive. Type badges and status dots appear. Links are clickable but don't open tabs. Widgets are display-only (diagrams render, canvases show content, kanban boards are static).

**Tests:** 3

---

### Phase 11 — EmdBlock Component  ⬜

**File:** `src/components/EmdBlock.tsx`

**What it does:** Renders a single EMD section as a React element. Props: `section` (EmdSection from WASM parser), `interactive` (enable clickable elements). Used when host apps want to display EMD sections in custom layouts — for example, a dashboard rendering task cards in a grid.

**What you see:** One section rendered at a time. Can be placed anywhere in a React component tree. Multiple EmdBlocks on one page = custom dashboard layout.

**Tests:** 2

---

### Phase 12 — React Hooks  ⬜

**File:** `src/components/hooks.ts`

**What it does:** Three hooks for imperative access. `useEmdDocument(filePath)` → `{ ast, loading, error, reload }`. `useEmdParser(source)` → `{ ast, diagnostics }`. `useEmdSelection(editorRef)` → `{ focusedSection, selectedBlocks }`. Handles WASM init, debounced re-parse, cleanup.

**What you see:** Developers can access the parsed AST and selection state without refs. Build custom toolbars, status panels, or integrations on top of the editor.

**Tests:** 3

---

### Phase 13 — Plugin API  ⬜

**File:** `src/components/plugin-api.ts`

**What it does:** The public API for registering custom block widgets. `registerBlockWidget('my-tag', MyReactComponent)`. The React component receives `{ content, onChange }` props. Unregister with `unregisterBlockWidget('my-tag')`. Also `registerLLMProvider(config)` for AI panel.

**What you see:** Developers can extend the editor with their own block renderers. A ` ```custom-chart` block can render a custom chart React component. The playground block tester uses this API to test new widgets.

**Tests:** 2

---

### Phase 14 — Playground App  ⬜

**Files:** `src/dev/index.html`, `src/dev/App.tsx`, `src/dev/sample-files/*.emd`, `src/dev/block-tester.tsx`

**What it does:** A full Vite + React app that imports `<EmdEditor>` from the SDK source. File explorer sidebar with sample .emd files, tab bar, toolbar with theme switch and AI panel toggle, block tester for isolated debugging. `npm run dev` opens this. This is what we use to visually test everything. NOT published to npm.

**What you see:** The full EMD workspace — side panel listing sample files, tabs for open documents, editor area with live preview, theme switcher, block tester. You can open any .emd file and see all decorations, widgets, and interactions in real time.

---

### Phase 15 — AI Chat UI  ⬜

**File:** `src/ai-panel/ChatUi.tsx`

**What it does:** The chat interface. Message list (user right, AI left with model badge), input textarea with auto-resize, model selector dropdown (GPT-4o, Claude), token counter ("1240 / 8192"), cancel button during generation, loading indicator. Toggleable via toolbar button or Cmd+Shift+C. Resizable sidebar (default 400px).

**What you see:** A chat panel on the right side of the editor. Type a message about the document. The AI responds. The response is formatted with markdown. Code blocks in the response have Copy and Apply buttons.

---

### Phase 16 — Context Bridge  ⬜

**File:** `src/ai-panel/ContextBridge.ts`

**What it does:** Gathers document context for the AI. Collects the current file's full text, the focused section's details, summaries of linked files, and the project overview. Formats into a structured system prompt. Enforces token budget (default 8,192). Caches context between messages in a conversation turn.

**What you see:** (No visible change in the UI — this is the invisible intelligence behind the chat.) The AI now has document awareness. It knows what file you're editing, what sections exist, and what files are linked.

---

### Phase 17 — Streaming Engine  ⬜

**File:** `src/ai-panel/Streaming.ts`

**What it does:** Connects to the LLM provider via WASM graph executor, receives tokens one by one, flushes to the chat UI at word boundaries. Handles timeouts (retry with backoff), rate limits (show wait message), auth errors (show settings link). Supports cancellation — keep partial response. Supports tool calls — pause streaming, execute tool, resume.

**What you see:** AI responses appear word-by-word as they're generated. The cursor blinks while waiting. The cancel button works. Errors show clear messages.

---

### Phase 18 — Apply Edit  ⬜

**File:** `src/ai-panel/ApplyEdit.tsx`

**What it does:** When the AI proposes a code/text change in a fenced code block, an [Apply] button appears. Clicking it computes a diff against the current document, shows a preview (green additions, red deletions, editable text), and on confirmation applies the edit via CodeMirror transaction. Edits are undoable via Cmd+Z. Validation errors shown as warnings before apply.

**What you see:** Click [Apply] on an AI suggestion. A diff preview appears showing what changes. Edit the suggestion if needed. Click Apply to commit. The document updates. Cmd+Z to undo.

---

### Phase 19 — Integration + E2E Tests  ⬜

**What it does:** End-to-end tests exercising the full pipeline: open .emd file → parse → render in editor → interact with widget → save → verify file on disk. Cross-browser testing (Chrome, Firefox, Safari). Performance benchmarks. Bundle size verification.

**Tests:** 8+

---

### Phase 20 — npm Publish  ⬜

**What it does:** Final bundle optimization, README with examples, TypeScript type exports, version bump to 1.0.0, publish to npm as `@everthink/react-emd`.

**What you see:** `npm install @everthink/react-emd` works. `import { EmdEditor } from '@everthink/react-emd'` works. Any React app gets the full EMD editor.

---

## VISUAL PROGRESSION — What the playground shows after each phase

```
Phase 01     Phase 05           Phase 08            Phase 14            Phase 20
────────     ────────           ────────            ────────            ────────

Text only    Formatted text     Formatted text      Full workspace      npm publish
Markers      with badges        + themes            + dev tools         
hidden       • colored types    • light/dark        • sample files      npm i
but no       • status dots      • high contrast     • block tester      @everthink/
styling      • clickable links  • custom themes     • full editor       react-emd
             • link popovers                        component
                                • render diagram    • file explorer     
             Text still raw                              ↓
             looking, not        Now looks like     Now works like       Now anyone
             styled yet          a real editor      a real app           can build
                                                                        with it
```

---

## DEPENDENCY CHAIN — What must be done before what

```
Phase 01 (scaffold)
  ↓
Phase 02 (text-styler)  ← needs Phase 01's view-plugin skeleton
  ↓
Phase 03 (link-renderer)
  ↓
Phase 04 (status-badge)
  ↓
Phase 05 (type-badge)
  ↓
Phase 06 (block-resolver)
  ↓
Phase 07 (inline-widgets)
  ↓
Phase 08 (theme-engine)  ← all 8 engine phases done, visual editor complete
  ↓
Phase 09 (EmdEditor)     ← needs live-md complete
  ↓
Phase 10-13 (viewer, block, hooks, api) ← need EmdEditor pattern
  ↓
Phase 14 (playground)    ← needs EmdEditor to test
  ├── Phase 15 (chat UI)
  ├── Phase 16 (context bridge)  ← needs F1 WASM bridge stable
  ├── Phase 17 (streaming)
  └── Phase 18 (apply edit)    ← needs all above
  ↓
Phase 19 (E2E tests)    ← needs everything
  ↓
Phase 20 (publish)      ← final
```

---

*Each phase = one agent prompt. Each prompt = one new source file + tests + TODO.md updated.*
*The playground evolves continuously — you always see the latest state.*
