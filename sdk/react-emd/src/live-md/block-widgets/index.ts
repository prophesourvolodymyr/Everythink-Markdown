import type { BlockResolverConfig } from '../types';
import { createMermaidWidget } from './mermaid';
import { createKatexWidget } from './katex';
import { createDiffWidget } from './diff';
import { createHtmlWidget } from './html-widget';

export function registerBuiltinBlockWidgets(
  config: BlockResolverConfig
): void {
  config.widgets['mermaid'] = createMermaidWidget;
  config.widgets['katex'] = createKatexWidget;
  config.widgets['diff'] = createDiffWidget;
  config.widgets['html'] = createHtmlWidget;
}

export { createMermaidWidget } from './mermaid';
export { createKatexWidget } from './katex';
export { createDiffWidget } from './diff';
export { createHtmlWidget } from './html-widget';
