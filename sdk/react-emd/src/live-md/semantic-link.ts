import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { LinkRendererConfig } from './types';

const RELATION_COLORS: Record<string, string> = {
  depends: '#f59e0b',
  blocks: '#ef4444',
  triggers: '#f97316',
  implements: '#22c55e',
  satisfies: '#22c55e',
  documents: '#3b82f6',
  example: '#3b82f6',
  contradicts: '#dc2626',
  supersedes: '#f97316',
  relates: '#6b7280',
  inherits: '#8b5cf6',
  replaces: '#f97316',
  tests: '#06b6d4',
};

const DEFAULT_RELATION_COLOR = '#6b7280';

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

export function buildSemanticLinkDecorations(
  tree: Tree,
  docText: string,
  config: LinkRendererConfig
): Range<Decoration>[] {
  if (!config.enabled || !config.styleSemanticLinks) return [];

  const decorations: Range<Decoration>[] = [];
  const excluded = getExcludedRanges(tree);
  const re = /→\s+([a-zA-Z][a-zA-Z0-9-]*):\s*(.+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(docText)) !== null) {
    const fullMatch = match[0];
    const relation = match[1];
    const target = match[2];
    const matchStart = match.index;

    if (isExcluded(matchStart, excluded)) continue;

    const relStartInMatch = fullMatch.indexOf(relation);
    const relStart = matchStart + relStartInMatch;
    const relEnd = relStart + relation.length;

    const targetStartInMatch = fullMatch.indexOf(target);
    const targetStart = matchStart + targetStartInMatch;
    const targetEnd = targetStart + target.length;

    const badgeColor =
      RELATION_COLORS[relation.toLowerCase()] || DEFAULT_RELATION_COLOR;

    if (relStart > matchStart) {
      decorations.push(
        Decoration.replace({}).range(matchStart, relStart)
      );
    }

    decorations.push(
      Decoration.mark({
        attributes: {
          style: `background-color: ${badgeColor}; color: #ffffff; border-radius: 3px; padding: 0 4px; font-size: 0.85em; font-weight: 600`,
          class: 'emd-semantic-link-badge',
        },
      }).range(relStart, relEnd)
    );

    decorations.push(
      Decoration.mark({
        attributes: {
          style: 'color: var(--emd-accent); text-decoration: underline; cursor: pointer',
          class: 'emd-semantic-link-target',
        },
      }).range(targetStart, targetEnd)
    );
  }

  return decorations;
}
