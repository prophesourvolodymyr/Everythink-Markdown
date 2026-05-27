import { liveMarkdownPlugin } from './live-md';
import type {
  LiveMdConfig,
  SyntaxHiderConfig,
  TextStylerConfig,
  LinkRendererConfig,
  StatusBadgeConfig,
} from './live-md/types';
import {
  DEFAULT_LIVE_MD_CONFIG,
  DEFAULT_SYNTAX_HIDER_CONFIG,
  DEFAULT_TEXT_STYLER_CONFIG,
  DEFAULT_LINK_RENDERER_CONFIG,
  DEFAULT_STATUS_BADGE_CONFIG,
} from './live-md/types';

export { liveMarkdownPlugin };
export type {
  LiveMdConfig,
  SyntaxHiderConfig,
  TextStylerConfig,
  LinkRendererConfig,
  StatusBadgeConfig,
};
export {
  DEFAULT_LIVE_MD_CONFIG,
  DEFAULT_SYNTAX_HIDER_CONFIG,
  DEFAULT_TEXT_STYLER_CONFIG,
  DEFAULT_LINK_RENDERER_CONFIG,
  DEFAULT_STATUS_BADGE_CONFIG,
};

export { EmdEditor } from './editor';
export { EmdViewer } from './viewer';
