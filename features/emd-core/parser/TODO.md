# Parser — TODO

<!-- STATUS: done -->

## Core Parsing
- [x] Implement lexer using `logos` — SectionHeader, LinkArrow, CodeFence, Text tokens
- [x] Implement EmdDocument AST construction extending pulldown-cmark
- [x] Parse section headers: `## [type] Title`, `## [type|status] Title`, `## [type|blocked: reason] Title`
- [x] Parse all 17 section types with correct enum mapping
- [x] Parse all 6 status modifiers (done, pending, in-progress, blocked, archived, cancelled)
- [x] Parse semantic links: `→ relation: target [condition: value]`
- [x] Parse all 20+ link relation types with context validation
- [x] Parse code block tags: `` ```[tag] ```` for all 17 tags
- [x] Parse wiki-links: `[[file.emd#Section-Title]]`
- [x] Parse transclusion: `![[file.emd#Section-Title]]` with inline resolution
- [x] Parse metadata comments: `<!-- KEY: value -->`

## Error Recovery
- [x] Never return null AST — malformed sections produce valid nodes with diagnostics
- [x] Unknown section types → parsed as generic with diagnostic
- [x] Malformed status → SectionStatus::Unknown with diagnostic
- [x] Unknown link relations → Custom(String), no error
- [x] Unclosed code fence → assumed closed at EOF
- [x] Invalid transclusion → diagnostic, raw text preserved
- [x] Nested section hierarchy violations → flatten with diagnostic

## Performance
- [x] Parse 500-section file in under 5ms benchmark
- [x] Zero-copy string handling where possible
- [x] Logos compile-time state machine (no runtime regex overhead)
- [x] Lazy validation — parser produces AST fast, validator runs separately

## Tests
- [x] Parse every section type from the EMD spec
- [x] Parse every status modifier combination
- [x] Parse every link relation type
- [x] Parse nested sections with correct parent-child relationships
- [x] Parse transclusion references
- [x] Parse metadata comments
- [x] Error recovery: malformed input produces diagnostics, not panics
- [x] Round-trip: parse → serialize → parse produces identical AST
- [x] Backward compatibility: standard markdown parses without EMD annotations
