# Fa9-SmartFolds — TODO

- [x] SmartFoldsConfig, AutoFoldRule, DEFAULT_SMART_FOLDS_CONFIG types added to types.ts
- [x] emdFoldService fold service function using EMD AST section boundaries
- [x] autoFoldMatchingSections auto-fold logic for matching type/status/level rules
- [x] SectionFoldWidget WidgetType subclass for fold placeholder display
- [x] buildSmartFoldsExtension wraps foldState + foldService registration
- [x] Integration with liveMarkdownPlugin in index.ts
- [x] Auto-fold trigger in ViewPlugin constructor (setTimeout)
- [x] Public API exports in src/index.ts
- [x] 24 unit tests (5 foldService + 6 autoFold + 10 SectionFoldWidget + 3 buildSmartFoldsExtension)
- [x] 166 total tests pass, npm run build succeeds
