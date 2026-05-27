# AGENTS.md — EMD (Everything MarkDown)

## What Is This Project About

EMD is a typed, semantic superset of Markdown. Every section has a **type** (`[task]`, `[decision]`, `[api]`, etc.) and optional **status** (`|done`, `|in-progress`). It adds semantic links (`→ depends: file.emd`), wiki-links (`[[file]]`), transclusions (`![[file]]`), and typed code blocks (` ```mermaid `, ` ```draw `).

The project builds the full ecosystem: a Rust parser + validator + WASM core, a frameworkless TypeScript web editor (custom elements, no React/Vue), a CLI toolchain, an LSP server, a graph-based agent executor, and eventually a Tauri desktop app.

**Core problem:** Knowledge workers, engineers, and AI agents need structured documents that are both human-writable and machine-parseable. EMD bridges plain-text and structured data.

**Users:** Software engineers tracking projects, AI agents reading/writing structured context, technical writers documenting APIs and decisions.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Parser | Rust (logos + pulldown-cmark) | Zero-copy lexer, compile-time state machine, 500-section parse in <5ms |
| Validation | Rust (custom validator) | Cross-file link resolution, status consistency, graph validation |
| WASM | wasm-pack → npm `@everthink/emd` | Browser + Node.js, 383KB gzipped |
| CLI | Rust (clap + miette) | `emd check`, `emd fmt`, `emd query`, `emd graph`, `emd export`, `emd new`, `emd lsp` |
| LSP | Rust (tower-lsp) | Diagnostics, hover, go-to-def, completion, code actions, format-on-save |
| Graph Executor | Rust (reqwest, tokio) | ReActAgent, ToolAgent, LLM providers (OpenAI, Anthropic) |
| Editor | TypeScript + Vite + CustomElements | Zero framework, web components, CodeMirror 6, Mermaid.js, KaTeX, Handsontable |
| Storage | OPFS (Browser), Tauri IPC (desktop), Memory (dev) | Origin Private File System for browser persistence |
| Desktop | Tauri v2 (planned) | macOS/Windows/Linux, auto-updater, native FS |

## Design System

- **Frameworkless CustomElements** — all components extend `HTMLElement`, registered via `customElements.define()`
- **CSS Variables** for theming: `--emd-*` (40+ vars), three themes: `.emd-theme-light`, `.emd-theme-dark`, `.emd-theme-high-contrast`
- **Plugin API** — `registerBlockPlugin()` / `unregisterBlockPlugin()`, block plugins implement `BlockPlugin` interface
- **StorageProvider** — abstract fs interface: `read`, `write`, `list`, `exists`, `mkdir`, `delete`, `rename`, `watch`
- **BlockPlugin interface**: `id`, `name`, `version`, `section_types`, `code_block_tags`, `component`, `onMount`, `onUpdate`, `onDestroy`
- **No library dependencies for core UI** — frameworkless by design, library imports only for specific renderers (CodeMirror, Mermaid, KaTeX)

## Project Health

**Phase 1 (Rust Core): COMPLETE** — 3 sub-features, 52 tests. Parser, validator, WASM, npm package `@everthink/emd` v0.1.0.
**Features:** F1-Fa (Parser), F1-Fb (Validator), F1-Fc (WasmTarget) ✅

**Phase 2 (Tooling): COMPLETE** — 4 sub-features. CLI, ContextLoader, LSP server, Graph executor. VS Code extension.
**Features:** F1-Fd (CliToolchain), F1-Fe (ContextLoader), F1-Ff (LspServer), F1-Fg (GraphExecutor) ✅

**Phase 3 (Interpreter): COMPLETE** — 3 sub-features, 28 tasks. Block engine, 11 block plugins, workspace shell, storage adapters. 41 tests passing, build succeeds.
**Features:** F2-Fa (BlockEngine), F2-Fb (CoreBlocks), F2-Fc (Workspace) ✅

