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

export type DecorationBuilder = (
  tree: Tree,
  ast: EmdDocument | null,
  config: LiveMdConfig
) => Range<Decoration>[];

export interface LiveMdConfig {
  syntaxHider: SyntaxHiderConfig;
  textStyler: TextStylerConfig;
  debounceMs: number;
  theme: 'light' | 'dark' | 'high-contrast';
}

export const DEFAULT_LIVE_MD_CONFIG: LiveMdConfig = {
  syntaxHider: DEFAULT_SYNTAX_HIDER_CONFIG,
  textStyler: DEFAULT_TEXT_STYLER_CONFIG,
  debounceMs: 200,
  theme: 'light',
};
