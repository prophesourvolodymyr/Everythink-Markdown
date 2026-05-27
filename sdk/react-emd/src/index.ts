import { liveMarkdownPlugin } from './live-md';
import type {
  LiveMdConfig,
  SyntaxHiderConfig,
  TextStylerConfig,
  LinkRendererConfig,
  StatusBadgeConfig,
  TypeBadgeConfig,
  BlockResolverConfig,
  InlineWidgetsConfig,
  ThemeMode,
  ThemeDefinition,
  ThemeEngineConfig,
  BlockWidget,
  BlockWidgetContext,
  BlockWidgetConstructor,
} from './live-md/types';
import {
  DEFAULT_LIVE_MD_CONFIG,
  DEFAULT_SYNTAX_HIDER_CONFIG,
  DEFAULT_TEXT_STYLER_CONFIG,
  DEFAULT_LINK_RENDERER_CONFIG,
  DEFAULT_STATUS_BADGE_CONFIG,
  DEFAULT_TYPE_BADGE_CONFIG,
  DEFAULT_BLOCK_RESOLVER_CONFIG,
  DEFAULT_INLINE_WIDGETS_CONFIG,
} from './live-md/types';
import {
  registerBlockWidget,
  unregisterBlockWidget,
  getBlockWidget,
} from './live-md/block-resolver';
import { registerBuiltinBlockWidgets } from './live-md/block-widgets';
import { buildBlockResolverDecorations } from './live-md/block-resolver';
import { buildInlineWidgetDecorations } from './live-md/inline-widgets';
import {
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
} from './live-md/theme-engine';

export { liveMarkdownPlugin };
export type {
  LiveMdConfig,
  SyntaxHiderConfig,
  TextStylerConfig,
  LinkRendererConfig,
  StatusBadgeConfig,
  TypeBadgeConfig,
  BlockResolverConfig,
  InlineWidgetsConfig,
  ThemeMode,
  ThemeDefinition,
  ThemeEngineConfig,
  BlockWidget,
  BlockWidgetContext,
  BlockWidgetConstructor,
};
export {
  DEFAULT_LIVE_MD_CONFIG,
  DEFAULT_SYNTAX_HIDER_CONFIG,
  DEFAULT_TEXT_STYLER_CONFIG,
  DEFAULT_LINK_RENDERER_CONFIG,
  DEFAULT_STATUS_BADGE_CONFIG,
  DEFAULT_TYPE_BADGE_CONFIG,
  DEFAULT_BLOCK_RESOLVER_CONFIG,
  DEFAULT_INLINE_WIDGETS_CONFIG,
  registerBlockWidget,
  unregisterBlockWidget,
  getBlockWidget,
  registerBuiltinBlockWidgets,
  buildBlockResolverDecorations,
  buildInlineWidgetDecorations,
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
};

export { EmdEditor } from './editor';
export { EmdViewer } from './viewer';