**Phase 4 (Advanced): IN PROGRESS** — 3 sub-features, 25 tasks.
- F2-Fd (Canvas): 3/6 tasks done (drawing engine + zoom/pan/grid + export). Flowchart + Kanban remaining.
- F2-Fe (AiIntegration): 0/14 tasks done. Highlight menu, inline AI, chat panel, LLM providers.
- F2-Ff (Distribution): 0/11 tasks done. npm package, Tauri desktop, standalone web.

Block plugins (13 total): markdown, code, mermaid, katex, html, image, table, diff, task, media, canvas, flowchart, kanban

**Phase 5 (SDKs): PLANNED** — 3 SDKs, 64 sub-sub-features. Multi-platform editor distribution.
- F2-ReactSdk: 20 sub-sub-features. CM6+React web editor SDK. npm package planned.
- F3-RustSdk: 17 sub-sub-features. GPUI native desktop editor SDK. crate planned.
- F4-SwiftSdk: 17 sub-sub-features. SwiftUI Apple platform editor SDK. SPM planned.

Each SDK provides a drop-in `<EmdEditor>` component for its platform with live preview, all section type rendering, block widgets, AI chat panel, and theming. All consume F1-EmdCore via WASM, direct crate import, or C FFI respectively. 54 TODO.md files created across the three SDKs with 5+ checklist tasks each.

---

## Design System


---

# AGENTS.md — AI Project Management System

This is the **meta-guide** for how AI agents work in any software project.
Copy it to new repos as-is. It needs no modification.

---

> **Prime Directive:** Transform raw ideas into fully specified, maximally ambitious projects.
> The AI recommends. The user decides. **AI never cuts first — the user cuts.**
> Go big. Go dangerous. Shrink only when the user says shrink.

---

## 1. Bootstrap — What AI Does First

### State A: Empty repo
1. Ask the user for the project idea
2. Save raw response to `genesis/ORIGINAL_IDEA.md`
3. Run the AUDIT Protocol (Section 6)
4. Generate folder + file structure (Section 5)
5. Fill in Project Purpose section above

### State B: Has `genesis/ORIGINAL_IDEA.md` and/or `DIAGRAM.png`
1. Read `ORIGINAL_IDEA.md` carefully
2. Read every `DIAGRAM.png` in `genesis/` — they are the blueprint
3. Run the AUDIT Protocol using diagram context
4. Generate folder + file structure
5. Move each `DIAGRAM.png` into its matching `features/Fn-[Name]/` folder
6. Fill in Project Purpose section above

### State C: Has `features/`, `CYCLES.md`, etc.
1. Read `AGENTS.md` to understand the project
2. Read `CYCLES.md` — understand what is done, what is next, what is blocked
3. Read the relevant `features/Fn-[Name]/TODO.md` before touching any feature
4. Never create files that already exist
5. Update Project Purpose only if empty or missing

---

## 2. Project Identity

Fill these in after AUDIT confirmation. Update as the project evolves.
They are the first thing any new agent reads.

---

## 3. File Structure

```
DESIGN.md               ← visual identity, colors, typography, tone
BRAND.md                ← ecosystem context (only if part of larger suite)
TECHSTACK.md            ← tech bible: languages, frameworks, conventions, reasons
AGENTS.md               ← this file — project purpose + agent meta-guide
CYCLES.md               ← phase tracker: phases → grouped features → flat [x] task list
features/
  F1-[Name]/
    TODO.md             ← task checklist [ ] → [x]
    DOCS.md             ← implementation wiki
    DIAGRAM.png         ← human-provided architecture diagram
  F2-[Name]/
    TODO.md
    DOCS.md
  ...
PROMPTS/
  F1-[Name]/
    Phase-01-Fb1-Hero.md ← agent prompt chain (see Section 9)
genesis/
  ORIGINAL_IDEA.md      ← raw user idea, never edit
  DIAGRAM.png           ← top-level blueprint
```

