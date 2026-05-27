import type { EditorState, Extension } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';
import {
  foldService,
  foldEffect,
  foldedRanges,
  foldState,
} from '@codemirror/language';
import type { EmdDocument, EmdSection } from '@everthink/emd';
import type { SmartFoldsConfig, AutoFoldRule } from './types';
import { DEFAULT_TYPE_BADGE_CONFIG, DEFAULT_STATUS_BADGE_CONFIG } from './types';

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

function findSectionStartingAtOrContaining(
  flatSections: EmdSection[],
  lineStartPos: number,
  lineEndPos: number,
  docLength: number
): { from: number; to: number } | null {
  for (const section of flatSections) {
    const { start, end } = section.source_span;
    if (end <= start) continue;

    const headingLine = start;
    const sectionRangeEnd = end;

    if (headingLine >= lineStartPos && headingLine < lineEndPos) {
      if (sectionRangeEnd > headingLine) {
        return { from: headingLine, to: Math.min(sectionRangeEnd, docLength) };
      }
    }
  }
  return null;
}

export function emdFoldService(
  ast: EmdDocument | null
): (state: EditorState, lineStart: number, lineEnd: number) => {
  from: number;
  to: number;
} | null {
  return (state, lineStart, lineEnd) => {
    if (!ast) return null;

    const flatSections = flattenSections(ast.sections);
    const lineStartPos = Math.min(
      state.doc.line(lineStart + 1).from,
      state.doc.length
    );
    const lineEndPos =
      lineEnd + 1 <= state.doc.lines
        ? state.doc.line(lineEnd + 1).from
        : state.doc.length;

    return findSectionStartingAtOrContaining(
      flatSections,
      lineStartPos,
      lineEndPos,
      state.doc.length
    );
  };
}

export class SectionFoldWidget extends WidgetType {
  constructor(
    private sectionType: string,
    private status: string | null,
    private title: string,
    private config: SmartFoldsConfig
  ) {
    super();
  }

  eq(other: SectionFoldWidget): boolean {
    return (
      this.sectionType === other.sectionType &&
      this.status === other.status &&
      this.title === other.title
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'emd-section-fold-placeholder';
    container.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;vertical-align:middle;';

    if (this.config.showTypeBadgeOnFold) {
      const typeColor =
        DEFAULT_TYPE_BADGE_CONFIG.colors[this.sectionType] ??
        DEFAULT_TYPE_BADGE_CONFIG.colors.unknown;
      const badge = document.createElement('span');
      badge.className = 'emd-fold-type-badge';
      badge.textContent = this.sectionType;
      badge.style.cssText =
        `display:inline-block;padding:0 6px;border-radius:3px;background:${typeColor};color:#fff;font-size:0.7em;font-weight:600;line-height:1.4;flex-shrink:0;`;
      container.appendChild(badge);
    }

    if (this.config.showStatusDotOnFold && this.status) {
      const statusColor =
        DEFAULT_STATUS_BADGE_CONFIG.colors[this.status] ??
        DEFAULT_STATUS_BADGE_CONFIG.colors.unknown;
      const dot = document.createElement('span');
      dot.className = 'emd-fold-status-dot';
      dot.style.cssText =
        `display:inline-block;width:7px;height:7px;border-radius:50%;background:${statusColor};flex-shrink:0;`;
      dot.title = this.status;
      container.appendChild(dot);
    }

    const titleEl = document.createElement('span');
    titleEl.className = 'emd-fold-title';
    const max = this.config.foldPlaceholderMaxTitle;
    const displayTitle =
      this.title.length > max
        ? this.title.slice(0, max) + '…'
        : this.title;
    titleEl.textContent = displayTitle;
    titleEl.style.cssText =
      'color:var(--emd-text-secondary,#4b5563);font-size:0.85em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    container.appendChild(titleEl);

    return container;
  }
}

export function autoFoldMatchingSections(
  view: EditorView,
  ast: EmdDocument | null,
  rules: AutoFoldRule[]
): boolean {
  if (!ast || rules.length === 0) return false;

  const flatSections = flattenSections(ast.sections);
  const state = view.state;
  const alreadyFolded = foldedRanges(state);
  const foldedSet = new Set<string>();
  alreadyFolded.between(0, state.doc.length, (from, to) => {
    foldedSet.add(`${from}-${to}`);
    return false;
  });

  let foldedAny = false;
  const effects: ReturnType<typeof foldEffect.of>[] = [];

  for (const section of flatSections) {
    for (const rule of rules) {
      if (rule.type && section.section_type !== rule.type) continue;
      if (rule.status && section.status !== rule.status) continue;
      if (rule.level !== undefined && section.level !== rule.level) continue;

      const from = section.source_span.start;
      const to = section.source_span.end;
      if (to <= from) continue;

      const key = `${from}-${to}`;
      if (foldedSet.has(key)) continue;

      effects.push(foldEffect.of({ from, to }));
      foldedSet.add(key);
      foldedAny = true;
      break;
    }
  }

  if (effects.length > 0) {
    view.dispatch({ effects });
  }

  return foldedAny;
}

export function buildSmartFoldsExtension(
  ast: EmdDocument | null,
  config: SmartFoldsConfig
): Extension[] {
  if (!config.enabled || !ast) return [];

  const service = emdFoldService(ast);
  return [foldState, foldService.of(service)];
}
