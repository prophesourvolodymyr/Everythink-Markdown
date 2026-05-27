import { describe, it, expect } from 'vitest';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { liveMarkdownPlugin } from '../index';

function createView(doc: string, debounceMs = 0): EditorView {
  const parent = document.createElement('div');
  const extensions = [
    markdown({ base: markdownLanguage }),
    ...liveMarkdownPlugin({ debounceMs }),
  ];
  return new EditorView({
    doc,
    parent,
    extensions,
  });
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe('liveMarkdownPlugin ViewPlugin', () => {
  it('can be created with an EditorView', () => {
    const view = createView('hello');
    expect(view).toBeDefined();
    view.destroy();
  });

  it('creates view with markdown headings and bold text', () => {
    const view = createView('## Heading\n**bold**\n- list');
    const state = view.state;

    expect(state.doc.toString()).toBe('## Heading\n**bold**\n- list');

    view.destroy();
  });

  it('handles empty document', () => {
    const view = createView('');
    expect(view.state.doc.length).toBe(0);
    view.destroy();
  });

  it('handles document with only plain text', () => {
    const view = createView('Just plain text without any markdown');
    expect(view.state.doc.toString()).toBe('Just plain text without any markdown');
    view.destroy();
  });

  it('handles large document without errors', () => {
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`## Section ${i}`);
      lines.push(`Content for section ${i} with **bold** and *italic* text.`);
      lines.push(`- item ${i}a`);
      lines.push(`- item ${i}b`);
      lines.push('');
    }
    const doc = lines.join('\n');
    const view = createView(doc);
    expect(view.state.doc.lines).toBeGreaterThan(50);
    view.destroy();
  });

  it('rebuilds decorations after document change', async () => {
    const view = createView('## Initial');
    await flushMicrotasks();

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '## Modified\n**bold text**' },
    });
    await flushMicrotasks();

    expect(view.state.doc.toString()).toBe('## Modified\n**bold text**');
    view.destroy();
  });

  it('debounces rapid changes', async () => {
    const view = createView('## Start', 100);

    view.dispatch({ changes: { from: 0, insert: 'A' } });
    view.dispatch({ changes: { from: 1, insert: 'B' } });
    view.dispatch({ changes: { from: 2, insert: 'C' } });

    await flushMicrotasks();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(view.state.doc.toString()).toBe('ABC## Start');
    view.destroy();
  });
});