### Sub-feature nesting for chunky features

When a feature is large, the AI should propose splitting it into sub-features:

```
features/
  F1-Auth/
    Fa-Login/
      TODO.md
      DOCS.md
    Fb-Sessions/
      TODO.md
      DOCS.md
    Fc-OAuth/
      TODO.md
      DOCS.md
```

Each sub-feature has its own `TODO.md`. The parent folder may have a `DOCS.md` overview.
The AI proposes this structure proactively when a feature has too many unrelated tasks.

### Audit docs are OPTIONAL

`genesis/` audit files (RFn-[Name]/ORIGINAL_F_IDEA.md, An-[Name].md) are NOT generated by default.
Only create them if the user explicitly asks: "write up the audit" or "document the decision."
The project works fine with just `features/`, `TODO.md`, and `CYCLES.md`.

---

## 4. CYCLES.md Structure

CYCLES.md groups multiple features into **phases**. Each phase has one flat task checklist.

```
# CYCLES.md

## Phase 1 — Foundation ✅ DONE
**Features:** F1 (CLI), F3 (Browser)

| # | Task | Status |
|---|------|--------|
| 1 | Cargo project setup, deps, module structure | ✅ |
| 2 | Clap CLI: all subcommands + flags | ✅ |
| 3 | Config load/save, setup command | ✅ |
...

## Phase 2 — Interface ⬜ NEXT
**Features:** F2 (TUI), F4 (Mirror)

| # | Task | Status |
|---|------|--------|
| 1 | Ratatui shell, raw mode, event loop | ⬜ |
| 2 | Home screen: URL input, slash commands | ⬜ |
...

## Progress
Phase 1 ██████████ 100% (9/9)
Phase 2 ░░░░░░░░░░   0% (0/13)
```

**Rules:**
- Phases group features. One phase = 1–4 related features.
- Each phase has ONE flat numbered task list — not per-feature sections.
- Tasks are checkmarks: `[x]` done, `[ ]` pending, `⬜` not started.
- Build dependency graph at top shows what blocks what.
- Progress bar per phase at bottom.
- Update as tasks complete — don't batch.

---

## 5. File Generation

After AUDIT confirmed, AI creates. Remember: go big, user cuts, not you.

```
AGENTS.md              ← fill in Project Purpose
TECHSTACK.md           ← recommended stack + reasoning
CYCLES.md              ← phase structure + dependency graph (see Section 4)
features/
  F1-[Name]/
    TODO.md            ← task list for feature 1
    DOCS.md            ← empty wiki scaffold
  ... (one folder per feature)
```

`DESIGN.md` and `BRAND.md` only if user mentions visual identity or ecosystem.

---

## 6. The AUDIT Protocol

Goal: transform a raw idea into a fully specified, maximally ambitious project.
The AI recommends. The user decides. **AI never cuts first — the user cuts.**
Go big. Go dangerous. The user tells you when to shrink.

### Step 1 — Read the idea
Read `ORIGINAL_IDEA.md` or what the user shared. Understand completely.

### Step 2 — Confirm understanding
```
## What I think this is
[2-3 sentence description]
[The core problem it solves]
[Who uses it and why]
```
If the user corrects, adjust immediately.

### Step 3 — 10 questions, debate format

**The 10 question topics are dynamic — not fixed.** The AI picks 10 of the most important topics
for this specific project from the categories below. These are just a menu — pick what matters,
skip what doesn't. No project needs all of them.

