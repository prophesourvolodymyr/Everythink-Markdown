# FORAGENTS.md — AI Project Management System

This file is the **meta-guide** for how AI agents collaborate with humans on any software project.
Copy it to any new repo. It explains the file system, the AUDIT protocol, and how agents should behave.

It is **not project-specific**. Replace nothing. It works as-is in any codebase.

---

## 1. Bootstrap Protocol — What AI Does First

When an AI agent opens a repo and sees one of these states, it must act immediately:

### State A: Repo is completely empty

```
(nothing here)
```

AI must:
1. Ask the user for the project idea before doing anything else
2. Save the raw user response to `predocs/ORIGINAL_IDEA.md`
3. Run the **AUDIT Protocol** (see Section 6)
4. After audit is confirmed: generate the full folder + file structure (see Section 5)
5. Write the project purpose into `AGENTS.md` under the **Project Purpose** section

---

### State B: Repo has only `predocs/ORIGINAL_IDEA.md` and/or DIAGRAM.png files

AI must:
1. Read `predocs/ORIGINAL_IDEA.md` carefully
2. Read every `DIAGRAM.png` in `predocs/` — these are the human's blueprint for the app
3. The AI interprets the diagrams to understand the architecture, data flow, and system structure
4. Run the **AUDIT Protocol** on that idea (see Section 6) — using diagram context to inform the conversation
5. After audit is confirmed: generate the full folder + file structure (see Section 5)
6. When the infrastructure is built, move each `DIAGRAM.png` from `predocs/` into the matching `features/Fn-[Name]/` folder it describes
7. Write the project purpose into `AGENTS.md` under the **Project Purpose** section

---

### State C: Repo has partial infrastructure (has `features/`, `CYCLES.md`, etc.)

AI must:
1. Read `AGENTS.md` to understand the project
2. Read `CYCLES.md` to understand what is done and what is next
3. Read the relevant `features/Fn-[Name]/TODO.md` before touching any feature
4. Never create files that already exist
5. Update `AGENTS.md` → **Project Purpose** only if it is empty or missing

**If `predocs/` contains `DIAGRAM.png` files**: the AI uses these as the architectural blueprint for the project. After building each feature folder, move the corresponding `DIAGRAM.png` from `predocs/` into that `features/Fn-[Name]/` folder.

---

## 2. Project Identity — Fill This In Every Time

Every new project must have these three things filled in by the AI after initialization. They live in `AGENTS.md`:

```
## What Is This Project About
EMD (Everything MarkDown) is a typed, semantic Markdown format that unifies documentation, agent configs, workflow orchestration, memory storage, task tracking, API specs, and visual canvas data into a single backward-compatible format. The Visual Interpreter renders EMD files as interactive blocks — think Notion meets Obsidian, with AI agents that execute directly from the file. EMD is an open standard (Rust reference implementation), and the interpreter embeds anywhere: npm, Tauri desktop, standalone web, or pure Rust apps.

## Tech Stack
- **Rust** — `emd` crate: parser, validator, ContextLoader, CLI, LSP server, graph executor. Compiled to native + WASM.
- **TypeScript** — Visual Interpreter UI: frameworkless web components (CustomElement), CodeMirror 6, Mermaid, KaTeX, Three.js, Excalidraw-style Canvas 2D.
- **Tauri v2** — Desktop shell: wraps the web UI in a WebView, provides native fs, menus, Apple Pencil events, auto-updater.
- **WASM (wasm-pack)** — `emd` crate compiled to browser target for web/npm hosts.
- **wry** — Thin Rust crate for embedding the interpreter in pure Rust apps without Tauri's Node.js layer.

## Project Health
- Build status: Phase 3 In Progress — 20/28 tasks done, 72 tests passing (52 Rust + 20 TS)
- Last major work: 2026-05-05 — 9 core block plugins (markdown, code, mermaid, katex, html, image, table, diff, task)
- Current phase: Phase 3 Active (core blocks complete, workspace polish + drag-to-reorder remaining)
```

AI behavior: fill these in after the AUDIT is confirmed. Update them when the project changes direction. These are the first thing a new agent reads.

---

## 3. Long‑term Memory (MemPalace)

This system uses **MemPalace** as a local-first long-term memory layer. It stores past conversations, decisions, and code context for this repository only. Agents use it to remember what was already built, what was decided, and why.

