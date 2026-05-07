import { Block, BlockPlugin, CodeBlockTag, getCodeBlockContent } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const KATEX_BLOCK_TAG = 'emd-katex-block';

let katexModule: typeof import('katex') | null = null;

async function loadKaTeX(): Promise<typeof import('katex')> {
  if (katexModule) return katexModule;
  katexModule = await import('katex');
  return katexModule;
}

export class EmdKatexBlock extends HTMLElement {
  private blockData: Block | null = null;
  private contentEl!: HTMLElement;
  private errorEl!: HTMLElement;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-katex');

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // KaTeX CSS is bundled; we reference the installed package
    this.innerHTML = `
      <div class="emd-katex-content"></div>
      <div class="emd-katex-error" style="display:none;color:var(--emd-error, #dc2626);padding:8px;font-family:var(--emd-mono);"></div>
    `;

    this.contentEl = this.querySelector('.emd-katex-content')!;
    this.errorEl = this.querySelector('.emd-katex-error')!;
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  async render(content: string): Promise<void> {
    if (!content.trim()) {
      this.contentEl.innerHTML = '';
      return;
    }

    try {
      const katex = await loadKaTeX();
      this.errorEl.style.display = 'none';

      const parts = this.parseMathBlocks(content);
      this.contentEl.innerHTML = '';

      for (const part of parts) {
        if (part.type === 'math-display') {
          const el = document.createElement('div');
          el.className = 'emd-katex-display';
          el.innerHTML = katex.renderToString(part.content, {
            displayMode: true,
            throwOnError: false,
            trust: false,
          });
          this.contentEl.appendChild(el);
        } else if (part.type === 'math-inline') {
          const el = document.createElement('span');
          el.className = 'emd-katex-inline';
          el.innerHTML = katex.renderToString(part.content, {
            displayMode: false,
            throwOnError: false,
            trust: false,
          });
          this.contentEl.appendChild(el);
        } else {
          const el = document.createElement('span');
          el.className = 'emd-katex-text';
          el.textContent = part.content;
          this.contentEl.appendChild(el);
        }
      }
    } catch (err) {
      this.errorEl.style.display = '';
      this.errorEl.textContent = `KaTeX error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private parseMathBlocks(
    source: string,
  ): { type: 'text' | 'math-inline' | 'math-display'; content: string }[] {
    const result: { type: 'text' | 'math-inline' | 'math-display'; content: string }[] = [];
    const regex = /\$\$([\s\S]*?)\$\$|\$(.*?)\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: source.slice(lastIndex, match.index) });
      }
      if (match[1] !== undefined) {
        result.push({ type: 'math-display', content: match[1].trim() });
      } else if (match[2] !== undefined) {
        result.push({ type: 'math-inline', content: match[2].trim() });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < source.length) {
      result.push({ type: 'text', content: source.slice(lastIndex) });
    }

    return result;
  }
}

if (!customElements.get(KATEX_BLOCK_TAG)) {
  customElements.define(KATEX_BLOCK_TAG, EmdKatexBlock);
}

const katexBlockPlugin: BlockPlugin = {
  id: 'katex-block',
  name: 'LaTeX Math Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Katex],
  component: EmdKatexBlock,
  toolbar: [
    { id: 'katex-enlarge', label: 'Enlarge', icon: 'A+', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdKatexBlock) {
      element.setBlock(block);
      const content = block.section ? getCodeBlockContent(block.section.content) : undefined;
      if (content) {
        element.render(content);
      }
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdKatexBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(katexBlockPlugin);

export { KATEX_BLOCK_TAG, katexBlockPlugin };
