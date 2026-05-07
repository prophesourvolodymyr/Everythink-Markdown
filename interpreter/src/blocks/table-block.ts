import { Block, BlockPlugin } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const TABLE_BLOCK_TAG = 'emd-table-block';

export class EmdTableBlock extends HTMLElement {
  private blockData: Block | null = null;
  private rows: string[][] = [];
  private sortColumn: number | null = null;
  private sortAsc = true;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-table');
    this.innerHTML = `
      <div class="emd-table-toolbar">
        <button class="emd-table-add-row" title="Add Row">+ Row</button>
        <button class="emd-table-add-col" title="Add Column">+ Col</button>
        <button class="emd-table-export-csv" title="Export CSV">⇩ CSV</button>
        <span class="emd-table-info"></span>
      </div>
      <div class="emd-table-wrapper">
        <table class="emd-table">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    this.querySelector('.emd-table-add-row')!.addEventListener('click', () => {
      if (this.rows.length === 0) return;
      this.rows.push(new Array(this.rows[0]!.length).fill(''));
      this.renderTable();
    });

    this.querySelector('.emd-table-add-col')!.addEventListener('click', () => {
      for (const row of this.rows) row.push('');
      this.renderTable();
    });

    this.querySelector('.emd-table-export-csv')!.addEventListener('click', () => {
      this.exportCSV();
    });
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
    this.parseTableContent(block);
    this.renderTable();
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  private parseTableContent(block: Block): void {
    this.rows = [];

    for (const el of block.section?.content ?? []) {
      if ('Text' in el) {
        const lines = el.Text.split('\n');
        for (const line of lines) {
          const cells = line.split('|').map((c) => c.trim()).filter((c) => c);
          if (cells.length > 0 && (
            cells.some((c) => /^[-:]+$/.test(c) === false) ||
            line.includes('---')
          )) {
            // Skip separator lines (|---|---|)
            const clean = cells.filter((c) => !/^[-:]+$/.test(c));
            if (clean.length > 0) this.rows.push(clean);
          }
        }
      }
    }
  }

  private renderTable(): void {
    const thead = this.querySelector('thead')!;
    const tbody = this.querySelector('tbody')!;
    const info = this.querySelector('.emd-table-info')!;

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (this.rows.length === 0) {
      info.textContent = 'Empty table';
      return;
    }

    info.textContent = `${this.rows.length} rows × ${this.rows[0]?.length ?? 0} cols`;

    const headerRow = this.rows[0]!;
    const bodyRows = this.rows.slice(1);

    const tr = document.createElement('tr');
    headerRow.forEach((cell, colIdx) => {
      const th = document.createElement('th');
      th.textContent = cell;
      th.className = 'emd-table-sortable';
      th.addEventListener('click', () => this.sortByColumn(colIdx));

      if (this.sortColumn === colIdx) {
        th.classList.add(this.sortAsc ? 'emd-table-sort-asc' : 'emd-table-sort-desc');
      }

      tr.appendChild(th);
    });
    thead.appendChild(tr);

    let displayRows = bodyRows;
    if (this.sortColumn !== null) {
      displayRows = [...bodyRows].sort((a, b) => {
        const va = a[this.sortColumn!] ?? '';
        const vb = b[this.sortColumn!] ?? '';
        const cmp = va.localeCompare(vb, undefined, { numeric: true });
        return this.sortAsc ? cmp : -cmp;
      });
    }

    displayRows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIdx) => {
        const td = document.createElement('td');
        if (this.sortColumn !== null) {
          td.textContent = cell;

          // Make cells editable
          td.addEventListener('dblclick', () => {
            td.contentEditable = 'true';
            td.focus();
            const range = document.createRange();
            range.selectNodeContents(td);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
          });

          td.addEventListener('blur', () => {
            td.contentEditable = 'false';
            const actualRowIdx = rowIdx + 1;
            if (this.rows[actualRowIdx]) {
              this.rows[actualRowIdx]![colIdx] = td.textContent ?? '';
            }
          });
        } else {
          td.textContent = cell;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  private sortByColumn(colIdx: number): void {
    if (this.sortColumn === colIdx) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = colIdx;
      this.sortAsc = true;
    }
    this.renderTable();
  }

  private exportCSV(): void {
    const csv = this.rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','),
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

if (!customElements.get(TABLE_BLOCK_TAG)) {
  customElements.define(TABLE_BLOCK_TAG, EmdTableBlock);
}

const tableBlockPlugin: BlockPlugin = {
  id: 'table-block',
  name: 'Table Block',
  version: '0.1.0',
  section_types: [],
  component: EmdTableBlock,
  toolbar: [
    { id: 'table-sort', label: 'Sort', icon: '↕', action: () => {} },
    { id: 'table-csv', label: 'Export CSV', icon: '⇩', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdTableBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdTableBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(tableBlockPlugin);

export { TABLE_BLOCK_TAG, tableBlockPlugin };
