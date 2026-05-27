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

export interface LiveMdConfig {
  syntaxHider: SyntaxHiderConfig;
  textStyler: TextStylerConfig;
  linkRenderer: LinkRendererConfig;
  debounceMs: number;
  theme: 'light' | 'dark' | 'high-contrast';
}

export const DEFAULT_LIVE_MD_CONFIG: LiveMdConfig = {
  syntaxHider: DEFAULT_SYNTAX_HIDER_CONFIG,
  textStyler: DEFAULT_TEXT_STYLER_CONFIG,
  linkRenderer: DEFAULT_LINK_RENDERER_CONFIG,
  debounceMs: 200,
  theme: 'light',
};
