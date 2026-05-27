import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';
import type { StatusBadgeConfig } from './types';
import { DEFAULT_STATUS_BADGE_CONFIG } from './types';
import type { EmdDocument, EmdSection } from '@everthink/emd';

const HEADING_TYPES = new Set([
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
]);

class StatusDotWidget extends WidgetType {
  constructor(
    private status: string,
    private color: string
  ) {
    super();
  }

  eq(other: StatusDotWidget): boolean {
    return this.status === other.status && this.color === other.color;
  }

  toDOM(): HTMLElement {
    const dot = document.createElement('span');
    dot.className = 'emd-status-badge emd-status-dot';
    dot.style.cssText =
      `display:inline-block;width:8px;height:8px;border-radius:50%;background:${this.color};margin-left:6px;vertical-align:middle;flex-shrink:0;`;
    dot.title = this.status;
    return dot;
  }
}

class StatusPillWidget extends WidgetType {
  constructor(
    private status: string,
    private color: string
  ) {
    super();
  }

  eq(other: StatusPillWidget): boolean {
    return this.status === other.status && this.color === other.color;
  }

  toDOM(): HTMLElement {
    const pill = document.createElement('span');
    pill.className = 'emd-status-badge emd-status-pill';
    pill.style.cssText =
      `display:inline-block;padding:0 6px;border-radius:10px;background:${this.color};color:#fff;font-size:0.7em;font-weight:600;margin-left:6px;vertical-align:middle;flex-shrink:0;line-height:1.4;`;
    pill.textContent = this.status;
    pill.title = this.status;
    return pill;
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

export function buildStatusBadgeDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: StatusBadgeConfig
): Range<Decoration>[] {
  if (!config.enabled || !ast) return [];

  const sectionMap = buildSectionMap(ast);
  const colors = config.colors;
  const decorations: Range<Decoration>[] = [];

  const cursor = tree.cursor();
  do {
    if (!HEADING_TYPES.has(cursor.type.name)) continue;

    const section = sectionMap.get(cursor.from);
    if (!section) continue;

    const status = section.status;
    if (!status) continue;

    const color = colors[status] ?? DEFAULT_STATUS_BADGE_CONFIG.colors.unknown;

    const widget =
      config.mode === 'pill'
        ? new StatusPillWidget(status, color)
        : new StatusDotWidget(status, color);

    decorations.push(
      Decoration.widget({ widget, side: 1 }).range(cursor.to)
    );
  } while (cursor.next());

  return decorations;
}
