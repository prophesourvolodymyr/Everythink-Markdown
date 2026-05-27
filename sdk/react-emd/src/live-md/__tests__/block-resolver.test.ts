import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { buildBlockResolverDecorations } from '../block-resolver';
import {
  registerBlockWidget,
  unregisterBlockWidget,
  getBlockWidget,
} from '../block-resolver';
import {
  type BlockResolverConfig,
  type BlockWidget,
  type BlockWidgetContext,
  DEFAULT_BLOCK_RESOLVER_CONFIG,
} from '../types';
import { createMermaidWidget } from '../block-widgets/mermaid';
import { createKatexWidget } from '../block-widgets/katex';

function stubWidget(
  content: string,
  _context: BlockWidgetContext
): BlockWidget {
  let container: HTMLElement | null = null;
  let currentContent = content;
  let destroyed = false;
  let mountCount = 0;

  return {
    mount(el) {
      container = el;
      mountCount++;
      el.innerHTML = `<div class="test-widget">${currentContent}</div>`;
    },
    update(newContent) {
      currentContent = newContent;
      if (container) {
        container.innerHTML = `<div class="test-widget">${currentContent}</div>`;
      }
    },
    destroy() {
      destroyed = true;
      container = null;
    },
    getEstimatedHeight() {
      return 200;
    },
    eq(_other: BlockWidget) {
      return false;
    },
  };
}

function makeBlockConfig(
  overrides: Partial<BlockResolverConfig> = {}
): BlockResolverConfig {
  return { ...DEFAULT_BLOCK_RESOLVER_CONFIG, ...overrides };
}

function getDecorations(
  doc: string,
  config: BlockResolverConfig
): Range<Decoration>[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildBlockResolverDecorations(tree, null, config, state);
}

function getBlockDecorations(
  decos: Range<Decoration>[]
): Range<Decoration>[] {
  return decos.filter((d) => {
    const spec = (d.value as any)?.spec;
    return spec?.widget !== undefined;
  });
}

describe('buildBlockResolverDecorations', () => {
  it('fenced code with registered tag (mermaid) produces a block decoration', () => {
    const config = makeBlockConfig({
      widgets: { mermaid: stubWidget },
    });
    const doc = '```mermaid\ngraph TD\nA --> B\n```';
    const decos = getDecorations(doc, config);
    const blocks = getBlockDecorations(decos);

    expect(blocks.length).toBe(1);
    expect(blocks[0].from).toBe(0);
    expect(blocks[0].to).toBe(doc.length);

    const widget = (blocks[0].value as any).spec.widget;
    expect(widget).toBeDefined();
  });

  it('fenced code with unregistered tag produces no decoration', () => {
    const config = makeBlockConfig({
      widgets: { mermaid: stubWidget },
    });
    const doc = '```draw\n[{"type": "line"}]\n```';
    const decos = getDecorations(doc, config);
    const blocks = getBlockDecorations(decos);

    expect(blocks.length).toBe(0);
  });

  it('fenced code with known programming language tag produces no decoration', () => {
    const config = makeBlockConfig({
      widgets: { javascript: stubWidget, python: stubWidget },
    });
    const doc = '```javascript\nconsole.log("hello");\n```';
    const decos = getDecorations(doc, config);

    const blocks = getBlockDecorations(decos);
    expect(blocks.length).toBe(0);
  });

  it('fenced code with python tag produces no decoration', () => {
    const config = makeBlockConfig({
      widgets: { python: stubWidget },
    });
    const doc = '```python\nprint("hello")\n```';
    const decos = getDecorations(doc, config);

    const blocks = getBlockDecorations(decos);
    expect(blocks.length).toBe(0);
  });

  it('empty info string produces no decoration', () => {
    const config = makeBlockConfig({
      widgets: { '': stubWidget },
    });
    const doc = '```\nplain code block\n```';
    const decos = getDecorations(doc, config);

    const blocks = getBlockDecorations(decos);
    expect(blocks.length).toBe(0);
  });

  it('disabled config produces no decorations', () => {
    const config = makeBlockConfig({
      enabled: false,
      widgets: { mermaid: stubWidget },
    });
    const doc = '```mermaid\ngraph TD\nA --> B\n```';
    const decos = getDecorations(doc, config);

    expect(decos.length).toBe(0);
  });

  it('returns empty array when no widgets registered', () => {
    const config = makeBlockConfig();
    const doc = '```mermaid\ngraph TD\nA --> B\n```';
    const decos = getDecorations(doc, config);

    expect(decos.length).toBe(0);
  });

  it('multiple code blocks in one document get correct decorations', () => {
    const config = makeBlockConfig({
      widgets: { mermaid: stubWidget, katex: stubWidget },
    });

    const doc = [
      '# Title',
      '',
      'Some text',
      '',
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      '',
      'More text',
      '',
      '```katex',
      'E = mc^2',
      '```',
    ].join('\n');

    const decos = getDecorations(doc, config);
    const blocks = getBlockDecorations(decos);

    expect(blocks.length).toBe(2);

    const widget1 = (blocks[0].value as any).spec.widget;
    const widget2 = (blocks[1].value as any).spec.widget;
    expect(widget1).toBeDefined();
    expect(widget2).toBeDefined();
  });

  it('block size exceeds maxBlockSize produces no decoration', () => {
    const longContent = 'x'.repeat(100);
    const config = makeBlockConfig({
      maxBlockSize: 50,
      widgets: { mermaid: stubWidget },
    });
    const doc = '```mermaid\n' + longContent + '\n```';
    const decos = getDecorations(doc, config);

    const blocks = getBlockDecorations(decos);
    expect(blocks.length).toBe(0);
  });

  it('tag matching is case-insensitive', () => {
    const config = makeBlockConfig({
      widgets: { mermaid: stubWidget },
    });
    const doc = '```MERMAID\ngraph TD\nA --> B\n```';
    const decos = getDecorations(doc, config);
    const blocks = getBlockDecorations(decos);

    expect(blocks.length).toBe(1);
  });

  it('only EMD-tagged blocks get decorations, standard code blocks do not', () => {
    const config = makeBlockConfig({
      widgets: { mermaid: stubWidget },
    });

    const doc = [
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      '',
      '```typescript',
      'const x = 1;',
      '```',
      '',
      '```python',
      'print("hello")',
      '```',
    ].join('\n');

    const decos = getDecorations(doc, config);
    const blocks = getBlockDecorations(decos);

    expect(blocks.length).toBe(1);

    const widget = (blocks[0].value as any).spec.widget;
    expect(widget).toBeDefined();
  });
});

