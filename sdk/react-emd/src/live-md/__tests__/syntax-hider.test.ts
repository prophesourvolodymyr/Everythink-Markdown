import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import { buildSyntaxHiderDecorations } from '../syntax-hider';
import {
  type SyntaxHiderConfig,
  DEFAULT_SYNTAX_HIDER_CONFIG,
} from '../types';

function getDecorations(
  doc: string,
  overrides: Partial<SyntaxHiderConfig> = {}
): Range<Decoration>[] {
  const config = { ...DEFAULT_SYNTAX_HIDER_CONFIG, ...overrides };
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildSyntaxHiderDecorations(tree, config);
}

function collectHiddenNodes(doc: string, config: Partial<SyntaxHiderConfig> = {}): string[] {
  const decos = getDecorations(doc, config);
  return decos.map((d) => doc.slice(d.from, d.to));
}

describe('buildSyntaxHiderDecorations', () => {
  it('hides HeaderMark (# characters) in headings', () => {
    const decos = getDecorations('# Heading\n## Subheading\n### Deep');
    const hidden = decos.map((d) => 'HeaderMark');
    expect(decos.length).toBe(3);
    // Check ranges match #, ##, ### respectively
    expect(decos[0].from).toBe(0);
    expect(decos[0].to).toBe(1);
    expect(decos[1].from).toBeGreaterThan(9);
    expect(decos[2].from).toBeGreaterThan(decos[1].to);
  });

  it('hides EmphasisMark (*) and StrongEmphasisMark (**) markers', () => {
    const hidden = collectHiddenNodes('**bold** and *italic*');
    expect(hidden).toContain('**');
    expect(hidden).toContain('*');
    // The opening and closing ** should both be hidden
    expect(hidden.filter((h) => h === '**').length).toBe(2);
    // The opening and closing * should both be hidden  
    expect(hidden.filter((h) => h === '*').length).toBe(2);
  });

  it('hides CodeMark (backticks) around inline code', () => {
    const hidden = collectHiddenNodes('some `code` here');
    expect(hidden.filter((h) => h === '`').length).toBe(2);
  });

  it('hides LinkMark brackets and URL parens', () => {
    const hidden = collectHiddenNodes('[text](https://example.com)');
    expect(hidden).toContain('[');
    expect(hidden).toContain(']');
    expect(hidden).toContain('(');
    expect(hidden).toContain(')');
  });

  it('skips descendants of FencedCode blocks', () => {
    const doc = '```\n`not hidden`\n```';
    const hidden = collectHiddenNodes(doc);
    // The inner backticks should NOT be hidden because they're inside a fenced code block
    expect(hidden.filter((h) => h === '`').length).toBe(0);
  });

  it('hides ListMark (-) in unordered lists', () => {
    const hidden = collectHiddenNodes('- item 1\n- item 2');
    const dashMarks = hidden.filter((h) => h === '-');
    expect(dashMarks.length).toBe(2);
  });

  it('hides QuoteMark (>) in blockquotes', () => {
    const hidden = collectHiddenNodes('> quoted text');
    expect(hidden).toContain('>');
  });

  it('respects config: disables hiding for specific marker types', () => {
    const hiddenAll = collectHiddenNodes('## heading');
    expect(hiddenAll.some((h) => h.includes('#'))).toBe(true);

    const hiddenNone = collectHiddenNodes('## heading', {
      ...DEFAULT_SYNTAX_HIDER_CONFIG,
      hideHeadingMarks: false,
    });
    expect(hiddenNone.length).toBe(0);
  });

  it('produces no decorations when disabled entirely', () => {
    const decos = getDecorations('## heading **bold** - list', { enabled: false });
    expect(decos.length).toBe(0);
  });

  it('does not hide escaped markers (backslash-escaped)', () => {
    const hidden = collectHiddenNodes('\\*not italic\\*');
    // Escaped asterisks are parsed as Escape nodes, not EmphasisMark nodes
    expect(hidden.length).toBe(0);
  });

  it('hides both emphasis markers in nested bold-italic', () => {
    const hidden = collectHiddenNodes('***bold italic***');
    // Lezer parses ***bold italic*** as Emphasis(StrongEmphasis):
    // outer * (1 char) + inner ** (2 chars) + inner ** (2 chars) + outer * (1 char)
    // 4 EmphasisMark nodes total in order: *, **, **, *
    expect(hidden.length).toBe(4);
    expect(hidden[0]).toBe('*');
    expect(hidden[1]).toBe('**');
    expect(hidden[2]).toBe('**');
    expect(hidden[3]).toBe('*');
  });

  it('hides multiple hidden ranges when all config enabled', () => {
    const doc = '## Heading\n\n**bold** `code` [link](url)\n\n- list item\n> quote\n\n```\nfenced\n```';
    const decos = getDecorations(doc);
    // We should have multiple decorations covering various marker types
    expect(decos.length).toBeGreaterThan(5);
  });
});
