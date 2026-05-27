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
  autoFoldMatchingSections,
  buildSmartFoldsExtension,
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