**How it works:**
MemPalace organizes memory into three levels — **Wing** (top-level category), **Room** (a topic within a wing), and **Drawer** (a bullet fact appended to a room). On disk it looks like:

```
memory/
  decisions/
    db-choice.md        ← a room file
    auth-strategy.md
  concepts/
    session-model.md
  bugs/
    login-fix.md
```

Every room is a plain markdown file. Bullet points are **drawers** — individual facts appended over time.

**Agents MUST treat MemPalace as the single source of truth for project memory:**

- Before answering a question about this project, call the MemPalace search to retrieve relevant past context — do not try to "remember" from the current chat alone.
- When learning something important — a new design decision, a constraint, a convention, a bug — write it back into MemPalace so future agents in this repo can find it.
- When something in the codebase contradicts MemPalace, flag it: either the code changed or MemPalace is stale. Resolve the staleness.

**MemPalace is local only.** No data is sent to external services beyond the LLM already being used.

---

## 4. File Structure — Every File Explained

```
DESIGN.md
BRAND.md
TECHSTACK.md
AGENTS.md
CYCLES.md
features/
  F1-[Name]/
    TODO.md
    DOCS.md
    DIAGRAM.png        ← architecture or flow diagram (present when needed)
  F2-[Name]/
    TODO.md
    DOCS.md
    DIAGRAM.png
  ...
predocs/
  DIAGRAM.png          ← top-level project diagram (present when needed)
  ORIGINAL_IDEA.md
  RF1-[Name]/
    ORIGINAL_F_IDEA.md
    A1-[Name].md
    DIAGRAM.png        ← feature audit diagram (present when needed)
  RF2-[Name]/
    ORIGINAL_F_IDEA.md
    A2-[Name].md
    DIAGRAM.png
  ...
```

---

### `DESIGN.md`

General visual identity and branding rules for this project.

Contains: color palette, typography choices, logo usage rules, tone of voice, UI design language.
If the project has per-feature branding (e.g. a sub-product with its own identity), each feature folder may have its own `DESIGN.md`.

AI behavior: read before generating any UI code, naming conventions, or copy.

---

### `BRAND.md`

Only present if this project is **part of a larger ecosystem**.

Contains: the purpose of the parent ecosystem, how this project fits into it, shared vocabulary, cross-project dependencies, the bigger vision.

Example: if you are building one tool inside a suite of developer tools, `BRAND.md` explains what the whole suite is and why this specific tool exists within it.

AI behavior: read before making any architecture decisions that affect the ecosystem.

---

### `TECHSTACK.md`

The technical bible for this project.

Contains: chosen languages, frameworks, libraries, infrastructure, deployment strategy, conventions (naming, file structure, error handling patterns), reasons for each decision.

AI behavior: never suggest a tech that contradicts this file. Never add a dependency not mentioned here without flagging it explicitly.

---

### `AGENTS.md`

The primary orientation file for any AI agent opening this repo.

Contains two things:

**1. Project Purpose** *(written after AUDIT is confirmed — derived from `ORIGINAL_IDEA.md`)*
A short, precise description of what this project is, who it is for, and what problem it solves.
This is the section AI must fill in during bootstrap.

**2. Codebase Navigation Guide**
A map of the repo: what lives where, what each major module does, how the features connect, what to read first.

AI behavior: this is always the first file to read. It is the entry point.

---

### `CYCLES.md`

The cross-feature task tracker for the whole project.

Contains: a dependency graph of all features, their current status, what is blocked, what is unblocked, and the recommended build order.

AI behavior: check this before starting any feature. Do not start a feature whose dependencies are not marked done. Update status here as features complete.

---

### `features/Fn-[Name]/TODO.md`

The task list for a single feature.

Contains: specific tasks broken into steps, acceptance criteria, current completion status (`[ ]` / `[x]`), blockers.

AI behavior: read this before touching the feature. Mark `[x]` as tasks complete. When all tasks are done, set `<!-- STATUS: done -->` at the top.

---

### `features/Fn-[Name]/DOCS.md`

The implementation wiki for a single feature.

Contains: what was built, how it works, public API, design decisions made, known limitations, how other features interact with this one.

**`features/Fn-[Name]/DIAGRAM.png`**
A PNG diagram for this feature. When present, it supplements the DOCS.md — it is the visual version of the architecture, data flow, or state machine. This file is always provided by a human. AI cannot generate diagrams.

