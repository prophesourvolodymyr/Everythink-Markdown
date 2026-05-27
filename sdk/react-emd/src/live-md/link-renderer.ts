import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { LiveMdConfig, LinkRendererConfig } from './types';
import { buildWikiLinkDecorations } from './wiki-link';
import { buildSemanticLinkDecorations } from './semantic-link';
import type { EmdDocument } from '@everthink/emd';

export function buildLinkRendererDecorations(
  tree: Tree,
  _ast: EmdDocument | null,
  config: LiveMdConfig,
  docText: string
): Range<Decoration>[] {
  const linkConfig: LinkRendererConfig = config.linkRenderer;

  const wikiRanges = buildWikiLinkDecorations(tree, docText, linkConfig);
  const semanticRanges = buildSemanticLinkDecorations(
    tree,
    docText,
    linkConfig
  );

  return [...wikiRanges, ...semanticRanges];
}
