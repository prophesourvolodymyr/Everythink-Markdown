import type { Extension } from '@codemirror/state';
import { liveMdViewPlugin } from './view-plugin';
import type { LiveMdConfig } from './types';
import type { EmdDocument } from '@everthink/emd';

export function liveMarkdownPlugin(
  config?: Partial<LiveMdConfig>,
  ast?: EmdDocument | null
): Extension[] {
  return [liveMdViewPlugin(config, ast)];
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
export { buildSyntaxHiderDecorations } from './syntax-hider';
export { buildTextStylerDecorations } from './text-styler';
export { buildWikiLinkDecorations } from './wiki-link';
export { buildSemanticLinkDecorations } from './semantic-link';
export { buildLinkRendererDecorations } from './link-renderer';
export { buildStatusBadgeDecorations } from './status-badge';
export { liveMdViewPlugin, LiveMdPlugin } from './view-plugin';
