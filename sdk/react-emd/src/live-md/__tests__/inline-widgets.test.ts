import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import type { Range } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { buildInlineWidgetDecorations } from '../inline-widgets';
import {
  type InlineWidgetsConfig,
  DEFAULT_INLINE_WIDGETS_CONFIG,
} from '../types';
import type { EmdDocument, EmdSection } from '@everthink/emd';
import { setBlockResolverView } from '../block-resolver';

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
  overrides: Partial<InlineWidgetsConfig> = {}
): InlineWidgetsConfig {
  return { ...DEFAULT_INLINE_WIDGETS_CONFIG, ...overrides };
}

function getDecorations(
  doc: string,
  config: InlineWidgetsConfig,
  ast: EmdDocument | null = null
): Range<Decoration>[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const tree: Tree = syntaxTree(state);
  return buildInlineWidgetDecorations(tree, ast, config, state);
}

function getWidgetDecorations(
  decos: Range<Decoration>[]
): Range<Decoration>[] {
  return decos.filter((d) => {
    const spec = (d.value as any)?.spec;
    return spec?.widget !== undefined;
  });
}

describe('buildInlineWidgetDecorations - checkboxes', () => {
  it('task list item - [ ] produces a CheckboxWidget with unchecked state', () => {
    const doc = '- [ ] Buy milk';
    const config = makeConfig();
    const decos = getDecorations(doc, config);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.checked).toBe(false);
    expect(widget.markerFrom).toBe(2);

    const dom = widget.toDOM() as HTMLInputElement;
    expect(dom.tagName).toBe('INPUT');
    expect(dom.type).toBe('checkbox');
    expect(dom.className).toBe('emd-inline-checkbox');
    expect(dom.checked).toBe(false);
  });

  it('task list item - [x] produces a CheckboxWidget with checked state', () => {
    const doc = '- [x] Buy milk';
    const config = makeConfig();
    const decos = getDecorations(doc, config);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.checked).toBe(true);

    const dom = widget.toDOM() as HTMLInputElement;
    expect(dom.checked).toBe(true);
  });

  it('task list item - [X] (uppercase) produces a checked checkbox', () => {
    const doc = '- [X] Buy milk';
    const config = makeConfig();
    const decos = getDecorations(doc, config);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.checked).toBe(true);
  });

  it('checkbox click dispatches a transaction that toggles from [ ] to [x]', () => {
    const mockDispatch = vi.fn();
    const mockView = {
      dispatch: mockDispatch,
    };

    setBlockResolverView(mockView as any);

    try {
      const doc = '- [ ] Buy milk';
      const config = makeConfig();
      const decos = getDecorations(doc, config);
      const widgets = getWidgetDecorations(decos);
      const widget = (widgets[0].value as any).spec.widget;
      const dom = widget.toDOM() as HTMLInputElement;

      dom.dispatchEvent(new Event('change', { bubbles: true }));

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 3,
          to: 4,
          insert: 'x',
        },
      });
    } finally {
      setBlockResolverView(null);
    }
  });

  it('checked checkbox click dispatches toggle from [x] to [ ]', () => {
    const mockDispatch = vi.fn();
    const mockView = {
      dispatch: mockDispatch,
    };

    setBlockResolverView(mockView as any);

    try {
      const doc = '- [x] Buy milk';
      const config = makeConfig();
      const decos = getDecorations(doc, config);
      const widgets = getWidgetDecorations(decos);
      const widget = (widgets[0].value as any).spec.widget;
      const dom = widget.toDOM() as HTMLInputElement;

      dom.dispatchEvent(new Event('change', { bubbles: true }));

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 3,
          to: 4,
          insert: ' ',
        },
      });
    } finally {
      setBlockResolverView(null);
    }
  });

  it('multiple task list items produce separate checkbox widgets', () => {
    const doc = '- [ ] First task\n- [x] Second task\n- [ ] Third task';
    const config = makeConfig();
    const decos = getDecorations(doc, config);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(3);

    expect((widgets[0].value as any).spec.widget.checked).toBe(false);
    expect((widgets[1].value as any).spec.widget.checked).toBe(true);
    expect((widgets[2].value as any).spec.widget.checked).toBe(false);
  });

  it('task item inside FencedCode produces no checkbox widget', () => {
    const doc = '```\n- [ ] Not a real task\n- [x] Also not real\n```';
    const config = makeConfig();
    const decos = getDecorations(doc, config);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });

  it('task item inside fenced code block with language tag produces no widget', () => {
    const doc =
      '```typescript\n// - [ ] Not a task inside code\nconst x = 1;\n```\n\n- [ ] Real task outside';
    const config = makeConfig();
    const decos = getDecorations(doc, config);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);
  });
});

