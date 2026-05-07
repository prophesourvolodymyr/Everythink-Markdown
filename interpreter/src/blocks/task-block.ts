import { Block, BlockPlugin, CodeBlockTag } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const TASK_BLOCK_TAG = 'emd-task-block';

export class EmdTaskBlock extends HTMLElement {
  private blockData: Block | null = null;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-task');
    this.innerHTML = `
      <div class="emd-task-progress">
        <div class="emd-task-progress-bar"></div>
        <span class="emd-task-progress-text">0%</span>
      </div>
      <div class="emd-task-filter">
        <select class="emd-task-filter-select">
          <option value="all">All tasks</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
        <button class="emd-task-clear-completed" title="Clear completed">🗑 Clear done</button>
      </div>
      <ul class="emd-task-list"></ul>
    `;

    this.querySelector('.emd-task-filter-select')!.addEventListener('change', (e) => {
      this.renderTasks((e.target as HTMLSelectElement).value);
    });

    this.querySelector('.emd-task-clear-completed')!.addEventListener('click', () => {
      this.clearCompleted();
    });
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
    this.renderTasks('all');
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  private getTasks(): { text: string; done: boolean; index: number }[] {
    const tasks: { text: string; done: boolean; index: number }[] = [];
    let idx = 0;

    for (const el of this.blockData?.section?.content ?? []) {
      if ('Text' in el) {
        const lines = el.Text.split('\n');
        for (const line of lines) {
          const doneMatch = line.match(/^[-*]\s*\[([xX ])\]\s*(.*)/);
          if (doneMatch) {
            tasks.push({ text: doneMatch[2]!, done: doneMatch[1]!.toLowerCase() === 'x', index: idx++ });
          } else {
            const undoneMatch = line.match(/^[-*]\s+(.*)/);
            if (undoneMatch && line.trim().startsWith('-')) {
              tasks.push({ text: undoneMatch[1]!, done: false, index: idx++ });
            }
          }
        }
      }
      if ('List' in el) {
        for (const item of el.List) {
          if ('Text' in item) {
            const taskMatch = item.Text.match(/^\[([xX ])\]\s*(.*)/);
            if (taskMatch) {
              tasks.push({ text: taskMatch[2]!, done: taskMatch[1]!.toLowerCase() === 'x', index: idx++ });
            } else {
              tasks.push({ text: item.Text, done: false, index: idx++ });
            }
          }
        }
      }
    }

    return tasks;
  }

  private renderTasks(filter: string): void {
    const listEl = this.querySelector('.emd-task-list')!;
    const tasks = this.getTasks();
    const filtered = filter === 'all' ? tasks : filter === 'done' ? tasks.filter((t) => t.done) : tasks.filter((t) => !t.done);

    const doneCount = tasks.filter((t) => t.done).length;
    const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

    const bar = this.querySelector('.emd-task-progress-bar') as HTMLElement;
    const text = this.querySelector('.emd-task-progress-text')!;
    bar.style.width = `${pct}%`;
    text.textContent = `${pct}%`;

    listEl.innerHTML = filtered
      .map(
        (t) => `
      <li class="emd-task-item ${t.done ? 'emd-task-done' : ''}" data-index="${t.index}">
        <input type="checkbox" class="emd-task-checkbox" ${t.done ? 'checked' : ''}>
        <span class="emd-task-text ${t.done ? 'emd-task-strikethrough' : ''}">${this.escapeHtml(t.text)}</span>
        <button class="emd-task-delete" title="Delete">×</button>
      </li>`,
      )
      .join('');

    listEl.querySelectorAll('.emd-task-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const li = (e.target as HTMLElement).closest('.emd-task-item')!;
        const checked = (e.target as HTMLInputElement).checked;
        li.classList.toggle('emd-task-done', checked);
        const span = li.querySelector('.emd-task-text')!;
        span.classList.toggle('emd-task-strikethrough', checked);
        this.updateProgress();
      });
    });

    listEl.querySelectorAll('.emd-task-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        (e.target as HTMLElement).closest('.emd-task-item')!.remove();
        this.updateProgress();
      });
    });
  }

  private updateProgress(): void {
    const total = this.querySelectorAll('.emd-task-item').length;
    const done = this.querySelectorAll('.emd-task-done').length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const bar = this.querySelector('.emd-task-progress-bar') as HTMLElement;
    const text = this.querySelector('.emd-task-progress-text')!;
    bar.style.width = `${pct}%`;
    text.textContent = `${pct}%`;
  }

  private clearCompleted(): void {
    this.querySelectorAll('.emd-task-done').forEach((el) => el.remove());
    this.updateProgress();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

if (!customElements.get(TASK_BLOCK_TAG)) {
  customElements.define(TASK_BLOCK_TAG, EmdTaskBlock);
}

const taskBlockPlugin: BlockPlugin = {
  id: 'task-block',
  name: 'Task Checklist Block',
  version: '0.1.0',
  section_types: ['task' as any, 'verify' as any],
  component: EmdTaskBlock,
  toolbar: [
    { id: 'task-filter', label: 'Filter', icon: '⊞', action: () => {} },
    { id: 'task-clear', label: 'Clear Completed', icon: '🗑', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdTaskBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdTaskBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(taskBlockPlugin);

export { TASK_BLOCK_TAG, taskBlockPlugin };
