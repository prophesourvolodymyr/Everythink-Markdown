import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { LinkRendererConfig } from './types';

const SKIP_CONTAINER_TYPES = new Set(['FencedCode', 'HTMLBlock']);

function getExcludedRanges(tree: Tree): { from: number; to: number }[] {
  const excluded: { from: number; to: number }[] = [];
  const cursor = tree.cursor();
  do {
    if (SKIP_CONTAINER_TYPES.has(cursor.type.name)) {
      excluded.push({ from: cursor.from, to: cursor.to });
    }
  } while (cursor.next());
  return excluded;
}

function isExcluded(
  pos: number,
  excluded: { from: number; to: number }[]
): boolean {
  return excluded.some((r) => pos >= r.from && pos < r.to);
}

export function buildWikiLinkDecorations(
  tree: Tree,
  docText: string,
  config: LinkRendererConfig
): Range<Decoration>[] {
  if (!config.enabled || !config.styleWikiLinks) return [];

  const decorations: Range<Decoration>[] = [];
  const excluded = getExcludedRanges(tree);
  const re = /\[\[(.+?)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(docText)) !== null) {
    const matchStart = match.index;
    const target = match[1];
    const targetStart = matchStart + 2;
    const targetEnd = targetStart + target.length;
    const matchEnd = targetEnd + 2;

    if (isExcluded(matchStart, excluded)) continue;

    decorations.push(
      Decoration.replace({}).range(matchStart, matchStart + 2)
    );

    decorations.push(
      Decoration.mark({
        attributes: {
          style: `color: ${config.wikiLinkColor}; text-decoration: underline; text-decoration-style: dotted; cursor: pointer`,
          class: 'emd-wiki-link',
        },
      }).range(targetStart, targetEnd)
    );

    decorations.push(
      Decoration.replace({}).range(targetEnd, matchEnd)
    );
  }

  return decorations;
}
