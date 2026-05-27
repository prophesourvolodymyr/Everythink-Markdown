import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import { buildWikiLinkDecorations } from '../wiki-link';
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
  return buildWikiLinkDecorations(tree, state.doc.toString(), config);
}

function getStyle(d: Range<Decoration>): string {
  return (d.value as any).spec?.attributes?.style ?? '';
}

describe('buildWikiLinkDecorations', () => {
  it('styles wiki-link target with accent color, underline, and dotted style', () => {
    const doc = 'See [[my-file]] for details';
    const decos = getDecorations(doc);

    const marks = decos.filter(
      (d) =>
        getStyle(d).includes('text-decoration') &&
        getStyle(d).includes('dotted')
    );
    expect(marks.length).toBe(1);
    expect(marks[0].from).toBe(6);
    expect(marks[0].to).toBe(13);
    expect(doc.slice(marks[0].from, marks[0].to)).toBe('my-file');

    const style = getStyle(marks[0]);
    expect(style).toContain('var(--emd-accent)');
    expect(style).toContain('text-decoration: underline');
    expect(style).toContain('text-decoration-style: dotted');
    expect(style).toContain('cursor: pointer');
  });

  it('hides [[ and ]] brackets with Decoration.replace', () => {
    const doc = '[[my-file]]';
    const decos = getDecorations(doc);

    const replaces = decos.filter(
      (d) => getStyle(d) === '' && 'spec' in (d.value as any)
    );
    expect(replaces.length).toBe(2);

    const hiddenTexts = replaces.map((d) => doc.slice(d.from, d.to));
    expect(hiddenTexts).toContain('[[');
    expect(hiddenTexts).toContain(']]');
  });

  it('does not decorate wiki-links inside fenced code blocks', () => {
    const doc = '```\n[[hidden-link]]\n```\noutside [[visible-link]]';
    const decos = getDecorations(doc);

    const marks = decos.filter((d) => getStyle(d) !== '');
    expect(marks.length).toBe(1);
    expect(doc.slice(marks[0].from, marks[0].to)).toBe('visible-link');
  });

  it('does not decorate wiki-links inside HTML blocks', () => {
    const doc =
      '<div>\n[[hidden-link]]\n</div>\n\noutside [[visible-link]]';
    const decos = getDecorations(doc);

    const marks = decos.filter((d) => getStyle(d) !== '');
    expect(marks.length).toBe(1);
    expect(doc.slice(marks[0].from, marks[0].to)).toBe('visible-link');
  });

  it('decorates multiple wiki-links in one document', () => {
    const doc = '[[first]] and [[second]] and [[third]]';
    const decos = getDecorations(doc);

    const marks = decos.filter((d) => getStyle(d) !== '');
    expect(marks.length).toBe(3);

    const targets = marks.map((d) => doc.slice(d.from, d.to));
    expect(targets).toContain('first');
    expect(targets).toContain('second');
    expect(targets).toContain('third');
  });

  it('produces no decorations when config is disabled', () => {
    const decos = getDecorations('[[test]]', { enabled: false });
    expect(decos.length).toBe(0);
  });

  it('produces no decorations when styleWikiLinks is disabled', () => {
    const decos = getDecorations('[[test]]', { styleWikiLinks: false });
    expect(decos.length).toBe(0);
  });
});
