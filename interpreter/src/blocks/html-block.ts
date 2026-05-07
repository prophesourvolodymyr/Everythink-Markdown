import { Block, BlockPlugin, CodeBlockTag, getCodeBlockContent } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const HTML_BLOCK_TAG = 'emd-html-block';

export class EmdHtmlBlock extends HTMLElement {
  private blockData: Block | null = null;
  private iframe!: HTMLIFrameElement;
  private contentEl!: HTMLElement;
  private popoutBtn!: HTMLButtonElement;
  private mode: 'edit' | 'preview' = 'preview';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-html');
    this.innerHTML = `
      <div class="emd-html-toolbar">
        <button class="emd-html-toggle-btn" title="Toggle Edit/Preview">◐</button>
        <button class="emd-html-popout-btn" title="Open in new window">↗</button>
      </div>
      <div class="emd-html-content" style="display:none;">
        <textarea class="emd-html-textarea" placeholder="Enter HTML here..." spellcheck="false"></textarea>
      </div>
      <div class="emd-html-preview">
        <iframe class="emd-html-iframe" sandbox="allow-scripts" title="HTML Preview"></iframe>
      </div>
    `;

    this.contentEl = this.querySelector('.emd-html-content')!;
    this.popoutBtn = this.querySelector('.emd-html-popout-btn')!;
    this.iframe = this.querySelector('.emd-html-iframe')!;

    const textarea = this.querySelector('.emd-html-textarea') as HTMLTextAreaElement;
    textarea.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.updatePreview(textarea.value), 200);
    });

    this.querySelector('.emd-html-toggle-btn')!.addEventListener('click', () => {
      this.mode = this.mode === 'preview' ? 'edit' : 'preview';
      this.contentEl.style.display = this.mode === 'edit' ? '' : 'none';
      this.iframe.parentElement!.style.display = this.mode === 'preview' ? '' : 'none';
    });

    this.popoutBtn.addEventListener('click', () => {
      const blob = new Blob([this.getSource()], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);

    const content = block.section ? getCodeBlockContent(block.section.content) ?? '' : '';

    const textarea = this.querySelector('.emd-html-textarea') as HTMLTextAreaElement;
    textarea.value = content;
    this.updatePreview(content);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  getSource(): string {
    return (this.querySelector('.emd-html-textarea') as HTMLTextAreaElement).value;
  }

  private updatePreview(source: string): void {
    if (!this.iframe) return;

    const htmlBlocks: string[] = [];
    const cssBlocks: string[] = [];

    // Split source into HTML and CSS blocks
    // If there's a <style> tag, its content goes to CSS
    const styleMatch = source.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatch) {
      for (const match of styleMatch) {
        const inner = match.replace(/<\/?style[^>]*>/gi, '');
        cssBlocks.push(inner);
      }
    }

    let htmlContent = source.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    if (!htmlContent.trim()) {
      htmlContent = source.trim();
      // Auto-detect: if no HTML tags, wrap in basic template
      if (!/<[a-zA-Z]/.test(htmlContent)) {
        htmlContent = `<div>${htmlContent}</div>`;
      }
    }

    const fullDoc = `<!doctype html><html><head><meta charset="UTF-8"><style>${cssBlocks.join('\n')}</style></head><body>${htmlContent}</body></html>`;
    this.iframe.srcdoc = fullDoc;
  }
}

if (!customElements.get(HTML_BLOCK_TAG)) {
  customElements.define(HTML_BLOCK_TAG, EmdHtmlBlock);
}

const htmlBlockPlugin: BlockPlugin = {
  id: 'html-block',
  name: 'HTML/CSS Sandbox Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Html, CodeBlockTag.Css],
  component: EmdHtmlBlock,
  toolbar: [
    { id: 'html-toggle', label: 'Preview', icon: '◐', action: () => {} },
    { id: 'html-popout', label: 'Pop Out', icon: '↗', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdHtmlBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdHtmlBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(htmlBlockPlugin);

export { HTML_BLOCK_TAG, htmlBlockPlugin };
