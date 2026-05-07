import { Block, BlockState, BlockPlugin, SectionType } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const FALLBACK_BLOCK_TAG = 'emd-fallback-block';

export class EmdFallbackBlock extends HTMLElement {
  private blockData: Block | null = null;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-fallback');
    this.setAttribute('role', 'region');
    this.innerHTML = `
      <div class="emd-fallback-header">
        <span class="emd-fallback-type"></span>
        <span class="emd-fallback-title"></span>
      </div>
      <div class="emd-fallback-content"></div>
    `;
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);

    const typeEl = this.querySelector('.emd-fallback-type');
    const titleEl = this.querySelector('.emd-fallback-title');
    const contentEl = this.querySelector('.emd-fallback-content');

    if (typeEl && block.section) {
      typeEl.textContent = `[${block.section.section_type}]`;
    }

    if (titleEl && block.section) {
      titleEl.textContent = block.section.title;
    }

    if (contentEl && block.section) {
      contentEl.textContent = block.section.content
        .map((el) => {
          if ('Text' in el) return el.Text;
          if ('Paragraph' in el) return el.Paragraph;
          if ('CodeBlock' in el) return `[code: ${el.CodeBlock.content.slice(0, 50)}]`;
          if ('Link' in el) return `→ ${el.Link.relation}: ${el.Link.target}`;
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
  }

  getBlock(): Block | null {
    return this.blockData;
  }
}

if (!customElements.get(FALLBACK_BLOCK_TAG)) {
  customElements.define(FALLBACK_BLOCK_TAG, EmdFallbackBlock);
}

const fallbackBlockPlugin: BlockPlugin = {
  id: 'fallback-block',
  name: 'Fallback Block',
  version: '0.1.0',
  section_types: Object.values(SectionType),
  component: EmdFallbackBlock,
  onMount: (block, element) => {
    if (element instanceof EmdFallbackBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdFallbackBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(fallbackBlockPlugin);

export { FALLBACK_BLOCK_TAG, fallbackBlockPlugin };
