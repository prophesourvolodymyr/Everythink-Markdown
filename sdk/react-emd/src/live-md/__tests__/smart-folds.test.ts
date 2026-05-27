import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
  foldService,
  foldable,
  foldEffect,
  foldedRanges,
  foldState,
} from '@codemirror/language';
import {
  emdFoldService,
  flattenSections,
  autoFoldMatchingSections,
  buildSmartFoldsExtension,
  buildFoldWidgetDecorations,
  SectionFoldWidget,
} from '../smart-folds';
import {
  type SmartFoldsConfig,
  type AutoFoldRule,
  DEFAULT_SMART_FOLDS_CONFIG,
} from '../types';
import type { EmdDocument, EmdSection } from '@everthink/emd';

function makeSection(
  overrides: Partial<EmdSection> = {}
): EmdSection {
  return {
    level: 2,
    section_type: 'task',
    status: null,
    title: 'Section Title',
    content: [],
    subsections: [],
    source_span: { start: 0, end: 30 },
    diagnostics: [],
    metadata: {
      status_override: null,
      depends_on: [],
      id: null,
    },
    ...overrides,
  };
}

function makeAst(sections: EmdSection[]): EmdDocument {
  return {
    sections,
    diagnostics: [],
    metadata: { title: null, version: null, owner: null },
  };
}

function makeConfig(
  overrides: Partial<SmartFoldsConfig> = {}
): SmartFoldsConfig {
  return { ...DEFAULT_SMART_FOLDS_CONFIG, ...overrides };
}

function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
}

describe('emdFoldService', () => {
  it('returns fold range when section heading is within the queried line range', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n- [x] Task 2\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'My Tasks',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const state = createState(doc);
    const service = emdFoldService(ast);

    const result = service(state, 0, 1);

    expect(result).not.toBeNull();
    expect(result!.from).toBe(headingStart);
    expect(result!.to).toBe(doc.length);
  });

  it('returns null when AST is null', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n';
    const state = createState(doc);
    const service = emdFoldService(null);

    const result = service(state, 0, 1);

    expect(result).toBeNull();
  });

  it('returns null when no section heading is in the queried line range', () => {
    const doc = '## [task] Section 1\n\ncontent\n\n## [task] Section 2\n\nmore\n';
    const heading2Start = doc.indexOf('## [task] Section 2');
    const section1 = makeSection({
      section_type: 'task',
      title: 'Section 1',
      level: 2,
      source_span: { start: doc.indexOf('##'), end: doc.indexOf('## [task] Section 2') },
    });
    const section2 = makeSection({
      section_type: 'task',
      title: 'Section 2',
      level: 2,
      source_span: { start: heading2Start, end: doc.length },
    });
    const ast = makeAst([section1, section2]);
    const state = createState(doc);
    const service = emdFoldService(ast);

    // Query lines that don't contain a heading
    const result = service(state, 1, 2);

    // Section 1 heading is line 0, Section 2 is line 3
    // Lines 1-2 contain only section 1 content, no heading
    expect(result).toBeNull();
  });

  it('fold range from matches section.source_span.start', () => {
    const doc = '## [spec] API Design\n\nThis is the spec content.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'spec',
      title: 'API Design',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const state = createState(doc);
    const service = emdFoldService(ast);

    const result = service(state, 0, 1);

    expect(result).not.toBeNull();
    expect(result!.from).toBe(section.source_span.start);
  });

  it('fold range to matches section.source_span.end', () => {
    const doc = '## [task] Project Tasks\n\n- [ ] Task A\n- [x] Task B\n\nExtra text\n';
    const headingStart = doc.indexOf('##');
    const sectionEnd = doc.indexOf('Extra text') + 'Extra text\n'.length;
    const section = makeSection({
      section_type: 'task',
      title: 'Project Tasks',
      level: 2,
      source_span: { start: headingStart, end: sectionEnd },
    });
    const ast = makeAst([section]);
    const state = createState(doc);
    const service = emdFoldService(ast);

    const result = service(state, 0, 1);

    expect(result).not.toBeNull();
    expect(result!.to).toBe(section.source_span.end);
  });
});