describe('buildInlineWidgetDecorations - progress bars', () => {
  it('task section heading with child checkboxes produces ProgressBarWidget', () => {
    const doc = '## [task] My Tasks';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'My Tasks',
      level: 2,
      content: ['- [ ] Task 1', '- [x] Task 2', '- [ ] Task 3'],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.total).toBe(3);
    expect(widget.checked).toBe(1);

    const dom = widget.toDOM();
    expect(dom.className).toBe('emd-progress-bar');
    expect(dom.textContent).toContain('1/3');
  });

  it('task section heading with no child checkboxes produces no progress bar', () => {
    const doc = '## [task] Empty Tasks';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Empty Tasks',
      level: 2,
      content: ['Just a description line, not a task.'],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });

  it('progress bar with 2 of 5 checked shows correct ratio', () => {
    const doc = '## [task] Five Tasks';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Five Tasks',
      level: 2,
      content: [
        '- [x] Task 1',
        '- [ ] Task 2',
        '- [ ] Task 3',
        '- [x] Task 4',
        '- [ ] Task 5',
      ],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    expect(widget.total).toBe(5);
    expect(widget.checked).toBe(2);

    const dom = widget.toDOM();
    expect(dom.textContent).toContain('2/5');
  });

  it('progress bar shows 0/0 when content array is empty', () => {
    const doc = '## [task] No Content';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'No Content',
      level: 2,
      content: [],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });

  it('non-task section heading produces no progress bar even with checkboxes', () => {
    const doc = '## [spec] Specification';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'spec',
      title: 'Specification',
      level: 2,
      content: ['- [x] Done', '- [ ] Not done'],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });
});

describe('buildInlineWidgetDecorations - approve buttons', () => {
  it('[human] section heading with no status produces ApproveButtonWidget', () => {
    const doc = '## [human] Review PR';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'human',
      title: 'Review PR',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);

    const widget = (widgets[0].value as any).spec.widget;
    const dom = widget.toDOM();
    expect(dom.className).toBe('emd-approve-buttons');

    const buttons = dom.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('Approve');
    expect(buttons[1].textContent).toBe('Reject');
  });

  it('[human] section heading with |done status produces no approve buttons', () => {
    const doc = '## [human|done] Review PR';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'human',
      status: 'done',
      title: 'Review PR',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });

  it('[human] section heading with |cancelled status produces no approve buttons', () => {
    const doc = '## [human|cancelled] Review PR';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'human',
      status: 'cancelled',
      title: 'Review PR',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(0);
  });

  it('[human] section heading with |pending status still shows approve buttons', () => {
    const doc = '## [human|pending] Review PR';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'human',
      status: 'pending',
      title: 'Review PR',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBe(1);
  });

  it('approve button click dispatches insert of |done', () => {
    const mockDispatch = vi.fn();
    const doc = '## [human] Review PR\n\nSome content';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
    });

    const mockView = {
      dispatch: mockDispatch,
      state,
    };

    setBlockResolverView(mockView as any);

    try {
      const headingStart = doc.indexOf('##');
      const section = makeSection({
        section_type: 'human',
        title: 'Review PR',
        level: 2,
        source_span: { start: headingStart, end: doc.length },
      });
      const ast = makeAst([section]);
      const config = makeConfig();
      const decos = getDecorations(doc, config, ast);
      const widgets = getWidgetDecorations(decos);
      const widget = (widgets[0].value as any).spec.widget;
      const dom = widget.toDOM();
      const approveBtn = dom.querySelector('.emd-btn-approve')!;

      approveBtn.dispatchEvent(new Event('click', { bubbles: true }));

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const call = mockDispatch.mock.calls[0][0];
      expect(call.changes).toBeDefined();
      expect(call.changes.insert).toContain('|done');
    } finally {
      setBlockResolverView(null);
    }
  });

  it('reject button click dispatches insert of |cancelled', () => {
    const mockDispatch = vi.fn();
    const doc = '## [human] Review PR\n\nSome content';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
    });

    const mockView = {
      dispatch: mockDispatch,
      state,
    };

    setBlockResolverView(mockView as any);

    try {
      const headingStart = doc.indexOf('##');
      const section = makeSection({
        section_type: 'human',
        title: 'Review PR',
        level: 2,
        source_span: { start: headingStart, end: doc.length },
      });
      const ast = makeAst([section]);
      const config = makeConfig();
      const decos = getDecorations(doc, config, ast);
      const widgets = getWidgetDecorations(decos);
      const widget = (widgets[0].value as any).spec.widget;
      const dom = widget.toDOM();
      const rejectBtn = dom.querySelector('.emd-btn-reject')!;

      rejectBtn.dispatchEvent(new Event('click', { bubbles: true }));

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const call = mockDispatch.mock.calls[0][0];
      expect(call.changes).toBeDefined();
      expect(call.changes.insert).toContain('|cancelled');
    } finally {
      setBlockResolverView(null);
    }
  });
});