AI behavior: if DIAGRAM.png exists, describe its contents at the top of DOCS.md under a `## Diagram` heading.

**Important wiki behavior:**
When feature Fn is completed, the DOCS.md files of *all other features* get updated to reflect the new context Fn provides. Every new agent working on any feature therefore always has full cross-feature context.

When the user confirms the audit for the whole project:
- One agent per feature spawns in parallel
- Each agent writes `DOCS.md` + `TODO.md` for its assigned feature
- A final agent writes `CYCLES.md` with the full dependency graph
- No agent starts coding until this step is complete

---

### `predocs/ORIGINAL_IDEA.md`

The raw, unedited user idea for the entire application.

Contains: exactly what the user wrote or said. No cleanup, no reformatting. This is the seed.

AI behavior: never edit this file. It is a permanent record of the original intent.

---

### `predocs/RFn-[Name]/ORIGINAL_F_IDEA.md`

The raw user idea for a single feature.

Contains: the user's own words about what this specific feature should do, before any AUDIT conversation. May be rough notes, a sentence, or a paragraph.

AI behavior: never edit this file. Use it as input to the feature AUDIT.

---

### `predocs/RFn-[Name]/An-[Name].md`

The formal audit output for a single feature.

Contains: the expanded, stress-tested, AI-amplified version of the feature idea. Includes: what it does, why it matters, technical approach, key decisions, open questions, and AI-proposed additions that were approved.

This file is generated **after** the AUDIT conversation (see Section 6) and confirmed by the user.

**`predocs/RFn-[Name]/DIAGRAM.png`**
A diagram for a specific feature's audit. The human provides this to show the architecture, data flow, or state machine for this feature. The AI reads it and uses it as the blueprint when building that feature.

After the AI has built that feature's infrastructure and confirmed with the user, it moves this `DIAGRAM.png` into `features/Fn-[Name]/`. That folder is its permanent home.

**`predocs/DIAGRAM.png`**
The architectural blueprint for the entire project. The human provides this as a `.png` before or during the AUDIT. The AI reads it and uses it to understand the system structure, component relationships, and data flow. This is the source — the AI builds the `features/`, `CYCLES.md`, and all infrastructure from what this diagram shows.

After the AI has built the project infrastructure and confirmed with the user, it moves `predocs/DIAGRAM.png` into the project root as a reference. The diagram's purpose is fulfilled at that point — it served as the blueprint and now lives permanently in the project.

---

## 5. File Generation — What AI Creates After Audit Confirmed

After the user confirms the audit, the AI must generate this exact structure:

```
AGENTS.md              ← create if missing; fill in Project Purpose section
TECHSTACK.md           ← create with AI-recommended stack and reasoning
CYCLES.md              ← create with full feature dependency graph
features/
  F1-[Name]/
    TODO.md            ← task list for feature 1
    DOCS.md            ← empty wiki scaffold for feature 1
    DIAGRAM.png        ← provided by human if the audit conversation produced a diagram
  F2-[Name]/
    TODO.md
    DOCS.md
    DIAGRAM.png
  ... (one folder per feature identified in audit)
predocs/
  ORIGINAL_IDEA.md     ← already exists, do not touch
  DIAGRAM.png         ← top-level project architecture diagram (present when needed)
  RF1-[Name]/
    ORIGINAL_F_IDEA.md ← already exists or create from audit
    A1-[Name].md       ← the formal audit for feature 1
    DIAGRAM.png        ← diagram produced during feature audit (present when needed)
  RF2-[Name]/
    ORIGINAL_F_IDEA.md
    A2-[Name].md
    DIAGRAM.png
  ...
```

`DESIGN.md` and `BRAND.md` are created only if the user mentions visual identity or an ecosystem during the audit.

---

## 6. The AUDIT Protocol

The AUDIT is a structured conversation between AI and user that transforms a raw idea into a fully specified, maximally ambitious project definition. The goal is to make the idea **as large, dangerous, and ambitious as possible** — not to shrink it into a safe MVP. The AI should never cut first. The user cuts.

---

### Step 1 — Read the idea

Read `ORIGINAL_IDEA.md` or whatever the user shared. Understand it completely before saying anything.

---

### Step 2 — Confirm What You Understood

Write this block before asking anything:

```
## What I think this is

[2-3 sentence description]
[The core problem it solves]
[Who uses it and why they will care]
```

If the user corrects this, adjust immediately. Every question that follows depends on this being right.

