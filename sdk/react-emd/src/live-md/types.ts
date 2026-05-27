import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import type { EmdDocument } from '@everthink/emd';

export interface SyntaxHiderConfig {
  enabled: boolean;
  hideHeadingMarks: boolean;
  hideEmphasisMarks: boolean;
  hideCodeMarks: boolean;
  hideLinkMarks: boolean;
  hideCodeFences: boolean;
  hideQuoteMarks: boolean;
  hideListMarks: boolean;
  hideImageMarks: boolean;
}

export const DEFAULT_SYNTAX_HIDER_CONFIG: SyntaxHiderConfig = {
  enabled: true,
  hideHeadingMarks: true,
  hideEmphasisMarks: true,
  hideCodeMarks: true,
  hideLinkMarks: true,
  hideCodeFences: true,
  hideQuoteMarks: true,
  hideListMarks: true,
  hideImageMarks: true,
};

export interface TextStylerConfig {
  enabled: boolean;
  styleHeadings: boolean;
  styleEmphasis: boolean;
  styleInlineCode: boolean;
  styleBlockquotes: boolean;
  styleLinks: boolean;
  styleHorizontalRules: boolean;
}

export const DEFAULT_TEXT_STYLER_CONFIG: TextStylerConfig = {
  enabled: true,
  styleHeadings: true,
  styleEmphasis: true,
  styleInlineCode: true,
  styleBlockquotes: true,
  styleLinks: true,
  styleHorizontalRules: true,
};

export interface LinkRendererConfig {
  enabled: boolean;
  styleWikiLinks: boolean;
  styleSemanticLinks: boolean;
  wikiLinkColor: string;
  semanticLinkBadgeBg: string;
}

export const DEFAULT_LINK_RENDERER_CONFIG: LinkRendererConfig = {
  enabled: true,
  styleWikiLinks: true,
  styleSemanticLinks: true,
  wikiLinkColor: 'var(--emd-accent)',
  semanticLinkBadgeBg: 'var(--emd-accent)',
};

export type DecorationBuilder = (
  tree: Tree,
  ast: EmdDocument | null,
  config: LiveMdConfig,
  state: import('@codemirror/state').EditorState
) => Range<Decoration>[];

export interface StatusBadgeConfig {
  enabled: boolean;
  mode: 'dot' | 'pill';
  colors: Record<string, string>;
}

export const DEFAULT_STATUS_BADGE_CONFIG: StatusBadgeConfig = {
  enabled: true,
  mode: 'dot',
  colors: {
    done: '#22c55e',
    pending: '#9ca3af',
    'in-progress': '#f59e0b',
    blocked: '#ef4444',
    archived: '#6b7280',
    cancelled: '#6b7280',
    unknown: '#9ca3af',
  },
};

export interface TypeBadgeConfig {
  enabled: boolean;
  abbreviate: boolean;
  colors: Record<string, string>;
}

export const DEFAULT_TYPE_BADGE_CONFIG: TypeBadgeConfig = {
  enabled: true,
  abbreviate: false,
  colors: {
    task: 'var(--emd-type-task, #f59e0b)',
    decision: 'var(--emd-type-decision, #0d9488)',
    spec: 'var(--emd-type-spec, #2563eb)',
    api: 'var(--emd-type-api, #4f46e5)',
    bug: 'var(--emd-type-bug, #ef4444)',
    idea: 'var(--emd-type-idea, #eab308)',
    verify: 'var(--emd-type-verify, #f97316)',
    summary: 'var(--emd-type-summary, #6b7280)',
    detail: 'var(--emd-type-detail, #78716c)',
    memory: 'var(--emd-type-memory, #a855f7)',
    log: 'var(--emd-type-log, #9ca3af)',
    meta: 'var(--emd-type-meta, #6b7280)',
    config: 'var(--emd-type-config, #64748b)',
    schema: 'var(--emd-type-schema, #38bdf8)',
    model: 'var(--emd-type-model, #8b5cf6)',
    agent: 'var(--emd-type-agent, #d946ef)',
    graph: 'var(--emd-type-graph, #14b8a6)',
    prompt: 'var(--emd-type-prompt, #d97706)',
    template: 'var(--emd-type-template, #a8a29e)',
    human: 'var(--emd-type-human, #f43f5e)',
    draw: 'var(--emd-type-draw, #ec4899)',
    flow: 'var(--emd-type-flow, #06b6d4)',
    kanban: 'var(--emd-type-kanban, #84cc16)',
    example: 'var(--emd-type-example, #22c55e)',
    unknown: 'var(--emd-type-unknown, #9ca3af)',
  },
};

export interface BlockWidgetContext {
  view: import('@codemirror/view').EditorView;
  sourceSpan: { from: number; to: number };
  writeBack: (content: string) => void;
}

export interface BlockWidget {
  mount(container: HTMLElement): void;
  update(content: string): void;
  destroy(): void;
  getEstimatedHeight(): number;
  eq(other: BlockWidget): boolean;
}

export type BlockWidgetConstructor = (
  content: string,
  context: BlockWidgetContext
) => BlockWidget;

export interface BlockResolverConfig {
  enabled: boolean;
  widgets: Record<string, BlockWidgetConstructor>;
  lazyLoad: boolean;
  maxBlockSize: number;
  debounceUpdateMs: number;
}

export const DEFAULT_BLOCK_RESOLVER_CONFIG: BlockResolverConfig = {
  enabled: true,
  widgets: {},
  lazyLoad: true,
  maxBlockSize: 10000,
  debounceUpdateMs: 200,
};

export interface LiveMdConfig {
  syntaxHider: SyntaxHiderConfig;
  textStyler: TextStylerConfig;
  linkRenderer: LinkRendererConfig;
  statusBadge: StatusBadgeConfig;
  typeBadge: TypeBadgeConfig;
  blockResolver: BlockResolverConfig;
  debounceMs: number;
  theme: 'light' | 'dark' | 'high-contrast';
}

export const DEFAULT_LIVE_MD_CONFIG: LiveMdConfig = {
  syntaxHider: DEFAULT_SYNTAX_HIDER_CONFIG,
  textStyler: DEFAULT_TEXT_STYLER_CONFIG,
  linkRenderer: DEFAULT_LINK_RENDERER_CONFIG,
  statusBadge: DEFAULT_STATUS_BADGE_CONFIG,
  typeBadge: DEFAULT_TYPE_BADGE_CONFIG,
  blockResolver: DEFAULT_BLOCK_RESOLVER_CONFIG,
  debounceMs: 200,
  theme: 'light',
};