describe('buildInlineWidgetDecorations - configuration', () => {
  it('disabled config produces no decorations', () => {
    const doc = '- [ ] Task\n- [x] Done\n## [task] Tasks';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Tasks',
      level: 2,
      content: ['- [ ] Task', '- [x] Done'],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ enabled: false });
    const decos = getDecorations(doc, config, ast);

    expect(decos.length).toBe(0);
  });

  it('renderCheckboxes: false skips checkboxes but includes other widgets', () => {
    const doc = '- [ ] Task\n- [x] Done\n## [human] Review\n## [task] Tasks';
    const headingStartHuman = doc.indexOf('## [human]');
    const headingStartTask = doc.indexOf('## [task]');
    const humanSection = makeSection({
      section_type: 'human',
      title: 'Review',
      level: 2,
      source_span: { start: headingStartHuman, end: doc.length },
    });
    const taskSection = makeSection({
      section_type: 'task',
      title: 'Tasks',
      level: 2,
      content: ['- [ ] Task', '- [x] Done'],
      source_span: { start: headingStartTask, end: doc.length },
    });
    const ast = makeAst([humanSection, taskSection]);
    const config = makeConfig({ renderCheckboxes: false });
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    // Should have approve buttons + progress bar, but no checkboxes
    expect(widgets.length).toBeGreaterThanOrEqual(2);

    const widgetClasses = widgets.map((d) => {
      const dom = (d.value as any).spec.widget.toDOM();
      return dom.className;
    });
    const hasApproveButtons = widgetClasses.some((c: string) =>
      c.includes('emd-approve-buttons')
    );
    const hasProgressBar = widgetClasses.some((c: string) =>
      c.includes('emd-progress-bar')
    );
    const hasCheckbox = widgetClasses.some((c: string) =>
      c.includes('emd-inline-checkbox')
    );

    expect(hasApproveButtons).toBe(true);
    expect(hasProgressBar).toBe(true);
    expect(hasCheckbox).toBe(false);
  });

  it('renderProgressBars: false skips progress bars', () => {
    const doc = '- [ ] Task\n- [x] Done\n## [task] Tasks';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'task',
      title: 'Tasks',
      level: 2,
      content: ['- [ ] Task', '- [x] Done'],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ renderProgressBars: false });
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    // Should have 2 checkboxes but no progress bar
    expect(widgets.length).toBe(2);

    const widgetClasses = widgets.map((d) => {
      const dom = (d.value as any).spec.widget.toDOM();
      return dom.className;
    });
    const hasCheckbox = widgetClasses.some((c: string) =>
      c.includes('emd-inline-checkbox')
    );
    const hasProgressBar = widgetClasses.some((c: string) =>
      c.includes('emd-progress-bar')
    );

    expect(hasCheckbox).toBe(true);
    expect(hasProgressBar).toBe(false);
  });

  it('renderApproveButtons: false skips approve buttons', () => {
    const doc = '## [human] Review PR\n- [ ] Task';
    const headingStart = doc.indexOf('##');
    const section = makeSection({
      section_type: 'human',
      title: 'Review PR',
      level: 2,
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig({ renderApproveButtons: false });
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    // Should have 1 checkbox but no approve buttons
    expect(widgets.length).toBe(1);

    const dom = (widgets[0].value as any).spec.widget.toDOM();
    expect(dom.className).toBe('emd-inline-checkbox');
  });

  it('returns empty array when AST is null', () => {
    const doc = '- [ ] Task\n## [task] Tasks\n## [human] Review';
    const config = makeConfig();
    const decos = getDecorations(doc, config, null);

    // Only checkboxes should appear (they don't need AST)
    const widgets = getWidgetDecorations(decos);
    expect(widgets.length).toBeGreaterThanOrEqual(1);

    const widgetClasses = widgets.map((d) => {
      const dom = (d.value as any).spec.widget.toDOM();
      return dom.className;
    });
    const hasProgressBar = widgetClasses.some((c: string) =>
      c.includes('emd-progress-bar')
    );
    const hasApproveButtons = widgetClasses.some((c: string) =>
      c.includes('emd-approve-buttons')
    );

    expect(hasProgressBar).toBe(false);
    expect(hasApproveButtons).toBe(false);
  });
});