describe('widget registry', () => {
  it('registerBlockWidget / getBlockWidget / unregisterBlockWidget round-trip', () => {
    expect(getBlockWidget('testwidget')).toBeUndefined();

    registerBlockWidget('testwidget', stubWidget);
    expect(getBlockWidget('testwidget')).toBe(stubWidget);

    unregisterBlockWidget('testwidget');
    expect(getBlockWidget('testwidget')).toBeUndefined();
  });

  it('registerBlockWidget overwrites existing widget', () => {
    registerBlockWidget('twice', stubWidget);
    registerBlockWidget('twice', createMermaidWidget);

    expect(getBlockWidget('twice')).toBe(createMermaidWidget);

    unregisterBlockWidget('twice');
  });
});

describe('block widget stubs', () => {
  it('mermaid stub renders placeholder DOM correctly', () => {
    const context = {
      view: {} as any,
      sourceSpan: { from: 0, to: 100 },
      writeBack: () => {},
    };

    const widget = createMermaidWidget('graph TD', context);
    const el = document.createElement('div');
    widget.mount(el);

    expect(el.querySelector('.emd-block-widget')).toBeTruthy();
    expect(el.querySelector('.emd-block-widget-header')?.textContent).toBe(
      'mermaid'
    );
    expect(el.querySelector('pre')?.textContent).toBe('graph TD');

    widget.destroy();
  });

  it('mermaid stub update updates the DOM', () => {
    const context = {
      view: {} as any,
      sourceSpan: { from: 0, to: 100 },
      writeBack: () => {},
    };

    const widget = createMermaidWidget('old content', context);
    const el = document.createElement('div');
    widget.mount(el);

    widget.update('new content');

    expect(el.querySelector('pre')?.textContent).toBe('new content');

    widget.destroy();
  });

  it('mermaid stub destroy cleans up', () => {
    const context = {
      view: {} as any,
      sourceSpan: { from: 0, to: 100 },
      writeBack: () => {},
    };

    const widget = createMermaidWidget('graph TD', context);
    const el = document.createElement('div');
    widget.mount(el);

    widget.destroy();

    expect(el.querySelector('.emd-block-widget')).toBeTruthy();
  });

  it('katex stub renders placeholder DOM correctly', () => {
    const context = {
      view: {} as any,
      sourceSpan: { from: 0, to: 100 },
      writeBack: () => {},
    };

    const widget = createKatexWidget('E = mc^2', context);
    const el = document.createElement('div');
    widget.mount(el);

    expect(el.querySelector('.emd-block-widget')).toBeTruthy();
    expect(el.querySelector('.emd-block-widget-header')?.textContent).toBe(
      'katex'
    );
    expect(el.querySelector('pre')?.textContent).toBe('E = mc^2');

    widget.destroy();
  });
});
