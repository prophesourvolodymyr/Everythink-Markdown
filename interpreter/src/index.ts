export { BlockManager } from './core/block-manager';
export { computeDiff, takeSnapshot, restoreSnapshot, minimalDomDiff } from './core/diff';
export {
  registerBlockPlugin,
  unregisterBlockPlugin,
  getBlockPlugin,
  getAllPlugins,
  resolveBlockPlugin,
  onPluginRegistryChange,
  pluginRegistry,
  PluginRegistry,
} from './core/plugin-api';
export { UndoManager } from './core/undo-manager';
export { KeyboardManager, createKeyboardManager, DEFAULT_KEYBOARD_BINDINGS } from './core/keyboard';
export { MemoryStorage, BrowserStorage } from './storage/browser-storage';
export { TauriStorage, RustStorage } from './storage/desktop-storage';
export { EmdEditor, EMD_EDITOR_TAG } from './components/emd-editor';
export { EmdWorkspace, EMD_WORKSPACE_TAG } from './components/emd-workspace';
export { EmdFallbackBlock, FALLBACK_BLOCK_TAG } from './blocks/fallback-block';
export { EmdMarkdownBlock, MARKDOWN_BLOCK_TAG } from './blocks/markdown-block';
export { EmdCodeBlock, CODE_BLOCK_TAG } from './blocks/code-block';
export { EmdMermaidBlock, MERMAID_BLOCK_TAG } from './blocks/mermaid-block';
export { EmdKatexBlock, KATEX_BLOCK_TAG } from './blocks/katex-block';
export { EmdHtmlBlock, HTML_BLOCK_TAG } from './blocks/html-block';
export { EmdImageBlock, IMAGE_BLOCK_TAG } from './blocks/image-block';
export { EmdTableBlock, TABLE_BLOCK_TAG } from './blocks/table-block';
export { EmdDiffBlock, DIFF_BLOCK_TAG } from './blocks/diff-block';
export { EmdTaskBlock, TASK_BLOCK_TAG } from './blocks/task-block';

export type {
  BlockId,
  PluginId,
  SourceSpan,
  DocumentMetadata,
  SectionMetadata,
  EmdSection,
  EmdDocument,
  SectionElement,
  CodeBlock,
  SemanticLink,
  WikiLink,
  Transclusion,
  MetadataComment,
  Diagnostic,
  Block,
  BlockPlugin,
  BlockChange,
  BlockChangeEvent,
  BlockToolbarItem,
  BlockTreeSnapshot,
  UndoEntry,
  KeyboardAction,
  EmdEditorConfig,
  StorageProvider,
  EmdIndexEntry,
  ChangeEventHandler,
} from './core/types';

export {
  SectionType,
  SectionStatus,
  LinkRelation,
  CodeBlockTag,
  BlockState,
  getCodeBlockContent,
  getCodeBlockContentAndTag,
} from './core/types';
