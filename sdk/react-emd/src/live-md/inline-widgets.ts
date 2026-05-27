import type { Tree } from '@lezer/common';
import type { Range, EditorState } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';
import type { InlineWidgetsConfig } from './types';
import { getBlockResolverView } from './block-resolver';
import type { EmdDocument, EmdSection } from '@everthink/emd';

const HEADING_TYPES = new Set([
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
]);

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private markerFrom: number
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return (
      this.checked === other.checked && this.markerFrom === other.markerFrom
    );
  }

  toDOM(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'emd-inline-checkbox';
    input.checked = this.checked;
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const view = getBlockResolverView();
      if (view) {
        view.dispatch({
          changes: {
            from: this.markerFrom + 1,
            to: this.markerFrom + 2,
            insert: this.checked ? ' ' : 'x',
          },
        });
      }
    });
    return input;
  }
}

class ProgressBarWidget extends WidgetType {
  constructor(
    private total: number,
    private checked: number
  ) {
    super();
  }

  eq(other: ProgressBarWidget): boolean {
    return this.total === other.total && this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'emd-progress-bar';
    const pct =
      this.total > 0 ? Math.round((this.checked / this.total) * 100) : 0;

    const red =
      pct < 50 ? 239 : Math.round(239 - ((pct - 50) * (239 - 34)) / 50);
    const green =
      pct < 50
        ? Math.round(68 + (pct * (168 - 68)) / 50)
        : Math.round(168 + ((pct - 50) * (34 - 168)) / 50);
    const blue = 68;

    container.style.cssText =
      'display:flex;align-items:center;gap:6px;margin:4px 0;font-size:0.8em;';

    const track = document.createElement('div');
    track.style.cssText =
      'flex:1;height:6px;border-radius:3px;background:var(--emd-progress-track,#e5e7eb);overflow:hidden;';

    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:${pct}%;border-radius:3px;background:rgb(${red},${green},${blue});transition:width 0.3s;`;
    track.appendChild(fill);

    const label = document.createElement('span');
    label.textContent = `${this.checked}/${this.total}`;
    label.style.cssText =
      'color:var(--emd-progress-label,#6b7280);white-space:nowrap;';

    container.appendChild(track);
    container.appendChild(label);
    return container;
  }
}

class ApproveButtonWidget extends WidgetType {
  constructor(private headingPos: number) {
    super();
  }

  eq(_other: ApproveButtonWidget): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'emd-approve-buttons';
    container.style.cssText =
      'display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle;';

    const approve = document.createElement('button');
    approve.textContent = 'Approve';
    approve.className = 'emd-btn-approve';
    approve.style.cssText =
      'padding:2px 8px;border-radius:4px;border:1px solid var(--emd-accent,#2563eb);background:var(--emd-accent,#2563eb);color:#fff;cursor:pointer;font-size:0.75em;';
    approve.addEventListener('click', (e) => {
      e.stopPropagation();
      const view = getBlockResolverView();
      if (view) {
        const doc = view.state.doc;
        const line = doc.lineAt(this.headingPos);
        view.dispatch({
          changes: { from: line.to, insert: ' |done\n' },
        });
      }
    });

    const reject = document.createElement('button');
    reject.textContent = 'Reject';
    reject.className = 'emd-btn-reject';
    reject.style.cssText =
      'padding:2px 8px;border-radius:4px;border:1px solid #ef4444;background:#ef4444;color:#fff;cursor:pointer;font-size:0.75em;';
    reject.addEventListener('click', (e) => {
      e.stopPropagation();
      const view = getBlockResolverView();
      if (view) {
        const doc = view.state.doc;
        const line = doc.lineAt(this.headingPos);
        view.dispatch({
          changes: { from: line.to, insert: ' |cancelled\n' },
        });
      }
    });

    container.appendChild(approve);
    container.appendChild(reject);
    return container;
  }
}

function flattenSections(sections: EmdSection[]): EmdSection[] {
  const result: EmdSection[] = [];
  for (const section of sections) {
    result.push(section);
    if (section.subsections && section.subsections.length > 0) {
      result.push(...flattenSections(section.subsections));
    }
  }
  return result;
}

function buildSectionMap(ast: EmdDocument): Map<number, EmdSection> {
  const map = new Map<number, EmdSection>();
  const flatSections = flattenSections(ast.sections);
  for (const section of flatSections) {
    map.set(section.source_span.start, section);
  }
  return map;
}

function countCheckboxes(contentLines: unknown[]): {
  total: number;
  checked: number;
} {
  let total = 0;
  let checked = 0;
  for (const line of contentLines) {
    if (typeof line !== 'string') continue;
    const match = line.match(/^-\s+\[(.)\]/);
    if (match) {
      total++;
      if (match[1] !== ' ') checked++;
    }
  }
  return { total, checked };
}

function isInFencedCode(
  pos: number,
  ranges: Array<{ from: number; to: number }>
): boolean {
  for (const r of ranges) {
    if (pos >= r.from && pos < r.to) return true;
  }
  return false;
}

export function buildInlineWidgetDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: InlineWidgetsConfig,
  state: EditorState
): Range<Decoration>[] {
  if (!config.enabled) return [];

  const decorations: Range<Decoration>[] = [];

  const fencedCodeRanges: Array<{ from: number; to: number }> = [];
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'FencedCode') {
      fencedCodeRanges.push({ from: cursor.from, to: cursor.to });
    }
  } while (cursor.next());

  const sectionMap = ast ? buildSectionMap(ast) : null;

  const seenHeadings = new Set<number>();

  cursor.moveTo(0);
  do {
    const typeName = cursor.type.name;

    if (typeName === 'TaskMarker') {
      if (
        config.renderCheckboxes &&
        !isInFencedCode(cursor.from, fencedCodeRanges)
      ) {
        const markerText = state.doc.sliceString(cursor.from, cursor.to);
        const checked = markerText.includes('x') || markerText.includes('X');
        decorations.push(
          Decoration.widget({
            widget: new CheckboxWidget(checked, cursor.from),
            side: 1,
          }).range(cursor.from)
        );
      }
      continue;
    }

    if (HEADING_TYPES.has(typeName)) {
      if (isInFencedCode(cursor.from, fencedCodeRanges)) continue;

      const section = sectionMap?.get(cursor.from) ?? null;

      if (
        config.renderProgressBars &&
        section &&
        section.section_type === 'task'
      ) {
        const { total, checked } = countCheckboxes(section.content);
        if (total > 0 && !seenHeadings.has(cursor.from)) {
          seenHeadings.add(cursor.from);
          decorations.push(
            Decoration.widget({
              widget: new ProgressBarWidget(total, checked),
              side: 1,
            }).range(cursor.to)
          );
        }
      }

      if (
        config.renderApproveButtons &&
        section &&
        section.section_type === 'human' &&
        (!section.status || section.status === 'pending')
      ) {
        if (!seenHeadings.has(cursor.from)) {
          seenHeadings.add(cursor.from);
          decorations.push(
            Decoration.widget({
              widget: new ApproveButtonWidget(cursor.from),
              side: 1,
            }).range(cursor.to)
          );
        }
      }
    }
  } while (cursor.next());

  return decorations;
}