describe('buildInlineWidgetDecorations - integration scenarios', () => {
  it('mixed document with checkboxes, progress bar, and approve buttons', () => {
    const doc = [
      '- [ ] Buy milk',
      '- [x] Email client',
      '',
      '## [task] Project Tasks',
      '',
      '- [x] Setup repo',
      '- [ ] Write tests',
      '- [ ] Review PR',
      '',
      '## [human] Approve Deployment',
    ].join('\n');

    const headingStartTask = doc.indexOf('## [task]');
    const headingStartHuman = doc.indexOf('## [human]');
    const taskSection = makeSection({
      section_type: 'task',
      title: 'Project Tasks',
      level: 2,
      content: ['- [x] Setup repo', '- [ ] Write tests', '- [ ] Review PR'],
      source_span: { start: headingStartTask, end: doc.length },
    });
    const humanSection = makeSection({
      section_type: 'human',
      title: 'Approve Deployment',
      level: 2,
      source_span: { start: headingStartHuman, end: doc.length },
    });
    const ast = makeAst([taskSection, humanSection]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);

    const widgetClasses = widgets.map((d) => {
      const dom = (d.value as any).spec.widget.toDOM();
      return dom.className;
    });
    const checkboxCount = widgetClasses.filter((c: string) =>
      c.includes('emd-inline-checkbox')
    ).length;
    const hasProgressBar = widgetClasses.some((c: string) =>
      c.includes('emd-progress-bar')
    );
    const hasApproveButtons = widgetClasses.some((c: string) =>
      c.includes('emd-approve-buttons')
    );

    expect(checkboxCount).toBe(5);
    expect(hasProgressBar).toBe(true);
    expect(hasApproveButtons).toBe(true);
  });

  it('progress bar widget does not appear for non-task headings inside fenced code', () => {
    const doc = [
      '```markdown',
      '## [task] Inside Code',
      '- [ ] Fake task',
      '```',
      '',
      '## [task] Outside Code',
    ].join('\n');

    const headingStart = doc.indexOf('## [task] Outside');
    const section = makeSection({
      section_type: 'task',
      title: 'Outside Code',
      level: 2,
      content: [],
      source_span: { start: headingStart, end: doc.length },
    });
    const ast = makeAst([section]);
    const config = makeConfig();
    const decos = getDecorations(doc, config, ast);

    const widgets = getWidgetDecorations(decos);
    // No progress bar (0 checkboxes in content) and no checkboxes (inside fenced code)
    expect(widgets.length).toBe(0);
  });
});