describe('autoFoldMatchingSections', () => {
  it('folds sections matching a type rule', () => {
    const doc = '## [task] Buy Milk\n\n- [ ] Get milk\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Buy Milk',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);

    const parent = document.createElement('div');
    const view = new EditorView({
      doc,
      parent,
      extensions: [
        markdown({ base: markdownLanguage }),
        foldState,
        foldService.of(emdFoldService(ast)),
      ],
    });

    try {
      const rules: AutoFoldRule[] = [{ type: 'task' }];
      const result = autoFoldMatchingSections(view, ast, rules);

      expect(result).toBe(true);

      const folded = foldedRanges(view.state);
      const ranges: Array<{ from: number; to: number }> = [];
      folded.between(0, doc.length, (from, to) => {
        ranges.push({ from, to });
        return false;
      });
      expect(ranges.length).toBe(1);
      expect(ranges[0].from).toBe(headingStart);
      expect(ranges[0].to).toBe(doc.length);
    } finally {
      view.destroy();
    }
  });

  it('folds sections matching a status rule', () => {
    const doc = '## [task|done] Completed Task\n\n- [x] Task 1\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      status: 'done',
      title: 'Completed Task',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);

    const parent = document.createElement('div');
    const view = new EditorView({
      doc,
      parent,
      extensions: [
        markdown({ base: markdownLanguage }),
        foldState,
        foldService.of(emdFoldService(ast)),
      ],
    });

    try {
      const rules: AutoFoldRule[] = [{ status: 'done' }];
      const result = autoFoldMatchingSections(view, ast, rules);

      expect(result).toBe(true);

      const folded = foldedRanges(view.state);
      const ranges: Array<{ from: number; to: number }> = [];
      folded.between(0, doc.length, (from, to) => {
        ranges.push({ from, to });
        return false;
      });
      expect(ranges.length).toBe(1);
    } finally {
      view.destroy();
    }
  });

  it('folds sections matching combined type + status rule', () => {
    const doc = '## [task|done] Done Task\n\n## [task] Pending Task\n';
    const doneStart = doc.indexOf('##');
    const pendingStart = doc.indexOf('## [task] Pending');
    const doneSection = makeSection({
      section_type: 'task',
      status: 'done',
      title: 'Done Task',
      level: 2,
      source_span: { start: doneStart, end: pendingStart },
    });
    const pendingSection = makeSection({
      section_type: 'task',
      title: 'Pending Task',
      level: 2,
      source_span: { start: pendingStart, end: doc.length },
    });
    const ast = makeAst([doneSection, pendingSection]);

    const parent = document.createElement('div');
    const view = new EditorView({
      doc,
      parent,
      extensions: [
        markdown({ base: markdownLanguage }),
        foldState,
        foldService.of(emdFoldService(ast)),
      ],
    });

    try {
      const rules: AutoFoldRule[] = [{ type: 'task', status: 'done' }];
      const result = autoFoldMatchingSections(view, ast, rules);

      expect(result).toBe(true);

      const folded = foldedRanges(view.state);
      const ranges: Array<{ from: number; to: number }> = [];
      folded.between(0, doc.length, (from, to) => {
        ranges.push({ from, to });
        return false;
      });
      // Only the done section should be folded
      expect(ranges.length).toBe(1);
      expect(ranges[0].from).toBe(doneStart);
    } finally {
      view.destroy();
    }
  });

  it('does not fold sections that do not match any rule', () => {
    const doc = '## [task] Active Task\n\n## [spec] Spec Doc\n';
    const taskStart = doc.indexOf('##');
    const specStart = doc.indexOf('## [spec]');
    const taskSection = makeSection({
      section_type: 'task',
      title: 'Active Task',
      level: 2,
      source_span: { start: taskStart, end: specStart },
    });
    const specSection = makeSection({
      section_type: 'spec',
      title: 'Spec Doc',
      level: 2,
      source_span: { start: specStart, end: doc.length },
    });
    const ast = makeAst([taskSection, specSection]);

    const parent = document.createElement('div');
    const view = new EditorView({
      doc,
      parent,
      extensions: [
        markdown({ base: markdownLanguage }),
        foldState,
        foldService.of(emdFoldService(ast)),
      ],
    });

    try {
      const rules: AutoFoldRule[] = [{ type: 'bug' }];
      const result = autoFoldMatchingSections(view, ast, rules);

      expect(result).toBe(false);

      const folded = foldedRanges(view.state);
      const ranges: Array<{ from: number; to: number }> = [];
      folded.between(0, doc.length, (from, to) => {
        ranges.push({ from, to });
        return false;
      });
      expect(ranges.length).toBe(0);
    } finally {
      view.destroy();
    }
  });

  it('with empty rules array does nothing', () => {
    const doc = '## [task] My Task\n\ncontent\n';
    const section = makeSection({
      section_type: 'task',
      title: 'My Task',
      level: 2,
      source_span: { start: 0, end: doc.length },
    });
    const ast = makeAst([section]);

    const parent = document.createElement('div');
    const view = new EditorView({
      doc,
      parent,
      extensions: [
        markdown({ base: markdownLanguage }),
        foldState,
        foldService.of(emdFoldService(ast)),
      ],
    });

    try {
      const result = autoFoldMatchingSections(view, ast, []);

      expect(result).toBe(false);

      const folded = foldedRanges(view.state);
      const ranges: Array<{ from: number; to: number }> = [];
      folded.between(0, doc.length, (from, to) => {
        ranges.push({ from, to });
        return false;
      });
      expect(ranges.length).toBe(0);
    } finally {
      view.destroy();
    }
  });

  it('handles null AST gracefully', () => {
    const doc = '## [task] My Task\n\ncontent\n';
    const parent = document.createElement('div');
    const view = new EditorView({
      doc,
      parent,
      extensions: [
        markdown({ base: markdownLanguage }),
      ],
    });

    try {
      const rules: AutoFoldRule[] = [{ type: 'task' }];
      const result = autoFoldMatchingSections(view, null, rules);

      expect(result).toBe(false);
    } finally {
      view.destroy();
    }
  });
});

