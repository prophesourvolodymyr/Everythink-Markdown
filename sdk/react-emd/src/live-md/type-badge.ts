import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';
import type { TypeBadgeConfig } from './types';
import { DEFAULT_TYPE_BADGE_CONFIG } from './types';
import type { EmdDocument, EmdSection } from '@everthink/emd';

const HEADING_TYPES = new Set([
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
]);

class TypePillWidget extends WidgetType {
  constructor(
    private sectionType: string,
    private color: string
  ) {
    super();
  }

  eq(other: TypePillWidget): boolean {
    return this.sectionType === other.sectionType && this.color === other.color;
  }

  toDOM(): HTMLElement {
    const pill = document.createElement('span');
    pill.className = 'emd-type-badge';
    pill.style.cssText =
      `display:inline-block;padding:2px 6px;border-radius:4px;background:${this.color};color:#fff;font-size:0.75em;font-weight:600;margin-right:6px;vertical-align:middle;line-height:1.4;`;
    pill.textContent = this.sectionType;
    pill.title = this.sectionType;
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

export function buildTypeBadgeDecorations(
  tree: Tree,
  ast: EmdDocument | null,
  config: TypeBadgeConfig
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

    const sectionType = section.section_type;
    if (!sectionType) continue;

    const color =
      colors[sectionType] ?? DEFAULT_TYPE_BADGE_CONFIG.colors.unknown;

    const pos = cursor.from + section.level + 1;
    const widget = new TypePillWidget(sectionType, color);

    decorations.push(
      Decoration.widget({ widget, side: 1 }).range(pos)
    );
  } while (cursor.next());

  return decorations;
}
