import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { SyntaxHiderConfig } from './types';

interface MarkerMapping {
  configKey: keyof SyntaxHiderConfig;
}

const MARKER_NODE_TYPES: Record<string, MarkerMapping> = {
  HeaderMark: { configKey: 'hideHeadingMarks' },
  EmphasisMark: { configKey: 'hideEmphasisMarks' },
  CodeMark: { configKey: 'hideCodeMarks' },
  LinkMark: { configKey: 'hideLinkMarks' },
  URL: { configKey: 'hideLinkMarks' },
  QuoteMark: { configKey: 'hideQuoteMarks' },
  ListMark: { configKey: 'hideListMarks' },
  TaskMarker: { configKey: 'hideListMarks' },
};

const SKIP_CONTAINER_TYPES = new Set([
  'FencedCode',
  'HTMLBlock',
]);

export function buildSyntaxHiderDecorations(
  tree: Tree,
  config: SyntaxHiderConfig,
  _state?: import('@codemirror/state').EditorState
): Range<Decoration>[] {
  if (!config.enabled) return [];

  const decorations: Range<Decoration>[] = [];
  const cursor = tree.cursor();
  let skipUntil = -1;

  do {
    if (skipUntil >= 0 && cursor.from < skipUntil) {
      continue;
    }

    skipUntil = -1;

    const nodeType = cursor.type.name;

    if (SKIP_CONTAINER_TYPES.has(nodeType)) {
      skipUntil = cursor.to;
      continue;
    }

    const mapping = MARKER_NODE_TYPES[nodeType];
    if (mapping && config[mapping.configKey]) {
      decorations.push(
        Decoration.replace({}).range(cursor.from, cursor.to)
      );
    }
  } while (cursor.next());

  return decorations;
}
