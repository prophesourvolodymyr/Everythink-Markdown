import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import { buildTextStylerDecorations } from '../text-styler';
import {
  type TextStylerConfig,
  DEFAULT_TEXT_STYLER_CONFIG,
} from '../types';

function getDecorations(
  doc: string,
  overrides: Partial<TextStylerConfig> = {}
): Range<Decoration>[] {
  const config = { ...DEFAULT_TEXT_STYLER_CONFIG, ...overrides };
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildTextStylerDecorations(tree, config);
}

function getStyle(d: Range<Decoration>): string {
  return (d.value as any).spec?.attributes?.style ?? '';
}

function getStyledRanges(doc: string, overrides: Partial<TextStylerConfig> = {}): { text: string; style: string }[] {
  const decos = getDecorations(doc, overrides);
  return decos.map((d) => ({
    text: doc.slice(d.from, d.to),
    style: getStyle(d),
  }));
}

describe('buildTextStylerDecorations', () => {
  it('styles H2 heading with correct font weight and size', () => {
    const ranges = getStyledRanges('## My Heading');
    const heading = ranges.find((r) => r.text === '## My Heading');
    expect(heading).toBeDefined();
    expect(heading!.style).toContain('font-weight: 600');
    expect(heading!.style).toContain('font-size: 1.5em');
  });

  it('styles StrongEmphasis text with bold weight', () => {
    const ranges = getStyledRanges('**bold text**');
    const bold = ranges.find((r) => r.text === '**bold text**');
    expect(bold).toBeDefined();
    expect(bold!.style).toContain('font-weight: 700');
  });

  it('styles Emphasis text with italic', () => {
    const ranges = getStyledRanges('*italic text*');
    const italic = ranges.find((r) => r.text === '*italic text*');
    expect(italic).toBeDefined();
    expect(italic!.style).toContain('font-style: italic');
  });

  it('styles InlineCode with monospace font and background', () => {
    const ranges = getStyledRanges('some `code` here');
    const code = ranges.find((r) => r.text === '`code`');
    expect(code).toBeDefined();
    expect(code!.style).toContain('font-family');
    expect(code!.style).toContain('monospace');
    expect(code!.style).toContain('background-color');
    expect(code!.style).toContain('border-radius');
  });

  it('styles Blockquote with left border', () => {
    const ranges = getStyledRanges('> quoted text');
    const quote = ranges.find((r) => r.text === '> quoted text');
    expect(quote).toBeDefined();
    expect(quote!.style).toContain('border-left');
  });

  it('styles Link with accent color and underline', () => {
    const ranges = getStyledRanges('[click here](https://example.com)');
    const link = ranges.find((r) => r.text === '[click here](https://example.com)');
    expect(link).toBeDefined();
    expect(link!.style).toContain('text-decoration: underline');
    expect(link!.style).toContain('var(--emd-accent)');
  });

  it('applies both heading and bold styles when StrongEmphasis is inside a heading', () => {
    const doc = '## Bold **heading** here';
    const ranges = getStyledRanges(doc);

    const heading = ranges.find((r) => r.text === doc);
    expect(heading).toBeDefined();
    expect(heading!.style).toContain('font-size: 1.5em');

    const bold = ranges.find((r) => r.text === '**heading**');
    expect(bold).toBeDefined();
    expect(bold!.style).toContain('font-weight: 700');
  });

  it('skips FencedCode descendants (no styles applied inside code blocks)', () => {
    const doc = '```\n## not a heading\n**not bold**\n```';
    const decos = getDecorations(doc);
    expect(decos.length).toBe(0);
  });

  it('produces no decorations when disabled entirely', () => {
    const decos = getDecorations('## heading **bold** `code`', { enabled: false });
    expect(decos.length).toBe(0);
  });

  it('produces no decorations for a type when its config option is disabled', () => {
    const decos = getDecorations('## heading', { styleHeadings: false });
    expect(decos.length).toBe(0);
  });

  it('hides HorizontalRule with Decoration.replace', () => {
    const decos = getDecorations('---');
    expect(decos.length).toBe(1);
    const d = decos[0];
    expect(d.from).toBe(0);
    expect(d.to).toBe(3);
    // Verify it's a replace decoration (spec attributes should NOT have style)
    expect(getStyle(d)).toBe('');
  });

  it('respects styleHorizontalRules: false', () => {
    const decos = getDecorations('---', { styleHorizontalRules: false });
    expect(decos.length).toBe(0);
  });

  it('handles multiple styled elements in one document', () => {
    const doc = '## Heading\n\n**bold** and *italic* with `code`';
    const decos = getDecorations(doc);
    expect(decos.length).toBeGreaterThanOrEqual(4);
  });
});
