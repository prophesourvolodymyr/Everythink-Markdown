import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';
import type { EmdDocument, EmdSection } from '@everthink/emd';
import { EmdViewer } from '../viewer';

function makeSection(overrides: Partial<EmdSection> = {}): EmdSection {
  return {
    level: 2,
    section_type: 'task',
    status: null,
    title: 'Section Title',
    content: [],
    subsections: [],
    source_span: { start: 0, end: 10 },
    diagnostics: [],
    metadata: { status_override: null, depends_on: [], id: null },
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

const mockParse = vi.fn();

vi.mock('@everthink/emd', () => ({
  parse: (source: string) => mockParse(source),
}));

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe('EmdViewer', () => {
  beforeEach(() => {
    mockParse.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', async () => {
    mockParse.mockResolvedValue(makeAst([]));

    const { container } = render(
      React.createElement(EmdViewer, { source: '' })
    );

    await flushMicrotasks();

    const viewerDiv = container.querySelector('.emd-viewer');
    expect(viewerDiv).toBeTruthy();
  });

  it('renders empty for empty source', async () => {
    mockParse.mockResolvedValue(makeAst([]));

    const { container } = render(
      React.createElement(EmdViewer, { source: '' })
    );

    await flushMicrotasks();

    const sections = container.querySelectorAll('.emd-viewer-section');
    expect(sections.length).toBe(0);
  });

  it('renders type badge for each section', async () => {
    const sections: EmdSection[] = [
      makeSection({
        section_type: 'task',
        title: 'Task One',
        source_span: { start: 0, end: 50 },
      }),
      makeSection({
        section_type: 'spec',
        title: 'API Spec',
        source_span: { start: 50, end: 100 },
      }),
    ];
    mockParse.mockResolvedValue(makeAst(sections));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: '## [task] Task One\n\n## [spec] API Spec',
      })
    );

    await flushMicrotasks();

    const badges = container.querySelectorAll('.emd-viewer-type-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe('[task]');
    expect(badges[1].textContent).toBe('[spec]');
  });

  it('renders status badge when status is set', async () => {
    const sections: EmdSection[] = [
      makeSection({
        section_type: 'task',
        status: 'done',
        title: 'Done Task',
        source_span: { start: 0, end: 50 },
      }),
    ];
    mockParse.mockResolvedValue(makeAst(sections));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: '## [task|done] Done Task',
      })
    );

    await flushMicrotasks();

    const statusBadge = container.querySelector('.emd-viewer-status-badge');
    expect(statusBadge).toBeTruthy();
    expect(statusBadge!.textContent).toBe('done');
  });

  it('renders section content lines', async () => {
    const sections: EmdSection[] = [
      makeSection({
        section_type: 'task',
        title: 'Test',
        content: ['First line', 'Second line'],
        source_span: { start: 0, end: 50 },
      }),
    ];
    mockParse.mockResolvedValue(makeAst(sections));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: '## [task] Test\n\nFirst line\nSecond line',
      })
    );

    await flushMicrotasks();

    const content = container.querySelectorAll('.emd-viewer-content');
    expect(content.length).toBe(2);
    expect(content[0].textContent).toBe('First line');
    expect(content[1].textContent).toBe('Second line');
  });

  it('renders nested sections with indentation', async () => {
    const subSub = makeSection({
      section_type: 'detail',
      title: 'Detail',
      source_span: { start: 100, end: 150 },
    });
    const sub = makeSection({
      section_type: 'spec',
      title: 'Sub Spec',
      subsections: [subSub],
      source_span: { start: 50, end: 150 },
    });
    const parent = makeSection({
      section_type: 'task',
      title: 'Parent',
      subsections: [sub],
      source_span: { start: 0, end: 150 },
    });
    mockParse.mockResolvedValue(makeAst([parent]));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: '## [task] Parent\n\n## [spec] Sub Spec\n\n### [detail] Detail',
      })
    );

    await flushMicrotasks();

    const allSections = container.querySelectorAll('.emd-viewer-section');
    expect(allSections.length).toBe(3);
  });

  it('renders wiki-links as clickable spans and calls onNavigate', async () => {
    const sections: EmdSection[] = [
      makeSection({
        section_type: 'task',
        title: 'Test',
        content: ['See [[other-page]] for details'],
        source_span: { start: 0, end: 50 },
      }),
    ];
    mockParse.mockResolvedValue(makeAst(sections));

    const onNavigate = vi.fn();
    const { container } = render(
      React.createElement(EmdViewer, {
        source: '## [task] Test\n\nSee [[other-page]] for details',
        onNavigate,
      })
    );

    await flushMicrotasks();

    const wikiLink = container.querySelector('.emd-viewer-wiki-link');
    expect(wikiLink).toBeTruthy();
    expect(wikiLink!.textContent).toBe('other-page');

    fireEvent.click(wikiLink!);
    expect(onNavigate).toHaveBeenCalledWith('other-page');
  });

  it('applies className prop to container', async () => {
    mockParse.mockResolvedValue(makeAst([]));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: '',
        className: 'custom-viewer',
      })
    );

    await flushMicrotasks();

    const viewerDiv = container.querySelector('.emd-viewer');
    expect(viewerDiv).toBeTruthy();
    expect(viewerDiv!.classList.contains('custom-viewer')).toBe(true);
  });

  it('applies theme class to container', async () => {
    mockParse.mockResolvedValue(makeAst([]));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: '',
        theme: 'dark',
      })
    );

    await flushMicrotasks();

    const viewerDiv = container.querySelector('.emd-viewer');
    expect(viewerDiv).toBeTruthy();
    expect(viewerDiv!.classList.contains('emd-theme-dark')).toBe(true);
  });

  it('renders error message when parse fails', async () => {
    mockParse.mockRejectedValue(new Error('Parse failure'));

    const { container } = render(
      React.createElement(EmdViewer, {
        source: 'invalid source',
      })
    );

    await flushMicrotasks();

    const errorDiv = container.querySelector('.emd-viewer-error');
    expect(errorDiv).toBeTruthy();
    expect(errorDiv!.textContent).toContain('Parse error');
    expect(errorDiv!.textContent).toContain('Parse failure');
  });

  it('re-parses when source prop changes', async () => {
    const sections1: EmdSection[] = [
      makeSection({
        section_type: 'task',
        title: 'Task One',
        source_span: { start: 0, end: 50 },
      }),
    ];
    const sections2: EmdSection[] = [
      makeSection({
        section_type: 'spec',
        title: 'Spec One',
        source_span: { start: 0, end: 50 },
      }),
    ];

    mockParse.mockResolvedValueOnce(makeAst(sections1));
    mockParse.mockResolvedValueOnce(makeAst(sections2));

    const { container, rerender } = render(
      React.createElement(EmdViewer, {
        source: '## [task] Task One',
      })
    );

    await flushMicrotasks();

    expect(mockParse).toHaveBeenCalledTimes(1);

    rerender(
      React.createElement(EmdViewer, {
        source: '## [spec] Spec One',
      })
    );

    await flushMicrotasks();

    expect(mockParse).toHaveBeenCalledTimes(2);

    const badges = container.querySelectorAll('.emd-viewer-type-badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toBe('[spec]');
  });
});
