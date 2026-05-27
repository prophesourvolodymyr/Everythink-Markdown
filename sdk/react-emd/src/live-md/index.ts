import type { Extension } from '@codemirror/state';
import { liveMdViewPlugin } from './view-plugin';
import type { LiveMdConfig } from './types';
import { DEFAULT_LIVE_MD_CONFIG } from './types';
import type { EmdDocument } from '@everthink/emd';
import { buildSmartFoldsExtension } from './smart-folds';

export function liveMarkdownPlugin(
  config?: Partial<LiveMdConfig>,
  ast?: EmdDocument | null
): Extension[] {
  const mergedConfig = { ...DEFAULT_LIVE_MD_CONFIG, ...config };
  const resolvedAst = ast ?? null;

  const extensions: Extension[] = [
    liveMdViewPlugin(config, resolvedAst),
  ];

  if (mergedConfig.smartFolds.enabled && resolvedAst) {
    extensions.push(
      ...buildSmartFoldsExtension(resolvedAst, mergedConfig.smartFolds)
    );
  }

  return extensions;
}

export { type LiveMdConfig, DEFAULT_LIVE_MD_CONFIG } from './types';
export { type SyntaxHiderConfig, DEFAULT_SYNTAX_HIDER_CONFIG } from './types';
export { type TextStylerConfig, DEFAULT_TEXT_STYLER_CONFIG } from './types';
export {
  type LinkRendererConfig,
  DEFAULT_LINK_RENDERER_CONFIG,
} from './types';
export {
  type StatusBadgeConfig,
  DEFAULT_STATUS_BADGE_CONFIG,
} from './types';
export {
  type TypeBadgeConfig,
  DEFAULT_TYPE_BADGE_CONFIG,
} from './types';
export {
  type BlockResolverConfig,
  DEFAULT_BLOCK_RESOLVER_CONFIG,
} from './types';
export {
  type InlineWidgetsConfig,
  DEFAULT_INLINE_WIDGETS_CONFIG,
} from './types';
export type {
  BlockWidget,
  BlockWidgetContext,
  BlockWidgetConstructor,
} from './types';
export { buildSyntaxHiderDecorations } from './syntax-hider';
export { buildTextStylerDecorations } from './text-styler';
export { buildWikiLinkDecorations } from './wiki-link';
export { buildSemanticLinkDecorations } from './semantic-link';
export { buildLinkRendererDecorations } from './link-renderer';
export { buildStatusBadgeDecorations } from './status-badge';
export { buildTypeBadgeDecorations } from './type-badge';
export {
  buildBlockResolverDecorations,
  registerBlockWidget,
  unregisterBlockWidget,
  getBlockWidget,
} from './block-resolver';
export { registerBuiltinBlockWidgets } from './block-widgets';
export { buildInlineWidgetDecorations } from './inline-widgets';
export { liveMdViewPlugin, LiveMdPlugin } from './view-plugin';
export {
  type ThemeMode,
  type ThemeDefinition,
  type ThemeEngineConfig,
  type SmartFoldsConfig,
  type AutoFoldRule,
} from './types';
export {
  DEFAULT_SMART_FOLDS_CONFIG,
} from './types';
export {
  registerTheme,
  unregisterTheme,
  getTheme,
  listThemes,
  generateThemeCSS,
  injectThemeStyles,
  resolveThemeVariables,
  buildThemeVariables,
  LIGHT_THEME,
  DARK_THEME,
  HIGH_CONTRAST_THEME,
} from './theme-engine';
export {
  emdFoldService,
  flattenSections,
  autoFoldMatchingSections,
  buildSmartFoldsExtension,
  buildFoldWidgetDecorations,
  SectionFoldWidget,
} from './smart-folds';
