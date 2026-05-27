import { Block, BlockPlugin, CodeBlockTag, SectionStatus, SectionType, getCodeBlockContent } from '@core/types';
import type { EmdSection } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const KANBAN_BLOCK_TAG = 'emd-kanban-block';

interface KanbanCard {
  id: string;
  title: string;
  status: string;
  dependsOn: string[];
  sectionIndex: number;
}

interface KanbanColumn {
  id: string;
  title: string;
  statusKey: string;
  wipLimit: number;
  cards: KanbanCard[];
}

interface KanbanConfig {
  columns: { id: string; title: string; statusKey: string; wipLimit: number }[];
  collapsedView: boolean;
}

const DEFAULT_COLUMNS: KanbanConfig['columns'] = [
  { id: 'backlog', title: 'Backlog', statusKey: 'task', wipLimit: 0 },
  { id: 'todo', title: 'To Do', statusKey: 'pending', wipLimit: 0 },
  { id: 'in-progress', title: 'In Progress', statusKey: 'in-progress', wipLimit: 5 },
  { id: 'done', title: 'Done', statusKey: 'done', wipLimit: 0 },
];

const COLUMN_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  'todo': '#3b82f6',
  'in-progress': '#f59e0b',
  done: '#22c55e',
};

function statusToColumnKey(status?: SectionStatus): string {
  if (!status || status === SectionStatus.Unknown) return 'task';
  const map: Record<string, string> = {
    pending: 'pending',
    'in-progress': 'in-progress',
    done: 'done',
    blocked: 'in-progress',
    archived: 'done',
    cancelled: 'done',
  };
  return map[status] ?? 'task';
}

function parseTaskSections(subsections: EmdSection[]): KanbanCard[] {
  return subsections
    .filter((s) => s.section_type === SectionType.Task)
    .map((s, i) => ({
      id: `card-${i}`,
      title: s.title,
      status: statusToColumnKey(s.status),
      dependsOn: s.metadata?.depends_on ?? [],
      sectionIndex: i,
    }));
}

export class EmdKanbanBlock extends HTMLElement {
  private blockData: Block | null = null;
  private boardEl!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private collapsedView = false;
  private columns: KanbanColumn[] = [];
  private columnConfig: KanbanConfig['columns'] = [...DEFAULT_COLUMNS];
  private dragCard: KanbanCard | null = null;
  private dragColumnId: string | null = null;
  private dragGhost: HTMLElement | null = null;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-kanban');
    this.setAttribute('tabindex', '0');

    this.innerHTML = `
      <div class="emd-kanban-header">
        <input type="text" class="emd-kanban-search" placeholder="Filter cards...">
        <button class="emd-kanban-collapse-btn" title="Toggle View">\u2261</button>
      </div>
      <div class="emd-kanban-board"></div>
    `;

    this.boardEl = this.querySelector('.emd-kanban-board')!;
    this.searchInput = this.querySelector('.emd-kanban-search')!;

    this.searchInput.addEventListener('input', () => this.renderBoard());

    this.querySelector('.emd-kanban-collapse-btn')!.addEventListener('click', () => {
      this.collapsedView = !this.collapsedView;
      this.querySelector('.emd-kanban-collapse-btn')!.textContent = this.collapsedView ? '\u25a1' : '\u2261';
      this.renderBoard();
    });

    this.initColumns();
    this.renderBoard();
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  loadContent(json: string): void {
    try {
      const config: KanbanConfig = JSON.parse(json);
      if (Array.isArray(config.columns)) {
        this.columnConfig = config.columns;
        this.collapsedView = config.collapsedView ?? false;
      }
    } catch {
      this.columnConfig = [...DEFAULT_COLUMNS];
    }
  }

  serialize(): string {
    const config: KanbanConfig = {
      columns: this.columnConfig,
      collapsedView: this.collapsedView,
    };
    return JSON.stringify(config, null, 2);
  }

  refreshFromSection(section?: EmdSection): void {
    const cards = parseTaskSections(section?.subsections ?? []);
    this.columns = this.columnConfig.map((cfg) => ({
      ...cfg,
      cards: cards.filter((c) => c.status === cfg.statusKey),
    }));
    this.renderBoard();
  }

  private initColumns(): void {
    this.columns = this.columnConfig.map((cfg) => ({
      ...cfg,
      cards: [],
    }));
  }

