export type BlockId = string;
export type PluginId = string;

export interface SourceSpan {
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
}

export interface DocumentMetadata {
  title?: string;
  version?: string;
  owner?: string;
}

export interface SectionMetadata {
  status_override?: string;
  depends_on: string[];
  id?: string;
}

export enum SectionType {
  Summary = 'summary',
  Detail = 'detail',
  Spec = 'spec',
  Task = 'task',
  Decision = 'decision',
  Verify = 'verify',
  Bug = 'bug',
  Idea = 'idea',
  Agent = 'agent',
  Graph = 'graph',
  Model = 'model',
  API = 'api',
  Config = 'config',
  Prompt = 'prompt',
  Memory = 'memory',
  Meta = 'meta',
  Schema = 'schema',
  Log = 'log',
}

export enum SectionStatus {
  Done = 'done',
  Pending = 'pending',
  InProgress = 'in-progress',
  Blocked = 'blocked',
  Archived = 'archived',
  Cancelled = 'cancelled',
  Unknown = 'unknown',
}

export enum LinkRelation {
  Depends = 'depends',
  Implements = 'implements',
  Satisfies = 'satisfies',
  Blocks = 'blocks',
  Triggers = 'triggers',
  Models = 'models',
  Configures = 'configures',
  Prompts = 'prompts',
  Tests = 'tests',
  Documents = 'documents',
  AlternativeTo = 'alternative-to',
  Replaces = 'replaces',
  Supersedes = 'supersedes',
  Contradicts = 'contradicts',
  Relates = 'relates',
  Example = 'example',
  Generates = 'generates',
  Calls = 'calls',
  Inherits = 'inherits',
}

export enum CodeBlockTag {
  Verify = 'verify',
  Example = 'example',
  Schema = 'schema',
  Prompt = 'prompt',
  Snippet = 'snippet',
  Html = 'html',
  Css = 'css',
  Mermaid = 'mermaid',
  Katex = 'katex',
  Diff = 'diff',
  Todo = 'todo',
  Vega = 'vega',
  ThreeD = '3d',
  Gantt = 'gantt',
  Media = 'media',
  Draw = 'draw',
  Kanban = 'kanban',
}

export interface CodeBlock {
  tag?: CodeBlockTag;
  language?: string;
  content: string;
  source_span: SourceSpan;
}

export interface SemanticLink {
  relation: LinkRelation;
  target: string;
  condition?: string;
  source_span: SourceSpan;
}

export interface WikiLink {
  target: string;
  anchor?: string;
  source_span: SourceSpan;
}

export interface Transclusion {
  target: string;
  anchor?: string;
  source_span: SourceSpan;
}

export interface MetadataComment {
  key: string;
  value: string;
  source_span: SourceSpan;
}

export type SectionElement =
  | { Paragraph: string }
  | { CodeBlock: CodeBlock }
  | { Link: SemanticLink }
  | { WikiLink: WikiLink }
  | { Transclusion: Transclusion }
  | { MetadataComment: MetadataComment }
  | { Text: string }
  | { List: SectionElement[] }
  | { BlockQuote: string }
  | { Heading: { level: number; text: string } }
  | { HorizontalRule: null };

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  source_span?: SourceSpan;
  code?: string;
}

export interface EmdSection {
  level: number;
  section_type: SectionType;
  status?: SectionStatus;
  title: string;
  content: SectionElement[];
  subsections: EmdSection[];
  source_span: SourceSpan;
  diagnostics: Diagnostic[];
  metadata: SectionMetadata;
}

export interface EmdDocument {
  sections: EmdSection[];
  diagnostics: Diagnostic[];
  metadata: DocumentMetadata;
}

export interface BlockTreeSnapshot {
  block_ids: BlockId[];
  parent_map: Record<BlockId, BlockId | null>;
  order_map: Record<BlockId, number>;
  type_map: Record<BlockId, string>;
}

export interface BlockChange {
  type: 'add' | 'remove' | 'move' | 'update' | 'reparent';
  block_id: BlockId;
  previous_parent?: BlockId | null;
  new_parent?: BlockId | null;
  previous_index?: number;
  new_index?: number;
  previous_state?: BlockTreeSnapshot;
  new_state?: BlockTreeSnapshot;
}

export type BlockChangeListener = (change: BlockChange) => void;

export enum BlockState {
  Unmounted = 'unmounted',
  Mounting = 'mounting',
  Mounted = 'mounted',
  Updating = 'updating',
  Destroying = 'destroying',
  Error = 'error',
}

export interface Block {
  id: BlockId;
  parent_id: BlockId | null;
  child_ids: BlockId[];
  section?: EmdSection;
  section_element?: SectionElement;
  plugin_id: PluginId;
  state: BlockState;
  element: HTMLElement | null;
  depth: number;
  order: number;
  collapsed: boolean;
}

export interface BlockToolbarItem {
  id: string;
  label: string;
  icon: string;
  action: (block: Block) => void;
  condition?: (block: Block) => boolean;
}

export interface BlockPlugin {
  id: PluginId;
  name: string;
  version: string;
  section_types?: SectionType[];
  code_block_tags?: CodeBlockTag[];
  toolbar?: BlockToolbarItem[];
  component: new () => HTMLElement;
  onMount?: (block: Block, element: HTMLElement) => void;
  onUpdate?: (block: Block, element: HTMLElement) => void;
  onDestroy?: (block: Block, element: HTMLElement) => void;
  onFocus?: (block: Block, element: HTMLElement) => void;
  onBlur?: (block: Block, element: HTMLElement) => void;
}

export interface UndoEntry {
  id: string;
  timestamp: number;
  changes: BlockChange[];
}

export interface KeyboardAction {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: string;
  description: string;
}

export interface EmdEditorConfig {
  storage: StorageProvider;
  plugins?: BlockPlugin[];
  undoDepth?: number;
  debounceMs?: number;
  theme?: 'light' | 'dark' | 'high-contrast';
}

export interface StorageProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  watch?(path: string, callback: (path: string, content: string) => void): () => void;
}

export interface EmdIndexEntry {
  path: string;
  sections: {
    title: string;
    section_type: SectionType;
    status?: SectionStatus;
    level: number;
  }[];
  metadata: DocumentMetadata;
}

export type ChangeEventHandler = (event: BlockChangeEvent) => void;

export function getCodeBlockContent(els: SectionElement[]): string | undefined {
  for (const el of els) {
    if ('CodeBlock' in el) {
      return (el as unknown as { CodeBlock: CodeBlock }).CodeBlock.content;
    }
  }
  return undefined;
}

export function getCodeBlockContentAndTag(els: SectionElement[]): { content: string; tag?: CodeBlockTag } | undefined {
  for (const el of els) {
    if ('CodeBlock' in el) {
      const cb = (el as unknown as { CodeBlock: CodeBlock }).CodeBlock;
      return { content: cb.content, tag: cb.tag };
    }
  }
  return undefined;
}

export interface BlockChangeEvent {
  type: 'block-added' | 'block-removed' | 'block-moved' | 'block-updated' | 'selection-changed';
  block_id?: BlockId;
  blocks?: BlockId[];
  parent_id?: BlockId | null;
  index?: number;
}