---

### Step 3 — Ask 10 Questions Dynamically

The AI asks **exactly 10 questions**. The AI **cannot proceed to question 2 until the user has answered question 1**, and so on. Wait for each answer.

**The user can skip all questions at any time** by saying: "no questions, just do it — follow my idea." In that case, skip all remaining questions and go directly to Step 5.

**How to ask each question — the debate format:**

For every topic, the AI does NOT ask open-ended questions like "what tech stack do you want?" or "what database?" The user is not an architect. The AI is.

Instead, for each of the 10 questions:

1. AI states a concrete recommendation with conviction and explains why in 2-3 sentences
2. AI then asks 4 targeted sub-questions about that recommendation
3. Always include a free-form option on every sub-question: `[Type your own answer]`

**Example question in debate format:**

```
Question 3: Tech Stack

I recommend Rust + Ratatui for the TUI. It compiles to a single binary, has zero
runtime dependencies, and is 10x faster than Python for the file I/O this tool needs.
The Rust TUI ecosystem is mature enough to not be painful.

1. Do you want a web UI alongside TUI, or TUI only?
   a) TUI only — ship fast, stay focused
   b) Web UI later — TUI first, add browser in V2
   c) Web UI from day one
   d) [Type your own answer]

2. Should the binary be self-contained with zero config on first run?
   a) Yes — detect everything, sane defaults, no setup required
   b) No — I want a setup wizard on first launch
   c) Hybrid — wizard only if no config file found
   d) [Type your own answer]

3. Which platforms must work on day one?
   a) macOS only — fastest to build, expand later
   b) macOS + Linux
   c) All three including Windows
   d) [Type your own answer]

4. How small must the binary be?
   a) As small as possible — under 10MB
   b) Don't care — prioritize features
   c) [Type your own answer]
```

**The 10 question topics are dynamic** — they are not fixed. The AI picks 10 of the most important topics based on the specific idea. Topics come from these categories, chosen based on what matters for this project:

- **Tech stack** (language, framework, UI paradigm — CLI, TUI, web, GUI)
- **Distribution** (package manager, binary, Docker, web)
- **Storage** (file format, database, caching layer)
- **Architecture** (monolith, microservices, plugin system)
- **Auth** (none, API keys, OAuth, SSO)
- **API** (REST, GraphQL, gRPC, or no API)
- **Deployment** (self-hosted, cloud, edge)
- **Monetization** (open core, SaaS, one-time purchase, free)
- **Audience** (who is the end user — technical? casual? enterprise?)
- **UX / Feeling** (ask about this specifically — see Step 4)
- **Scope** (what is explicitly out of scope — cut that aggressively)
- **Edge cases** (what scenarios does the user already know are dangerous)
- **Growth** (how does this scale — 10 users or 10 million?)
- **Lock-in** (proprietary format, vendor lock-in, or fully open)
- **Integrations** (what does this connect to — Slack, GitHub, etc.)
- **Compliance** (SOC2, GDPR, data residency)
- **Onboarding** (how does a new user get their first win)

The AI picks 10 that are relevant. For each, apply the debate format above.

---

### Step 4 — Ask About UX Feeling

Separate from the 10 questions, the AI explicitly asks about the **feeling** of using the product. The user's brain is another AI being worked with — ask it like you would ask another agent:

- "When this works perfectly, what does the moment of success feel like for the user?"
- "What is the most annoying thing in similar tools today that this should **never** do?"
- "What is the one scenario that keeps you up at night about this project?"
- "What should the first-time experience feel like — 30 seconds to first value, or 30 minutes?"

These questions unlock design decisions that no technical question ever reaches.

---

### Step 5 — Ask for a Diagram When It Helps

At any point during the AUDIT, if a diagram would clarify the idea, ask the human to provide one as a `.png` file in `predocs/`. The AI cannot generate diagrams — it can only read and interpret them.

**A diagram in `predocs/` is a blueprint, not a decoration.** When the human provides one, the AI:
1. Reads it and interprets the architecture, components, data flow, and relationships shown
2. Uses that diagram as the source of truth for building the corresponding feature or project infrastructure
3. After confirming with the user that the infrastructure is built, moves the `DIAGRAM.png` into the matching `features/Fn-[Name]/` folder or project root

When to ask for a diagram:
- System architecture (what components exist, how data flows)
- State machines (how the system behaves across states)
- Data models (entity relationships, storage shape)
- User flow diagrams (what happens step by step)
- Feature dependency graphs (what depends on what)