describe('SectionFoldWidget', () => {
  it('toDOM shows type badge when showTypeBadgeOnFold is true', () => {
    const config = makeConfig({ showTypeBadgeOnFold: true });
    const widget = new SectionFoldWidget('task', null, 'My Task', config);
    const dom = widget.toDOM();

    expect(dom.className).toBe('emd-section-fold-placeholder');
    const badge = dom.querySelector('.emd-fold-type-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('task');
  });

  it('toDOM hides type badge when showTypeBadgeOnFold is false', () => {
    const config = makeConfig({ showTypeBadgeOnFold: false });
    const widget = new SectionFoldWidget('task', null, 'My Task', config);
    const dom = widget.toDOM();

    const badge = dom.querySelector('.emd-fold-type-badge');
    expect(badge).toBeNull();
  });

  it('toDOM shows status dot when status is non-null and showStatusDotOnFold is true', () => {
    const config = makeConfig({ showStatusDotOnFold: true });
    const widget = new SectionFoldWidget('task', 'done', 'My Task', config);
    const dom = widget.toDOM();

    const dot = dom.querySelector('.emd-fold-status-dot');
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).title).toBe('done');
  });

  it('toDOM hides status dot when showStatusDotOnFold is false', () => {
    const config = makeConfig({ showStatusDotOnFold: false });
    const widget = new SectionFoldWidget('task', 'done', 'My Task', config);
    const dom = widget.toDOM();

    const dot = dom.querySelector('.emd-fold-status-dot');
    expect(dot).toBeNull();
  });

  it('toDOM shows truncated title when title exceeds foldPlaceholderMaxTitle', () => {
    const config = makeConfig({ foldPlaceholderMaxTitle: 10 });
    const widget = new SectionFoldWidget(
      'task',
      null,
      'This is a very long section title that should be truncated',
      config
    );
    const dom = widget.toDOM();

    const titleEl = dom.querySelector('.emd-fold-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent!.length).toBeLessThanOrEqual(11); // 10 + "…"
    expect(titleEl!.textContent).toContain('…');
  });

  it('toDOM shows full title when title does not exceed max', () => {
    const config = makeConfig({ foldPlaceholderMaxTitle: 50 });
    const widget = new SectionFoldWidget('task', null, 'Short Title', config);
    const dom = widget.toDOM();

    const titleEl = dom.querySelector('.emd-fold-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('Short Title');
  });

  it('eq returns true for same section type, title, and status', () => {
    const config = makeConfig();
    const widget1 = new SectionFoldWidget('task', 'done', 'My Task', config);
    const widget2 = new SectionFoldWidget('task', 'done', 'My Task', config);

    expect(widget1.eq(widget2)).toBe(true);
  });

  it('eq returns false for different section type', () => {
    const config = makeConfig();
    const widget1 = new SectionFoldWidget('task', 'done', 'My Task', config);
    const widget2 = new SectionFoldWidget('spec', 'done', 'My Task', config);

    expect(widget1.eq(widget2)).toBe(false);
  });

  it('eq returns false for different status', () => {
    const config = makeConfig();
    const widget1 = new SectionFoldWidget('task', 'done', 'My Task', config);
    const widget2 = new SectionFoldWidget('task', 'pending', 'My Task', config);

    expect(widget1.eq(widget2)).toBe(false);
  });

  it('eq returns false for different title', () => {
    const config = makeConfig();
    const widget1 = new SectionFoldWidget('task', 'done', 'My Task', config);
    const widget2 = new SectionFoldWidget('task', 'done', 'Other Task', config);

    expect(widget1.eq(widget2)).toBe(false);
  });
});

describe('buildSmartFoldsExtension', () => {
  it('returns an extension containing foldService when enabled and AST is provided', () => {
    const doc = '## [task] Test\n\ncontent\n';
    const section = makeSection({
      section_type: 'task',
      title: 'Test',
      level: 2,
      source_span: { start: 0, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });

    const ext = buildSmartFoldsExtension(ast, config);
    expect(ext.length).toBeGreaterThan(0);
  });

  it('returns empty array when disabled', () => {
    const section = makeSection();
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: false });

    const ext = buildSmartFoldsExtension(ast, config);
    expect(ext.length).toBe(0);
  });

  it('returns empty array when AST is null', () => {
    const config = makeConfig({ enabled: true });
    const ext = buildSmartFoldsExtension(null, config);
    expect(ext.length).toBe(0);
  });
});

