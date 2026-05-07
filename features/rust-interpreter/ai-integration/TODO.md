# AI Integration — TODO

## Highlight Menu
- [ ] Appears 50ms after text selection, positioned above selection
- [ ] Row 1 (Formatting): H1, H2, H3, B, I, <>, 🔗
- [ ] Row 2 (Turn Into): Task, Decision, API, Code, Table, Mermaid, Draw (+ dropdown)
- [ ] Row 3 (AI): ✦ Replace, ⚡ Chat
- [ ] Positioning: shift near viewport edges
- [ ] Animations: fade in 100ms, slide up 4px
- [ ] Dismiss: click outside, Escape, or after action
- [ ] Cmd+K on word (no selection needed)
- [ ] Settings: add/remove/reorder items per row

## Inline AI Popup
- [ ] Below highlight menu when Chat clicked
- [ ] Stream response word-by-word
- [ ] Edit response inline
- [ ] Replace with AI response button
- [ ] Arrow ↗ promotes to chat panel
- [ ] Close ✕ dismisses
- [ ] Max 300px height, internal scroll
- [ ] Smooth height transition 200ms
- [ ] Cancel stops generation

## Chat Panel
- [ ] Side panel (right, Cmd+Shift+C), width 400px resizable
- [ ] Full conversation, message history
- [ ] Context: current file [summary] + focused section
- [ ] @-mention files/sections
- [ ] Model selector dropdown
- [ ] Token counter: "1,240 / 8,192"
- [ ] User messages: right, themed color
- [ ] AI messages: left, model badge
- [ ] Code blocks: syntax highlight, copy, Apply button
- [ ] Loading: three-dot pulse
- [ ] Scroll to bottom with indicator
- [ ] History: .emdenv/chat-history.emd

## LLM Providers
- [ ] Provider interface: LLMProvider trait
- [ ] OpenAI: GPT-4o, GPT-4o-mini, o1
- [ ] Anthropic: Claude Sonnet 4, Opus 4
- [ ] Plugin-registerable: registerLLMProvider()
- [ ] API keys in OS keychain

## Agent Runner V1
- [ ] Run button on [agent] and [graph] sections
- [ ] Bottom panel: terminal-green, monospace
- [ ] Stream output line-by-line
- [ ] Color-coded: green/red/yellow/white
- [ ] Stop button
- [ ] Writes results to .emd file
- [ ] Spinner indicator while running

## Proactive Suggestions
- [ ] Banner: "Run agent to implement this?" on [task|pending]
- [ ] Banner: "Run verification?" on [verify]
- [ ] Banner: "Execute this workflow?" on [graph]
- [ ] Never auto-execute
- [ ] Dismiss per section type in settings

## Settings — AI
- [ ] Default provider + model
- [ ] API keys (keychain)
- [ ] Custom T1/T2 prompts
- [ ] Token budget per chat
- [ ] Proactive suggestions toggle per type
- [ ] Per-provider: temperature, max_tokens, top_p
