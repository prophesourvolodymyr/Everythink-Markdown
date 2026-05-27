import type { BlockWidget, BlockWidgetContext } from '../types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createDiffWidget(
  content: string,
  _context: BlockWidgetContext
): BlockWidget {
  let container: HTMLElement | null = null;
  let currentContent = content;

  return {
    mount(el) {
      container = el;
      el.innerHTML = `<div class="emd-block-widget emd-block-placeholder">
        <div class="emd-block-widget-header">diff</div>
        <pre>${escapeHtml(currentContent)}</pre>
      </div>`;
    },
    update(newContent) {
      currentContent = newContent;
      if (container) {
        container.innerHTML = `<div class="emd-block-widget emd-block-placeholder">
          <div class="emd-block-widget-header">diff</div>
          <pre>${escapeHtml(newContent)}</pre>
        </div>`;
      }
    },
    destroy() {
      container = null;
    },
    getEstimatedHeight() {
      return 150;
    },
    eq(_other: BlockWidget) {
      return false;
    },
  };
}
