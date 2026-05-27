# Context Loader — TODO

<!-- STATUS: done -->

## Index Building
- [x] Build EmdIndex from walkdir traversal of project root
- [x] Index every `.emd` file: sections by type, status, title, links
- [x] O(1) lookup for section by file + title
- [x] Incremental index update on file change (single file re-index, not full rebuild)
- [x] Memory-efficient: index metadata only, not full section bodies

## Query Methods
- [x] load_summaries() → all [summary] sections, ~200-500 tokens
- [x] load_by_type(kind) → filter by SectionType
- [x] load_by_status(status) → filter by SectionStatus
- [x] load_for_task(task_name) → task + dependency statuses only
- [x] resolve_context(entry) → walk links, load summaries + statuses
- [x] load_within_budget(priority) → load as much as budget permits

## Token Budgeting
- [x] tiktoken-rs integration for accurate token counting
- [x] Default budget: 8000 tokens (configurable)
- [x] Strict enforcement: never exceed budget by more than 5%
- [x] Track tokens per section, total consumed, remaining
- [x] Return truncation warning when budget exhausted

## Loading Priorities
- [x] Priority 1: directly queried sections (always load)
- [x] Priority 2: linked section STATUSES only (not body)
- [x] Priority 3: linked section summaries
- [x] Priority 4: linked section details (budget permitting)
- [x] [human] sections always loaded regardless of budget
- [x] Visual sections ([draw], [flow], [kanban]) never loaded

## Caching
- [x] Cache context slices by query signature
- [x] Invalidate on any file change in project
- [x] Invalidate on budget change
- [x] Invalidate on priority change
- [x] Cache hits return in <0.1ms

## Performance
- [x] Context load for 10-feature project under 1ms
- [x] Graph walk: O(1) per hop via indexed statuses
- [x] Token counting: minimal overhead per section

## Tests
- [x] load_summaries returns all summaries, no details
- [x] load_for_task returns 180 tokens for standard task query
- [x] resolve_context walks 5 levels of links without exceeding budget
- [x] Token budget enforcement: stops at limit
- [x] [human] sections always included
- [x] Cache returns on second identical query
- [x] Cache invalidated after file change