The human provides the `.png` file. The AI describes it in text for future agents.

---

### Step 6 — AI Proposes 4 Big Ideas

After all questions are answered, the AI presents 4 broad additions it believes belong in this project — things the user did not mention but the AI approves of. The AI argues for each one. The user confirms or rejects each.

```
## 4 Things I Think Should Be In This Project (AI-Approved)

These are not in your original idea. I argue for each. You decide.

1. [Feature name]
   Why: [why this is a natural extension of what the user described]
   Risk if skipped: [what becomes harder or impossible without this]

2. [Feature name]
   Why: [why users will expect this even if the user didn't think of it]
   Risk if skipped: [what competitor advantage is lost]

3. [Feature name]
   Why: [why this makes the product 10x more defensible or valuable]
   Risk if skipped: [what the V2 rewrite will need to add anyway]

4. [Feature name]
   Why: [why this is the natural next step that makes everything else easier]
   Risk if skipped: [what debt is created]
```

Approved ideas go into the formal audit. Rejected ideas are noted in the audit under "Rejected AI Proposals — V2 Candidates."

---

### Step 7 — Write the Formal Audit File

After the user types "confirm", the AI writes `predocs/RFn-[Name]/An-[Name].md`:

```markdown
# Audit: [Feature Name]

## What This Is
[Precise description]

## Why It Matters
[The problem it solves and who it solves it for]

## Technical Approach
[Stack, architecture, key decisions made during AUDIT conversation]

## Core Features
[Numbered list of everything this feature does]

## AI-Proposed Additions (Confirmed)
[Any of the 4 AI-proposed ideas the user approved]

## Rejected AI Proposals — V2 Candidates
[Any of the 4 AI-proposed ideas the user rejected — kept for future]

## Key Decisions
[Decisions made during the conversation and why]

## Open Questions
[Anything still unresolved — to be decided before or during build]

## Acceptance Criteria
[How we know this feature is done]
```

---

### Where to Ask Questions

- **If working inside the IDE** (this repo has a TUI with chat): ask questions directly in the chat. One question at a time. Wait for the answer.
- **If working in a general AI chat without TUI**: include all questions in the AUDIT markdown file and ask the user to answer before proceeding.
- **If the user says "no questions, just do it"**: skip directly to Step 6 (4 AI ideas), then Step 7.

---

## 7. Agent Behavior Rules

These apply to every AI agent working in any repo using this system.

### Always

- Read `AGENTS.md` first. Always. No exceptions.
- Read the feature `TODO.md` before touching any feature code.
- Mark `[x]` in `TODO.md` as you complete tasks. Do not batch.
- Update `DOCS.md` when a feature is complete.
- Run `cargo build` (or equivalent build command) before marking anything done. Warnings are OK. Errors are not.
- Be honest about status. `Code: Stub` means it compiles but does nothing real. Never mark `Code: Working` unless it actually works end-to-end.

### Never

- Start a feature whose dependencies are not done (check `CYCLES.md`).
- Edit `ORIGINAL_IDEA.md` or `ORIGINAL_F_IDEA.md`. These are permanent records.
- Create files unless they are required by the task.
- Mark a feature done without passing the build.
- Ask the user open-ended architecture questions. Take a position first.

### When Stuck

If a feature is blocked:
1. Set `<!-- STATUS: blocked -->` in its `TODO.md`
2. Write the reason and what is needed to unblock
3. Update `CYCLES.md` status table
4. Move to the next unblocked feature

---

## 8. Status Vocabulary

Use these exact strings everywhere — in `TODO.md`, `CYCLES.md`, and `AGENTS.md` feature tables.

| String | Meaning |
|--------|---------|
| `Code: Working` | Real implementation, core functionality runs end-to-end |
| `Code: Stub` | File exists, compiles, does nothing real yet |
| `Designed` | DOCS.md + TODO.md written, zero code |
| `Conceptual` | Discussed in AUDIT, no files yet |
| `Not started` | Known gap, never discussed |
| `Blocked` | Cannot proceed — dependency unresolved |
| `Done` | All TODO tasks complete, build passes, DOCS.md written |

---

*This file is a template. Copy it to any repo. It requires no modification to work.*
*The only file that gets project-specific content after bootstrap is `AGENTS.md` → Project Purpose.*