function createFoldedState(
  doc: string,
  folds: Array<{ from: number; to: number }>
): EditorState {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage }), foldState],
  });

  for (const f of folds) {
    const tr = state.update({
      effects: foldEffect.of(f),
    });
    state = tr.state;
  }

  return state;
}

describe('buildFoldWidgetDecorations', () => {
  it('returns empty array when config is disabled', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n';
    const section = makeSection({
      section_type: 'task',
      title: 'My Tasks',
      level: 2,
      source_span: { start: 0, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: false });
    const state = createFoldedState(doc, [{ from: 0, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result).toEqual([]);
  });

  it('returns empty array when AST is null', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n';
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: 0, to: doc.length }]);

    const result = buildFoldWidgetDecorations(null, config, state);
    expect(result).toEqual([]);
  });

  it('returns empty array when no sections are folded', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n';
    const section = makeSection({
      section_type: 'task',
      title: 'My Tasks',
      level: 2,
      source_span: { start: 0, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, []);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result).toEqual([]);
  });

  it('produces a Decoration.replace for a folded section', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'My Tasks',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result.length).toBe(1);
    expect(result[0].from).toBe(headingStart);
    expect(result[0].to).toBe(doc.length);
    expect(result[0].value.spec.widget).not.toBeNull();
  });

  it('decoration widget is a SectionFoldWidget with correct section_type', () => {
    const doc = '## [spec] API Design\n\nREST API spec.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'spec',
      title: 'API Design',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result.length).toBe(1);
    const widget = result[0].value.spec.widget as SectionFoldWidget;
    expect(widget).toBeInstanceOf(SectionFoldWidget);
    expect(widget.eq(new SectionFoldWidget('spec', null, 'API Design', config))).toBe(true);
  });

  it('decoration widget has the correct title', () => {
    const doc = '## [task] Grocery Shopping\n\nBuy milk and eggs.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Grocery Shopping',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    const widget = result[0].value.spec.widget as SectionFoldWidget;
    const dom = widget.toDOM();
    const titleEl = dom.querySelector('.emd-fold-title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('Grocery Shopping');
  });

  it('decoration widget has the correct status', () => {
    const doc = '## [task|done] Completed\n\nAll done.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      status: 'done',
      title: 'Completed',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true, showStatusDotOnFold: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    const widget = result[0].value.spec.widget as SectionFoldWidget;
    const dom = widget.toDOM();
    const dot = dom.querySelector('.emd-fold-status-dot');
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).title).toBe('done');
  });

  it('decoration range matches the fold range', () => {
    const doc = '## [task] Section\n\nContent here.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Section',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result[0].from).toBe(headingStart);
    expect(result[0].to).toBe(doc.length);
  });

  it('folded section produces decoration with correct from/to matching fold range', () => {
    const doc =
      '## [task] Task A\n\nContent A.\n\n## [spec] Spec B\n\nContent B.\n';
    const taskStart = doc.indexOf('## [task]');
    const specStart = doc.indexOf('## [spec]');
    const taskSection = makeSection({
      section_type: 'task',
      title: 'Task A',
      level: 2,
      source_span: { start: taskStart, end: specStart },
    });
    const specSection = makeSection({
      section_type: 'spec',
      title: 'Spec B',
      level: 2,
      source_span: { start: specStart, end: doc.length },
    });
    const ast = makeAst([taskSection, specSection]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [
      { from: taskStart, to: specStart },
    ]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result.length).toBe(1);
    expect(result[0].from).toBe(taskStart);
    expect(result[0].to).toBe(specStart);
    expect(result[0].value.spec.widget).toBeInstanceOf(SectionFoldWidget);
  });

  it('unfolded sections produce no decorations', () => {
    const doc =
      '## [task] Task A\n\nContent A.\n\n## [spec] Spec B\n\nContent B.\n';
    const taskStart = doc.indexOf('## [task]');
    const specStart = doc.indexOf('## [spec]');
    const taskSection = makeSection({
      section_type: 'task',
      title: 'Task A',
      level: 2,
      source_span: { start: taskStart, end: specStart },
    });
    const specSection = makeSection({
      section_type: 'spec',
      title: 'Spec B',
      level: 2,
      source_span: { start: specStart, end: doc.length },
    });
    const ast = makeAst([taskSection, specSection]);
    const config = makeConfig({ enabled: true });
    // Only fold task A, not spec B
    const state = createFoldedState(doc, [
      { from: taskStart, to: specStart },
    ]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result.length).toBe(1);
    expect(result[0].from).toBe(taskStart);
  });

  it('Decoration.replace uses block: false', () => {
    const doc = '## [task] Section\n\nContent.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Section',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result[0].value.spec.block).toBe(false);
  });

  it('Decoration.replace uses inclusive: false', () => {
    const doc = '## [task] Section\n\nContent.\n';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Section',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [{ from: headingStart, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result[0].value.spec.inclusive).toBe(false);
  });

  it('sub-sections that are folded also produce decorations', () => {
    const doc =
      '## [task] Parent\n\nParent content.\n\n### [task] Child\n\nChild content.\n';
    const parentStart = doc.indexOf('## [task] Parent');
    const childStart = doc.indexOf('### [task] Child');
    const child = makeSection({
      section_type: 'task',
      title: 'Child',
      level: 3,
      source_span: { start: childStart, end: doc.length },
    });
    const parent = makeSection({
      section_type: 'task',
      title: 'Parent',
      level: 2,
      source_span: { start: parentStart, end: doc.length },
      subsections: [child],
    });
    const ast = makeAst([parent]);
    const config = makeConfig({ enabled: true });
    const state = createFoldedState(doc, [
      { from: childStart, to: doc.length },
    ]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result.length).toBe(1);
    expect(result[0].from).toBe(childStart);
    const widget = result[0].value.spec.widget as SectionFoldWidget;
    expect(widget.eq(new SectionFoldWidget('task', null, 'Child', config))).toBe(true);
  });

  it('does not produce decoration when fold range does not match any section start', () => {
    const doc = '## [task] My Tasks\n\n- [ ] Task 1\n';
    const section = makeSection({
      section_type: 'task',
      title: 'My Tasks',
      level: 2,
      source_span: { start: 0, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: true });
    // Fold range starts at position 5, which is not a section start
    const state = createFoldedState(doc, [{ from: 5, to: doc.length }]);

    const result = buildFoldWidgetDecorations(ast, config, state);
    expect(result).toEqual([]);
  });
});