  private renderBoard(): void {
    const filter = this.searchInput.value.toLowerCase();

    this.boardEl.innerHTML = '';

    for (const col of this.columns) {
      const colEl = document.createElement('div');
      colEl.className = 'emd-kanban-column';
      colEl.dataset['columnId'] = col.id;

      const filteredCards = filter
        ? col.cards.filter((c) => c.title.toLowerCase().includes(filter))
        : col.cards;

      const overLimit = col.wipLimit > 0 && filteredCards.length > col.wipLimit;
      if (overLimit) {
        colEl.classList.add('emd-kanban-column-over-limit');
      }

      const color = COLUMN_COLORS[col.statusKey] ?? '#9ca3af';

      const header = document.createElement('div');
      header.className = 'emd-kanban-column-header';
      header.style.borderTopColor = color;
      header.innerHTML = `
        <span class="emd-kanban-column-title">${col.title}</span>
        <span class="emd-kanban-column-count" style="background:${color}">${filteredCards.length}</span>
      `;
      colEl.appendChild(header);

      const cardList = document.createElement('div');
      cardList.className = 'emd-kanban-card-list';
      cardList.dataset['columnId'] = col.id;

      if (filteredCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'emd-kanban-empty';
        empty.textContent = filter ? 'No matching cards' : 'No cards';
        cardList.appendChild(empty);
      } else {
        for (const card of filteredCards) {
          const cardEl = this.createCardElement(card, col);
          cardList.appendChild(cardEl);
        }
      }

      colEl.appendChild(cardList);

      const addBtn = document.createElement('button');
      addBtn.className = 'emd-kanban-add-card';
      addBtn.textContent = '+ Add Task';
      addBtn.addEventListener('click', () => {
        this.emitAddCard(col.statusKey);
      });
      colEl.appendChild(addBtn);

      colEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        colEl.classList.add('emd-kanban-column-drag-over');
      });

      colEl.addEventListener('dragleave', () => {
        colEl.classList.remove('emd-kanban-column-drag-over');
      });

      colEl.addEventListener('drop', (e) => {
        e.preventDefault();
        colEl.classList.remove('emd-kanban-column-drag-over');
        if (this.dragCard && this.dragColumnId !== col.id) {
          this.emitMoveCard(this.dragCard, this.dragColumnId!, col.id);
        }
        this.cleanupDrag();
      });

      this.boardEl.appendChild(colEl);
    }
  }

  private createCardElement(card: KanbanCard, col: KanbanColumn): HTMLElement {
    const cardEl = document.createElement('div');
    cardEl.className = 'emd-kanban-card';
    cardEl.draggable = true;
    cardEl.dataset['cardId'] = card.id;

    if (this.collapsedView) {
      cardEl.innerHTML = `
        <span class="emd-kanban-card-title">${this.escHtml(card.title)}</span>
        ${card.dependsOn.length > 0 ? `<span class="emd-kanban-card-meta">\u2192 ${card.dependsOn.length} deps</span>` : ''}
      `;
    } else {
      cardEl.innerHTML = `
        <div class="emd-kanban-card-header">
          <span class="emd-kanban-card-title">${this.escHtml(card.title)}</span>
          <span class="emd-kanban-card-status" style="background:${COLUMN_COLORS[card.status] ?? '#9ca3af'}">${col.title}</span>
        </div>
        ${card.dependsOn.length > 0 ? `<div class="emd-kanban-card-meta">Depends on: ${card.dependsOn.join(', ')}</div>` : ''}
      `;
    }

    cardEl.addEventListener('dragstart', (e) => {
      this.dragCard = card;
      this.dragColumnId = col.id;
      cardEl.classList.add('emd-kanban-card-dragging');
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', card.id);
    });

    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('emd-kanban-card-dragging');
      this.cleanupDrag();
    });

    cardEl.addEventListener('click', () => {
      this.emitCardClick(card);
    });

    return cardEl;
  }

  private cleanupDrag(): void {
    this.dragCard = null;
    this.dragColumnId = null;
    this.querySelectorAll('.emd-kanban-column-drag-over').forEach((el) =>
      el.classList.remove('emd-kanban-column-drag-over')
    );
  }

  private escHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  private emitAddCard(statusKey: string): void {
    const title = prompt(`New task for "${statusKey}" column:`);
    if (title?.trim()) {
      this.dispatchEvent(new CustomEvent('kanban-add-card', {
        detail: { title: title.trim(), statusKey },
        bubbles: true,
        composed: true,
      }));
    }
  }

  private emitMoveCard(card: KanbanCard, fromColumnId: string, toColumnId: string): void {
    const toCol = this.columnConfig.find((c) => c.id === toColumnId);
    if (!toCol) return;
    this.dispatchEvent(new CustomEvent('kanban-move-card', {
      detail: { card, fromColumnId, toColumnId, newStatusKey: toCol.statusKey },
      bubbles: true,
      composed: true,
    }));
  }

  private emitCardClick(card: KanbanCard): void {
    this.dispatchEvent(new CustomEvent('kanban-card-click', {
      detail: { card },
      bubbles: true,
      composed: true,
    }));
  }
}

if (!customElements.get(KANBAN_BLOCK_TAG)) {
  customElements.define(KANBAN_BLOCK_TAG, EmdKanbanBlock);
}

const kanbanBlockPlugin: BlockPlugin = {
  id: 'kanban-block',
  name: 'Kanban Board Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Kanban],
  component: EmdKanbanBlock,
  toolbar: [
    { id: 'kanban-refresh', label: 'Refresh', icon: '↻', action: () => {} },
    { id: 'kanban-collapse', label: 'Toggle View', icon: '≡', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdKanbanBlock) {
      element.setBlock(block);
      const content = block.section ? getCodeBlockContent(block.section.content) : undefined;
      if (content) {
        element.loadContent(content);
      }
      element.refreshFromSection(block.section);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdKanbanBlock) {
      element.setBlock(block);
      element.refreshFromSection(block.section);
    }
  },
};

registerBlockPlugin(kanbanBlockPlugin);

export { KANBAN_BLOCK_TAG, kanbanBlockPlugin };
export type { KanbanCard, KanbanColumn, KanbanConfig };
