import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import { buildSemanticLinkDecorations } from '../semantic-link';
import {
  type LinkRendererConfig,
  DEFAULT_LINK_RENDERER_CONFIG,
} from '../types';

function getDecorations(
  doc: string,
  overrides: Partial<LinkRendererConfig> = {}
): Range<Decoration>[] {
  const config = { ...DEFAULT_LINK_RENDERER_CONFIG, ...overrides };
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildSemanticLinkDecorations(tree, state.doc.toString(), config);
}

function getStyle(d: Range<Decoration>): string {
  return (d.value as any).spec?.attributes?.style ?? '';
}

describe('buildSemanticLinkDecorations', () => {
  it('produces badge on relation name and link-style on target', () => {
    const doc = '→ depends: file.emd';
    const decos = getDecorations(doc);

    const badges = decos.filter((d) =>
      getStyle(d).includes('background-color')
    );
    expect(badges.length).toBe(1);
    expect(doc.slice(badges[0].from, badges[0].to)).toBe('depends');

    const links = decos.filter(
      (d) =>
        getStyle(d).includes('var(--emd-accent)') &&
        getStyle(d).includes('text-decoration')
    );
    expect(links.length).toBe(1);
    expect(doc.slice(links[0].from, links[0].to)).toBe('file.emd');
  });

  it('hides the → arrow prefix', () => {
    const doc = '→ depends: file.emd';
    const decos = getDecorations(doc);

    const replaces = decos.filter(
      (d) => getStyle(d) === '' && 'spec' in (d.value as any)
    );
    expect(replaces.length).toBe(1);
    const hiddenText = doc.slice(replaces[0].from, replaces[0].to);
    expect(hiddenText).toMatch(/^→\s/);
  });

  it('maps relation names to correct badge colors', () => {
    const relations: Record<string, string> = {
      '→ depends: file.emd': '#f59e0b',
      '→ blocks: file.emd': '#ef4444',
      '→ implements: file.emd': '#22c55e',
      '→ documents: file.emd': '#3b82f6',
      '→ contradicts: file.emd': '#dc2626',
      '→ relates: file.emd': '#6b7280',
      '→ tests: file.emd': '#06b6d4',
    };

    for (const [doc, expectedColor] of Object.entries(relations)) {
      const decos = getDecorations(doc);
      const badge = decos.find((d) =>
        getStyle(d).includes('background-color')
      );
      expect(badge).toBeDefined();
      expect(getStyle(badge!)).toContain(expectedColor);
    }
  });

  it('uses neutral gray badge for unknown relations', () => {
    const doc = '→ customrel: file.emd';
    const decos = getDecorations(doc);

    const badge = decos.find((d) => getStyle(d).includes('background-color'));
    expect(badge).toBeDefined();
    expect(getStyle(badge!)).toContain('#6b7280');
  });

  it('does not decorate semantic links inside fenced code blocks', () => {
    const doc = '```\n→ depends: hidden.emd\n```\n→ depends: visible.emd';
    const decos = getDecorations(doc);

    const badges = decos.filter((d) =>
      getStyle(d).includes('background-color')
    );
    expect(badges.length).toBe(1);
  });

  it('does not match → inside standard link text', () => {
    const doc = '[use → arrow in link](https://example.com)';
    const decos = getDecorations(doc);

    const badges = decos.filter((d) =>
      getStyle(d).includes('background-color')
    );
    expect(badges.length).toBe(0);
  });

  it('produces no decorations when config is disabled', () => {
    const decos = getDecorations('→ depends: file.emd', { enabled: false });
    expect(decos.length).toBe(0);
  });

  it('produces no decorations when styleSemanticLinks is disabled', () => {
    const decos = getDecorations('→ depends: file.emd', {
      styleSemanticLinks: false,
    });
    expect(decos.length).toBe(0);
  });
});
