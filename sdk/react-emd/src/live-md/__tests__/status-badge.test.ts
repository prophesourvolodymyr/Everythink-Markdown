import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { buildStatusBadgeDecorations } from '../status-badge';
import {
  type StatusBadgeConfig,
  DEFAULT_STATUS_BADGE_CONFIG,
} from '../types';
import type { EmdDocument, EmdSection } from '@everthink/emd';

function makeSection(
  level: number,
  status: string | null,
  title: string,
  sourceStart: number
): EmdSection {
  return {
    level,
    section_type: 'task',
    status,
    title,
    content: [],
    subsections: [],
    source_span: { start: sourceStart, end: sourceStart + 30 },
    diagnostics: [],
    metadata: {
      status_override: null,
      depends_on: [],
      id: null,
    },
  };
}

function makeAst(sections: EmdSection[]): EmdDocument {
  return {
    sections,
    diagnostics: [],
    metadata: { title: null, version: null, owner: null },
  };
}

function getDecorations(
  doc: string,
  ast: EmdDocument | null,
  overrides: Partial<StatusBadgeConfig> = {}
): Range<Decoration>[] {
  const config = { ...DEFAULT_STATUS_BADGE_CONFIG, ...overrides };
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildStatusBadgeDecorations(tree, ast, config);
}

function hasWidgetDecorations(
  decos: Range<Decoration>[]
): boolean {
  return decos.some((d) => {
    const spec = (d.value as any)?.spec;
    return spec?.widget !== undefined;
  });
}

function getWidgetDecorations(
  decos: Range<Decoration>[]
): Range<Decoration>[] {
  return decos.filter((d) => {
    const spec = (d.value as any)?.spec;
    return spec?.widget !== undefined;
  });
}

describe('buildStatusBadgeDecorations', () => {
  it('renders a green dot widget for |done status', () => {
    const doc = '## [task|done] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'done', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('done');
    expect(widget.color).toBe('#22c55e');

    const dom = widget.toDOM();
    expect(dom.className).toContain('emd-status-dot');
    expect(widgets[0].from).toBe(doc.length);
  });

  it('renders an amber dot widget for |in-progress status', () => {
    const doc = '## [task|in-progress] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'in-progress', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('in-progress');
    expect(widget.color).toBe('#f59e0b');
  });

  it('renders a red dot widget for |blocked status', () => {
    const doc = '## [task|blocked] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'blocked', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('blocked');
    expect(widget.color).toBe('#ef4444');
  });

  it('renders a gray dot for |pending status', () => {
    const doc = '## [task|pending] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'pending', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('pending');
  });

  it('renders a gray dot for |archived status', () => {
    const doc = '## [task|archived] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'archived', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('archived');
    expect(widget.color).toBe('#6b7280');
  });

  it('renders a gray dot for |cancelled status', () => {
    const doc = '## [task|cancelled] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'cancelled', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('cancelled');
  });

  it('renders the unknown indicator for an unknown status', () => {
    const doc = '## [task|fubar] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'fubar', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const dom = (widgets[0].value as any).spec.widget.toDOM();
    expect(dom.className).toContain('emd-status-dot');
  });

  it('produces no decoration when section has null status', () => {
    const doc = '## [task] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, null, 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    expect(hasWidgetDecorations(decos)).toBe(false);
  });

  it('produces no decoration when AST is null', () => {
    const doc = '## [task|done] Build UI';
    const decos = getDecorations(doc, null);
    expect(decos.length).toBe(0);
  });

  it('produces no decoration when config is disabled', () => {
    const doc = '## [task|done] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'done', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast, { enabled: false });
    expect(decos.length).toBe(0);
  });

  it('renders pill-shaped widget when mode is pill', () => {
    const doc = '## [task|done] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'done', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast, { mode: 'pill' });

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.status).toBe('done');

    const dom = widget.toDOM();
    expect(dom.className).toContain('emd-status-pill');
    expect(dom.style.borderRadius).toContain('10px');
    expect(dom.textContent).toBe('done');
  });

  it('decorates multiple headings in a single document', () => {
    const doc = [
      '# [task|done] First',
      '',
      'some text',
      '',
      '## [task|in-progress] Second',
      '',
      '### [task|blocked] Third',
    ].join('\n');

    const lines = doc.split('\n');
    const h1Start = 0;
    const h2Start = doc.indexOf('\n##');
    const h3Start = doc.indexOf('\n###');

    const section1 = makeSection(1, 'done', 'First', h1Start);
    const section2 = makeSection(2, 'in-progress', 'Second', h2Start + 1);
    const section3 = makeSection(3, 'blocked', 'Third', h3Start + 1);

    const ast = makeAst([section1, section2, section3]);
    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(3);

    const statuses = widgets.map(
      (d) => (d.value as any).spec.widget.status
    );
    expect(statuses).toContain('done');
    expect(statuses).toContain('in-progress');
    expect(statuses).toContain('blocked');
  });

  it('handles nested sections via subsections', () => {
    const doc = [
      '## [task|done] Parent',
      '',
      '### [task|in-progress] Child',
    ].join('\n');

    const headingStart1 = doc.indexOf('##');
    const headingStart2 = doc.indexOf('###');

    const childSection = makeSection(3, 'in-progress', 'Child', headingStart2);
    const parentSection = makeSection(2, 'done', 'Parent', headingStart1);
    parentSection.subsections = [childSection];

    const ast = makeAst([parentSection]);
    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(2);
  });

  it('does not decorate non-heading elements', () => {
    const doc = 'This is not a heading.\n\n## [task|done] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'done', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);
  });

  it('returns empty array when AST has no sections', () => {
    const doc = '## [task|done] Build UI';
    const ast = makeAst([]);
    const decos = getDecorations(doc, ast);
    expect(decos.length).toBe(0);
  });

  it('does not crash when section source_span does not match any heading', () => {
    const doc = '## [task|done] Build UI';
    const section = makeSection(2, 'done', 'Build UI', 9999);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    expect(hasWidgetDecorations(decos)).toBe(false);
  });
});
