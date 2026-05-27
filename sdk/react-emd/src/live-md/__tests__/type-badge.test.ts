import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { buildTypeBadgeDecorations } from '../type-badge';
import {
  type TypeBadgeConfig,
  DEFAULT_TYPE_BADGE_CONFIG,
} from '../types';
import type { EmdDocument, EmdSection } from '@everthink/emd';

function makeSection(
  level: number,
  sectionType: string,
  title: string,
  sourceStart: number
): EmdSection {
  return {
    level,
    section_type: sectionType,
    status: null,
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
  overrides: Partial<TypeBadgeConfig> = {}
): Range<Decoration>[] {
  const config = { ...DEFAULT_TYPE_BADGE_CONFIG, ...overrides };
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildTypeBadgeDecorations(tree, ast, config);
}

function getWidgetDecorations(
  decos: Range<Decoration>[]
): Range<Decoration>[] {
  return decos.filter((d) => {
    const spec = (d.value as any)?.spec;
    return spec?.widget !== undefined;
  });
}

describe('buildTypeBadgeDecorations', () => {
  it('[task] section produces a pill with correct color', () => {
    const doc = '## [task] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'task', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.sectionType).toBe('task');

    const dom = widget.toDOM();
    expect(dom.className).toContain('emd-type-badge');
    expect(dom.textContent).toBe('task');
  });

  it('[decision] section produces a pill with correct color', () => {
    const doc = '## [decision] Choose architecture';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'decision', 'Choose architecture', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.sectionType).toBe('decision');

    const dom = widget.toDOM();
    expect(dom.textContent).toBe('decision');
  });

  it('[api] section produces a pill with correct color', () => {
    const doc = '## [api] REST endpoints';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'api', 'REST endpoints', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.sectionType).toBe('api');
  });

  it('section with empty section_type produces no decoration', () => {
    const doc = '## No type section';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, '', 'No type section', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });

  it('AST is null returns []', () => {
    const doc = '## [task] Build UI';
    const decos = getDecorations(doc, null);
    expect(decos.length).toBe(0);
  });

  it('disabled config produces no decorations', () => {
    const doc = '## [task] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'task', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast, { enabled: false });
    expect(decos.length).toBe(0);
  });

  it('multiple headings in one document get correct type badges', () => {
    const doc = [
      '# [task] First',
      '',
      'some text',
      '',
      '## [decision] Second',
      '',
      '### [api] Third',
    ].join('\n');

    const h1Start = 0;
    const h2Start = doc.indexOf('\n##') + 1;
    const h3Start = doc.indexOf('\n###') + 1;

    const section1 = makeSection(1, 'task', 'First', h1Start);
    const section2 = makeSection(2, 'decision', 'Second', h2Start);
    const section3 = makeSection(3, 'api', 'Third', h3Start);

    const ast = makeAst([section1, section2, section3]);
    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(3);

    const types = widgets.map(
      (d) => (d.value as any).spec.widget.sectionType
    );
    expect(types).toContain('task');
    expect(types).toContain('decision');
    expect(types).toContain('api');
  });

  it('nested sections via subsections get correct type badges', () => {
    const doc = [
      '## [task] Parent',
      '',
      '### [spec] Child',
    ].join('\n');

    const headingStart1 = doc.indexOf('##');
    const headingStart2 = doc.indexOf('###');

    const childSection = makeSection(3, 'spec', 'Child', headingStart2);
    const parentSection = makeSection(2, 'task', 'Parent', headingStart1);
    parentSection.subsections = [childSection];

    const ast = makeAst([parentSection]);
    const decos = getDecorations(doc, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(2);

    const types = widgets.map(
      (d) => (d.value as any).spec.widget.sectionType
    );
    expect(types).toContain('task');
    expect(types).toContain('spec');
  });

  it('unknown custom section types get the default unknown color', () => {
    const doc = '## [customtype] Something custom';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'customtype', 'Something custom', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.sectionType).toBe('customtype');
    expect(widget.color).toBe(DEFAULT_TYPE_BADGE_CONFIG.colors.unknown);
  });

  it('does not decorate non-heading elements', () => {
    const doc = 'This is not a heading.\n\n## [task] Build UI';
    const headingStart = doc.indexOf('##');
    const section = makeSection(2, 'task', 'Build UI', headingStart);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);
  });

  it('returns empty array when AST has no sections', () => {
    const doc = '## [task] Build UI';
    const ast = makeAst([]);
    const decos = getDecorations(doc, ast);
    expect(decos.length).toBe(0);
  });

  it('does not crash when section source_span does not match any heading', () => {
    const doc = '## [task] Build UI';
    const section = makeSection(2, 'task', 'Build UI', 9999);
    const ast = makeAst([section]);

    const decos = getDecorations(doc, ast);
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });
});
