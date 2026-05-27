import React, { useEffect, useRef, useState } from 'react';
import { parse } from '@everthink/emd';
import type { EmdDocument, EmdSection } from '@everthink/emd';
import { injectThemeStyles } from './live-md/theme-engine';
import type { ThemeMode } from './live-md/types';

export interface EmdViewerProps {
  source: string;
  theme?: ThemeMode;
  className?: string;
  onNavigate?: (target: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  task: '#f59e0b',
  decision: '#0d9488',
  spec: '#2563eb',
  api: '#4f46e5',
  bug: '#ef4444',
  idea: '#eab308',
  verify: '#f97316',
  summary: '#6b7280',
  detail: '#78716c',
  memory: '#a855f7',
  log: '#9ca3af',
  meta: '#6b7280',
  config: '#64748b',
  schema: '#38bdf8',
  model: '#8b5cf6',
  agent: '#d946ef',
  graph: '#14b8a6',
  prompt: '#d97706',
  template: '#a8a29e',
  human: '#f43f5e',
  draw: '#ec4899',
  flow: '#06b6d4',
  kanban: '#84cc16',
  example: '#22c55e',
  unknown: '#9ca3af',
};

const STATUS_COLORS: Record<string, string> = {
  done: '#22c55e',
  pending: '#9ca3af',
  'in-progress': '#f59e0b',
  blocked: '#ef4444',
  archived: '#6b7280',
  cancelled: '#6b7280',
};

const WIKI_LINK_RE = /\[\[(.+?)\]\]/g;
const SEMANTIC_LINK_RE = /→\s*\w+[^\n]*/g;

function renderLine(
  line: string,
  onNavigate?: (target: string) => void
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  WIKI_LINK_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = WIKI_LINK_RE.exec(line)) !== null) {
    const matchStart = match.index;
    const target = match[1];

    if (matchStart > lastIndex) {
      parts.push(line.slice(lastIndex, matchStart));
    }

    parts.push(
      React.createElement(
        'span',
        {
          key: `wl-${matchStart}`,
          className: 'emd-viewer-wiki-link',
          style: {
            color: 'var(--emd-accent, #3b82f6)',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
          },
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            onNavigate?.(target);
          },
        },
        target
      )
    );

    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < line.length) {
    const remaining = line.slice(lastIndex);

    SEMANTIC_LINK_RE.lastIndex = 0;
    let slLastIndex = 0;
    const slParts: React.ReactNode[] = [];

    let slMatch: RegExpExecArray | null;
    while ((slMatch = SEMANTIC_LINK_RE.exec(remaining)) !== null) {
      const slStart = slMatch.index;

      if (slStart > slLastIndex) {
        slParts.push(remaining.slice(slLastIndex, slStart));
      }

      slParts.push(
        React.createElement(
          'span',
          {
            key: `sl-${slStart}`,
            className: 'emd-viewer-semantic-link',
            style: {
              display: 'inline-block',
              padding: '0 4px',
              borderRadius: '3px',
              backgroundColor: 'var(--emd-bg-tertiary, #e5e7eb)',
              color: 'var(--emd-text-secondary, #4b5563)',
              fontSize: '0.85em',
              fontFamily: 'var(--emd-mono, monospace)',
            },
          },
          slMatch[0]
        )
      );

      slLastIndex = slStart + slMatch[0].length;
    }

    if (slLastIndex < remaining.length) {
      slParts.push(remaining.slice(slLastIndex));
    }

    if (slParts.length > 0) {
      for (const p of slParts) {
        parts.push(p);
      }
    }
  }

  return parts.length > 0 ? parts : line;
}

