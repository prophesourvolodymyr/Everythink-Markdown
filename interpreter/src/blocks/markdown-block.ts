import { Block, BlockPlugin, SectionType } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';
import {
  EditorView,
  keymap,
  placeholder,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

const MARKDOWN_BLOCK_TAG = 'emd-markdown-block';

export class EmdMarkdownBlock extends HTMLElement {
  private editorView: EditorView | null = null;
  private blockData: Block | null = null;
  private changeCallback: ((source: string) => void) | null = null;
  private container!: HTMLElement;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-markdown');
    this.container = document.createElement('div');
    this.container.className = 'emd-markdown-editor';
    this.appendChild(this.container);
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  onChange(callback: (source: string) => void): void {
    this.changeCallback = callback;
  }

  async mountEditor(): Promise<void> {
    if (this.editorView) {
      return;
    }

    const source = this.blockData?.section?.content
      .map((el) => {
        if ('Text' in el) return el.Text;
        if ('Paragraph' in el) return el.Paragraph;
        if ('CodeBlock' in el) return `\`\`\`${el.CodeBlock.language ?? ''}\n${el.CodeBlock.content}\n\`\`\``;
        if ('Heading' in el) return `${'#'.repeat(el.Heading.level)} ${el.Heading.text}`;
        if ('Link' in el) return `→ ${el.Link.relation}: ${el.Link.target}`;
        if ('BlockQuote' in el) return `> ${el.BlockQuote}`;
        return '';
      })
      .filter(Boolean)
      .join('\n\n') ?? '';

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && this.changeCallback) {
        const newSource = update.state.doc.toString();
        this.changeCallback(newSource);
      }
    });

    const readOnly = new Compartment();

    this.editorView = new EditorView({
      doc: source,
      parent: this.container,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        placeholder('Start writing in EMD...'),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        readOnly.of(EditorState.readOnly.of(false)),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        updateListener,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-editor': { outline: 'none', height: '100%' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--emd-mono, monospace)' },
          '.cm-content': { padding: '8px 0', minHeight: '2em' },
          '.cm-line': { lineHeight: '1.6', padding: '0 8px' },
          '.cm-gutters': {
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--emd-text-muted)',
          },
          '.cm-activeLineGutter': { backgroundColor: 'var(--emd-selection)' },
          '.cm-activeLine': { backgroundColor: 'var(--emd-selection)' },
        }),
        EditorView.contentAttributes.of({ autocorrect: 'off', spellcheck: 'false' }),
      ],
    });

    this.container.appendChild(this.editorView.dom);
  }

  focusEditor(): void {
    this.editorView?.focus();
  }

  getContent(): string {
    return this.editorView?.state.doc.toString() ?? '';
  }

  setContent(source: string): void {
    if (this.editorView) {
      this.editorView.dispatch({
        changes: { from: 0, to: this.editorView.state.doc.length, insert: source },
      });
    }
  }

  disconnectedCallback(): void {
    this.editorView?.destroy();
    this.editorView = null;
  }
}

if (!customElements.get(MARKDOWN_BLOCK_TAG)) {
  customElements.define(MARKDOWN_BLOCK_TAG, EmdMarkdownBlock);
}

const markdownBlockPlugin: BlockPlugin = {
  id: 'markdown-block',
  name: 'Markdown Text Block',
  version: '0.1.0',
  section_types: [
    SectionType.Summary,
    SectionType.Detail,
    SectionType.Spec,
    SectionType.Decision,
    SectionType.Idea,
    SectionType.Memory,
    SectionType.Meta,
    SectionType.Log,
    SectionType.Prompt,
    SectionType.Config,
    SectionType.Model,
    SectionType.API,
    SectionType.Schema,
    SectionType.Bug,
    SectionType.Agent,
    SectionType.Graph,
  ],
  component: EmdMarkdownBlock,
  toolbar: [
    { id: 'md-bold', label: 'Bold', icon: 'B', action: () => {} },
    { id: 'md-italic', label: 'Italic', icon: 'I', action: () => {} },
    { id: 'md-code', label: 'Code', icon: '<>', action: () => {} },
    { id: 'md-link', label: 'Link', icon: '→', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdMarkdownBlock) {
      element.setBlock(block);
      requestAnimationFrame(() => {
        element.mountEditor();
      });
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdMarkdownBlock) {
      element.setBlock(block);
    }
  },
  onFocus: (_block, element) => {
    if (element instanceof EmdMarkdownBlock) {
      element.focusEditor();
    }
  },
};

registerBlockPlugin(markdownBlockPlugin);

export { MARKDOWN_BLOCK_TAG, markdownBlockPlugin };
