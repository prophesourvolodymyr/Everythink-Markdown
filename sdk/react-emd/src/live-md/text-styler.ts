import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import type { TextStylerConfig } from './types';

const HEADING_STYLES: Record<string, Record<string, string>> = {
  ATXHeading1: {
    fontWeight: '700',
    fontSize: '2em',
    color: 'var(--emd-heading-color, var(--emd-text))',
  },
  ATXHeading2: {
    fontWeight: '600',
    fontSize: '1.5em',
    color: 'var(--emd-heading-color, var(--emd-text))',
  },
  ATXHeading3: {
    fontWeight: '600',
    fontSize: '1.17em',
    color: 'var(--emd-heading-color, var(--emd-text))',
  },
  ATXHeading4: {
    fontWeight: '600',
    fontSize: '1em',
    color: 'var(--emd-heading-color, var(--emd-text))',
  },
  ATXHeading5: {
    fontWeight: '600',
    fontSize: '0.83em',
    color: 'var(--emd-heading-color, var(--emd-text))',
  },
  ATXHeading6: {
    fontWeight: '600',
    fontSize: '0.67em',
    color: 'var(--emd-heading-color, var(--emd-text))',
  },
};

const NODE_STYLES: Record<string, Record<string, string>> = {
  ...HEADING_STYLES,
  StrongEmphasis: { fontWeight: '700' },
  Emphasis: { fontStyle: 'italic' },
  InlineCode: {
    fontFamily: 'var(--emd-mono, monospace)',
    backgroundColor: 'var(--emd-code-bg, var(--emd-bg-secondary))',
    borderRadius: '3px',
    padding: '0.1em 0.3em',
    fontSize: '0.9em',
  },
  Blockquote: {
    borderLeft: '3px solid var(--emd-accent)',
    paddingLeft: '1em',
    color: 'var(--emd-text-muted)',
  },
  Link: {
    color: 'var(--emd-accent)',
    textDecoration: 'underline',
  },
};

const SKIP_CONTAINER_TYPES = new Set(['FencedCode', 'HTMLBlock']);

const SKIP_CHILD_TYPES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'LinkMark',
  'URL',
  'QuoteMark',
  'ListMark',
  'TaskMarker',
]);

function styleToInline(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([k, v]) => {
      const key = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
      return `${key}: ${v}`;
    })
    .join('; ');
}

export function buildTextStylerDecorations(
  tree: Tree,
  config: TextStylerConfig
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

    if (SKIP_CHILD_TYPES.has(nodeType)) {
      continue;
    }

    if (nodeType === 'HorizontalRule') {
      if (config.styleHorizontalRules) {
        decorations.push(
          Decoration.replace({}).range(cursor.from, cursor.to)
        );
      }
      continue;
    }

    if (nodeType.startsWith('ATXHeading') && config.styleHeadings) {
      const styleObj = NODE_STYLES[nodeType];
      if (styleObj) {
        decorations.push(
          Decoration.mark({
            attributes: { style: styleToInline(styleObj) },
          }).range(cursor.from, cursor.to)
        );
      }
      continue;
    }

    if (nodeType === 'StrongEmphasis' && config.styleEmphasis) {
      decorations.push(
        Decoration.mark({
          attributes: { style: styleToInline(NODE_STYLES.StrongEmphasis) },
        }).range(cursor.from, cursor.to)
      );
      continue;
    }

    if (nodeType === 'Emphasis' && config.styleEmphasis) {
      decorations.push(
        Decoration.mark({
          attributes: { style: styleToInline(NODE_STYLES.Emphasis) },
        }).range(cursor.from, cursor.to)
      );
      continue;
    }

    if (nodeType === 'InlineCode' && config.styleInlineCode) {
      decorations.push(
        Decoration.mark({
          attributes: { style: styleToInline(NODE_STYLES.InlineCode) },
        }).range(cursor.from, cursor.to)
      );
      continue;
    }

    if (nodeType === 'Blockquote' && config.styleBlockquotes) {
      decorations.push(
        Decoration.mark({
          attributes: { style: styleToInline(NODE_STYLES.Blockquote) },
        }).range(cursor.from, cursor.to)
      );
      continue;
    }

    if (nodeType === 'Link' && config.styleLinks) {
      decorations.push(
        Decoration.mark({
          attributes: { style: styleToInline(NODE_STYLES.Link) },
        }).range(cursor.from, cursor.to)
      );
      continue;
    }
  } while (cursor.next());

  return decorations;
}