function renderSection(
  section: EmdSection,
  depth: number,
  onNavigate?: (target: string) => void
): React.ReactElement {
  const typeColor = TYPE_COLORS[section.section_type] ?? TYPE_COLORS.unknown;

  const children: React.ReactNode[] = [];

  children.push(
    React.createElement(
      'span',
      {
        key: `type-${section.source_span.start}`,
        className: 'emd-viewer-type-badge',
        style: {
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 'var(--emd-radius, 4px)',
          backgroundColor: typeColor,
          color: '#ffffff',
          fontSize: '0.75rem',
          fontWeight: 600,
          marginRight: '8px',
          verticalAlign: 'middle',
        },
      },
      `[${section.section_type}]`
    )
  );

  if (section.status) {
    const statusColor = STATUS_COLORS[section.status];
    children.push(
      React.createElement(
        'span',
        {
          key: `status-${section.source_span.start}`,
          className: 'emd-viewer-status-badge',
          style: {
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: statusColor ?? 'var(--emd-status-unknown, #9ca3af)',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginRight: '8px',
            verticalAlign: 'middle',
          },
        },
        section.status
      )
    );
  }

  const headingLevel = Math.min(section.level + 1, 6);
  children.push(
    React.createElement(
      `h${headingLevel}`,
      {
        key: `title-${section.source_span.start}`,
        className: 'emd-viewer-title',
        style: {
          display: 'inline',
          margin: 0,
          fontSize:
            headingLevel === 1
              ? '1.5rem'
              : headingLevel === 2
                ? '1.25rem'
                : '1rem',
          fontWeight: 600,
          color: 'var(--emd-text, #1a1a2e)',
          verticalAlign: 'middle',
        },
      },
      section.title
    )
  );

  if (section.content && section.content.length > 0) {
    for (let i = 0; i < section.content.length; i++) {
      const line = String(section.content[i]);
      children.push(
        React.createElement(
          'p',
          {
            key: `content-${section.source_span.start}-${i}`,
            className: 'emd-viewer-content',
            style: {
              margin: '4px 0',
              lineHeight: 1.6,
              color: 'var(--emd-text-secondary, #4b5563)',
              fontSize: '0.9375rem',
            },
          },
          renderLine(line, onNavigate)
        )
      );
    }
  }

  if (section.subsections && section.subsections.length > 0) {
    for (const sub of section.subsections) {
      children.push(renderSection(sub, depth + 1, onNavigate));
    }
  }

  return React.createElement(
    'div',
    {
      key: `${section.source_span.start}-${section.title}`,
      className: 'emd-viewer-section',
      style: {
        marginLeft: `${depth * 24}px`,
        padding: '12px 0',
        borderLeft:
          depth > 0 ? `2px solid ${typeColor}33` : undefined,
        paddingLeft: depth > 0 ? '16px' : '0',
        marginBottom: '8px',
        borderRadius: 'var(--emd-radius, 4px)',
      },
      'data-type': section.section_type,
      'data-status': section.status ?? '',
    },
    ...children
  );
}

const INJECTED_STYLE_ID = 'emd-viewer-styles';

function injectViewerStyles(container: HTMLElement): void {
  if (container.querySelector(`#${INJECTED_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = INJECTED_STYLE_ID;
  style.textContent = `
    .emd-viewer-section {
      transition: background-color var(--emd-transition, 150ms);
    }
    .emd-viewer-section:hover {
      background-color: var(--emd-bg-secondary, #f3f4f6);
    }
    .emd-viewer-wiki-link:hover {
      color: var(--emd-accent-hover, #2563eb) !important;
      text-decoration-style: solid !important;
    }
    .emd-viewer-title {
      word-break: break-word;
    }
  `;
  container.appendChild(style);
}

export function EmdViewer(props: EmdViewerProps): React.ReactElement {
  const { source, theme = 'light', className, onNavigate } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<EmdDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function parseSource(): Promise<void> {
      if (!source) {
        setDoc(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await parse(source);
        if (!cancelled) {
          setDoc(result);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setDoc(null);
          setLoading(false);
        }
      }
    }

    parseSource();

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (containerRef.current) {
      injectThemeStyles(containerRef.current, theme);
      injectViewerStyles(containerRef.current);
    }
  }, [theme]);

  const containerClass = [
    'emd-viewer',
    `emd-theme-${theme}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (error) {
    return React.createElement(
      'div',
      {
        ref: containerRef,
        className: containerClass,
        style: {
          padding: '16px',
          fontFamily: 'var(--emd-font, system-ui, -apple-system, sans-serif)',
          color: 'var(--emd-text, #1a1a2e)',
        },
      },
      React.createElement(
        'div',
        {
          className: 'emd-viewer-error',
          style: {
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--emd-radius, 4px)',
            color: '#dc2626',
            fontSize: '0.875rem',
            fontFamily: 'var(--emd-mono, monospace)',
          },
        },
        `Parse error: ${error}`
      )
    );
  }

  return React.createElement(
    'div',
    {
      ref: containerRef,
      className: containerClass,
      style: {
        fontFamily: 'var(--emd-font, system-ui, -apple-system, sans-serif)',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '16px',
        color: 'var(--emd-text, #1a1a2e)',
        backgroundColor: 'var(--emd-bg, #ffffff)',
        minHeight: '2em',
      },
    },
    loading && !doc
      ? React.createElement(
          'span',
          {
            style: {
              color: 'var(--emd-text-muted, #9ca3af)',
              fontSize: '0.875rem',
            },
          },
          'Loading...'
        )
      : (doc?.sections ?? []).map((section) =>
          renderSection(section, 0, onNavigate)
        )
  );
}