**Topic menu** (pick 10 that apply):
- **Tech stack** (language, framework, UI paradigm — CLI, TUI, web, GUI)
- **Distribution** (package manager, binary, Docker, web)
- **Storage** (file format, database, caching layer)
- **Architecture** (monolith, microservices, plugin system)
- **Auth** (none, API keys, OAuth, SSO)
- **API** (REST, GraphQL, gRPC, or no API)
- **Deployment** (self-hosted, cloud, edge)
- **Monetization** (open core, SaaS, one-time purchase, free)
- **Audience** (who is the end user — technical? casual? enterprise?)
- **UX / Feeling** (extract the user's vision — see Step 4)
- **Scope** (what is explicitly out of scope)
- **Edge cases** (what scenarios does the user already know are dangerous)
- **Growth** (how does this scale — 10 users or 10 million?)
- **Lock-in** (proprietary format, vendor lock-in, or fully open)
- **Integrations** (what does this connect to — Slack, GitHub, etc.)
- **Compliance** (SOC2, GDPR, data residency)
- **Onboarding** (how does a new user get their first win)

For each chosen topic:
1. AI states a recommendation with conviction + 2-3 sentence why
2. AI asks 4 targeted sub-questions about that recommendation
3. Always include `[Type your own answer]` option on every sub-question

One question at a time. Wait for answer before next.
User can skip all questions: "no questions, just do it."

### Step 4 — Extract the UX vision

The user is the creative brain. They already know what they want.
The AI's job is to EXTRACT that vision, not to solicit open-ended brainstorming.

Ask questions that pull out what the user already envisions:

- "Walk me through the moment a user first opens this. What do they see? What do they do first?"
- "You mentioned [specific scenario]. What's the exact sequence — I want to nail every step."
- "What's the one detail you've been thinking about that most people would miss?"
- "In your head, when this is done, what's the screenshot you'd put on the landing page?"

Never ask:
- "What should the feeling be?" (too vague)
- "What's the vibe?" (lazy)
- Open-ended "how should this work?" (the user isn't the architect — the AI is)

Probe until the AI can describe the UX back to the user with enough detail
that the user says "yes, exactly that."

### Step 5 — Diagrams
If a diagram would clarify, ask the user to provide a `.png` in `genesis/`.
AI reads diagrams as blueprints. AI cannot generate them.

### Step 6 — 4 AI-approved additions
AI proposes 4 things the user didn't mention but the AI approves of.
Argue each: why it fits, what's the risk if skipped.
User confirms or rejects each. Approved → features. Rejected → "V2 candidates."

### Step 7 — Confirm and build
User types "confirm" → AI generates the file structure and starts building.
No formal audit file is written unless the user explicitly asks for it.

**IMPORTANT: Skip the entire AUDIT if the user gives direct instructions.**
If the user says "build X with Y and Z" — don't ask questions. Build it.
The AUDIT is for when the user has a vague idea, not a concrete spec.

---

## 7. Agent Behavior Rules

These apply to every AI agent working in any repo using this system.

### Always
- ⚠️ **USE YOUR TOOLS. YOU ARE NOT BLIND.** You have access to powerful search and web-fetch MCP tools. Before guessing a library version, an API signature, a config format, or whether a dep is still maintained — SEARCH FOR IT. Tools available: `exa_web_search` / `exa_web_fetch` (full web search), `parallel-search_web_search` / `parallel-search_web_fetch` (parallel web search), `context7_query-docs` / `context7_resolve-library-id` (latest library docs), `webfetch` (raw URL fetch), `jina_read_url` (Jina AI reader). Never hallucinate a version number or assume a package exists when you can look it up in 2 seconds. This applies to everything: npm packages, Python deps, Docker base images, CUDA compatibility, API breaking changes, framework migration guides, and competitor research.
- Read `AGENTS.md` first. Always. No exceptions.
- Read the feature `TODO.md` before touching any feature code.
- Read `CYCLES.md` to understand what phase is current and what's blocked.
- Mark `[x]` in `TODO.md` as tasks complete. Do not batch.
- Mark `[x]` in `CYCLES.md` as tasks complete.
- Update `DOCS.md` when a feature is done.
- Run the project's build command before marking anything done. Warnings OK. Errors not.
- Be honest: `Code: Stub` compiles but does nothing. Only mark `Code: Working` if it works end-to-end.

### Never
- Start a feature whose phase dependencies are not done (check `CYCLES.md`).
- Edit `ORIGINAL_IDEA.md`. It is a permanent record.
- Create files unless required by the task.
- Mark a feature done without passing the build.
- Ask the user open-ended architecture questions. Take a position first.
- Cut scope or shrink features unprompted. The user decides what gets simplified.

### When Stuck
1. Set `<!-- STATUS: blocked -->` in the feature's `TODO.md`
2. Write the reason and what is needed to unblock
3. Update `CYCLES.md` status
4. Move to the next unblocked feature

---

## 8. Status Vocabulary

| String | Meaning |
|--------|---------|
| `Code: Working` | Core functionality runs end-to-end |
| `Code: Stub` | Exists, compiles, does nothing real |
| `Designed` | DOCS.md + TODO.md written, zero code |
| `Conceptual` | Discussed in AUDIT, no files yet |
| `Not started` | Known gap, never discussed |
| `Blocked` | Cannot proceed — dependency unresolved |
| `Done` | All tasks complete, build passes, DOCS.md written |

---

## 9. Prompt Chaining for Multi-Agent Work

When multiple AI agents work on different features in parallel (e.g. one on landing page, one on API platform), use the **PROMPTS/** directory to pass work between agents.

### Prompt file structure

```
PROMPTS/
  F1-Landing-Website/          ← feature-level folder
    Phase-01-Fb1-Hero.md       ← next agent prompt for this feature
    Phase-02-Fb2-QuickTranscribe.md
  F2-ApiPlatform/
    Phase-01-Fa-ApiSkeleton.md
    Phase-02-Fb-TranscriptionPipeline.md
```

### Naming convention

`Phase-{NN}-{FeatureCode}.md`

- `NN` = work phase count within that feature's TODO.md (starts at 01, increments per prompt)
- `FeatureCode` = the sub-feature code (e.g. `Fb1-Hero`, `Fa-ApiSkeleton`)
- Each prompt lives in a feature-level folder matching the feature group (`F1-Landing-Website`, `F2-ApiPlatform`, etc.)

### Prompt format (every prompt must follow this)

```markdown
# Phase {N} of {FeatureCode} — {Short Title}

## Context
What was built before, what state the codebase is in,
what this agent needs to know before starting.

## What you need to read first
| File | Why |
|------|-----|
| `path/to/file` | What it tells you |

## Codebase learnings
Key things learned from previous work:
- Architecture decisions already made
- Patterns and gotchas
- What exists (import, don't rebuild) vs what needs building

## What to build
Concrete task breakdown from the TODO.md.
Be specific — file names, function signatures, component props.

## Files to create/modify
| File | Action |
|------|--------|
| `path/to/file` | NEW / MODIFY — why |

## Verification
Command to run to confirm it works.

## When you finish
Generate the next prompt following this same format.
Place it in the matching PROMPTS/ folder.
Name it `Phase-{next_number}-{FeatureCode}.md`.
```

### Agent chain flow

1. User writes first prompt → places in `PROMPTS/F1-Landing-Website/Phase-01-Fb1-Hero.md`
2. Agent reads prompt + all referenced files → builds what's asked
3. Agent marks `[x]` tasks in TODO.md as it completes them
4. Agent runs build to verify
5. Agent generates the **next prompt** (`Phase-02-*.md`) covering what comes next
6. Next agent starts with that prompt
7. Repeat until TODO.md is fully marked `[x]`

### Rules
- Each prompt must be self-contained — include Context + Codebase learnings so the next agent doesn't repeat research
- The phase number increments per prompt, not per CYCLES.md phase
- When a sub-feature's TODO is complete, mark the parent feature task in CYCLES.md
- Prompts can exist in parallel for different features (landing page + API platform simultaneously)

---

*Copy this file to any repo. It works as-is.*
*The only project-specific content is the top section (Project Purpose, Tech Stack, Health).*
