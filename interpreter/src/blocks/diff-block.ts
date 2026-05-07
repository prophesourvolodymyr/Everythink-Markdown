import { Block, BlockPlugin, CodeBlockTag, getCodeBlockContent } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const DIFF_BLOCK_TAG = 'emd-diff-block';

export class EmdDiffBlock extends HTMLElement {
  private blockData: Block | null = null;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-diff');
    this.innerHTML = `
      <div class="emd-diff-toolbar">
        <button class="emd-diff-apply-btn" title="Apply diff">✓ Apply</button>
        <span class="emd-diff-stats"></span>
      </div>
      <div class="emd-diff-content"></div>
    `;

    this.querySelector('.emd-diff-apply-btn')!.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('diff-apply', { bubbles: true, composed: true }));
    });
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);

    const content = block.section ? getCodeBlockContent(block.section.content) ?? '' : '';
    this.renderDiff(content);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  private renderDiff(unifiedDiff: string): void {
    const contentEl = this.querySelector('.emd-diff-content')!;
    const statsEl = this.querySelector('.emd-diff-stats')!;

    const lines = unifiedDiff.split('\n');
    let added = 0;
    let removed = 0;

    contentEl.innerHTML = lines
      .map((line) => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          added++;
          return `<div class="emd-diff-line emd-diff-added">${this.escapeHtml(line)}</div>`;
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
          removed++;
          return `<div class="emd-diff-line emd-diff-removed">${this.escapeHtml(line)}</div>`;
        }
        if (line.startsWith('@@')) {
          return `<div class="emd-diff-line emd-diff-hunk">${this.escapeHtml(line)}</div>`;
        }
        return `<div class="emd-diff-line">${this.escapeHtml(line)}</div>`;
      })
      .join('');

    statsEl.textContent = `+${added} −${removed}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

if (!customElements.get(DIFF_BLOCK_TAG)) {
  customElements.define(DIFF_BLOCK_TAG, EmdDiffBlock);
}

const diffBlockPlugin: BlockPlugin = {
  id: 'diff-block',
  name: 'Diff Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Diff],
  component: EmdDiffBlock,
  toolbar: [
    { id: 'diff-apply', label: 'Apply', icon: '✓', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdDiffBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdDiffBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(diffBlockPlugin);

export { DIFF_BLOCK_TAG, diffBlockPlugin };
