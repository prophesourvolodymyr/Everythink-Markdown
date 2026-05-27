import { liveMarkdownPlugin } from './live-md';
import type { LiveMdConfig, SyntaxHiderConfig, TextStylerConfig } from './live-md/types';
import { DEFAULT_LIVE_MD_CONFIG, DEFAULT_SYNTAX_HIDER_CONFIG, DEFAULT_TEXT_STYLER_CONFIG } from './live-md/types';

export { liveMarkdownPlugin };
export type { LiveMdConfig, SyntaxHiderConfig, TextStylerConfig };
export { DEFAULT_LIVE_MD_CONFIG, DEFAULT_SYNTAX_HIDER_CONFIG, DEFAULT_TEXT_STYLER_CONFIG };

export { EmdEditor } from './editor';
export { EmdViewer } from './viewer';
