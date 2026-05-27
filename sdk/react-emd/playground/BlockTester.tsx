/// <reference types="vite/client" />

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  createElement,
} from 'react';
import { parse } from '@everthink/emd';
import type { EmdSection } from '@everthink/emd';
import { EmdEditor } from '@everthink/react-emd';
import {
  DEFAULT_SYNTAX_HIDER_CONFIG,
  DEFAULT_TEXT_STYLER_CONFIG,
  DEFAULT_LINK_RENDERER_CONFIG,
  DEFAULT_STATUS_BADGE_CONFIG,
  DEFAULT_TYPE_BADGE_CONFIG,
  DEFAULT_BLOCK_RESOLVER_CONFIG,
  DEFAULT_INLINE_WIDGETS_CONFIG,
  DEFAULT_SMART_FOLDS_CONFIG,
} from '@everthink/react-emd';
import type { LiveMdConfig, ThemeMode } from '@everthink/react-emd';
import './BlockTester.css';

interface BlockTesterProps {
  currentContent: string;
  currentFilename?: string;
  theme: ThemeMode;
  featureToggles: Record<string, boolean>;
  onClose: () => void;
}

interface FlattenedSection {
  title: string;
  type: string;
  status: string | null;
  text: string;
  start: number;
  end: number;
}

function flattenSections(
  sections: EmdSection[],
  result: FlattenedSection[] = [],
): FlattenedSection[] {
  for (const s of sections) {
    result.push({
      title: s.title,
      type: s.section_type,
      status: s.status,
      text: '', // filled later from source
      start: s.source_span.start,
      end: s.source_span.end,
    });
    if (s.subsections && s.subsections.length > 0) {
      flattenSections(s.subsections, result);
    }
  }
  return result;
}

const DECORATION_FEATURES = [
  'syntaxHider',
  'textStyler',
  'linkRenderer',
  'statusBadge',
  'typeBadge',
  'blockResolver',
  'inlineWidgets',
  'smartFolds',
] as const;

const OVERLAY_COLORS: Record<string, string> = {
  syntaxHider: '#3b82f6',
  textStyler: '#22c55e',
  linkRenderer: '#8b5cf6',
  statusBadge: '#f59e0b',
  typeBadge: '#ef4444',
  blockResolver: '#ec4899',
  inlineWidgets: '#14b8a6',
  smartFolds: '#f97316',
};

interface SectionOption {
  label: string;
  value: number;
  text: string;
}

export function BlockTester(props: BlockTesterProps) {
  const { currentContent, currentFilename, theme, featureToggles, onClose } =
    props;

  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [rawEmdInput, setRawEmdInput] = useState('');
  const [useRawInput, setUseRawInput] = useState(false);
  const [localToggles, setLocalToggles] = useState<
    Record<string, boolean>
  >({ ...featureToggles });
  const [overlayMode, setOverlayMode] = useState(false);
  const [rebuildTime, setRebuildTime] = useState<number | null>(null);

  useEffect(() => {
    setLocalToggles({ ...featureToggles });
  }, [featureToggles]);

  useEffect(() => {
    async function parseSections() {
      if (!currentContent) {
        setSections([]);
        return;
      }

      try {
        const doc = await parse(currentContent);
        const flat = flattenSections(doc.sections);
        const opts: SectionOption[] = flat.map((s, i) => ({
          label: `[${s.type}${s.status ? '|' + s.status : ''}] ${s.title}`,
          value: i,
          text: currentContent.slice(s.start, s.end),
        }));
        setSections(opts);
      } catch {
        setSections([]);
      }
    }

    parseSections();
  }, [currentContent]);

  const viewportContent = useMemo(() => {
    if (useRawInput) {
      return rawEmdInput;
    }
    if (selectedIdx >= 0 && selectedIdx < sections.length) {
      return sections[selectedIdx].text;
    }
    return '';
  }, [useRawInput, rawEmdInput, selectedIdx, sections]);

  const viewportConfig = useMemo((): Partial<LiveMdConfig> => {
    return {
      syntaxHider: {
        ...DEFAULT_SYNTAX_HIDER_CONFIG,
        enabled: localToggles.syntaxHider,
      },
      textStyler: {
        ...DEFAULT_TEXT_STYLER_CONFIG,
        enabled: localToggles.textStyler,
      },
      linkRenderer: {
        ...DEFAULT_LINK_RENDERER_CONFIG,
        enabled: localToggles.linkRenderer,
      },
      statusBadge: {
        ...DEFAULT_STATUS_BADGE_CONFIG,
        enabled: localToggles.statusBadge,
      },
      typeBadge: {
        ...DEFAULT_TYPE_BADGE_CONFIG,
        enabled: localToggles.typeBadge,
      },
      blockResolver: {
        ...DEFAULT_BLOCK_RESOLVER_CONFIG,
        enabled: localToggles.blockResolver,
      },
      inlineWidgets: {
        ...DEFAULT_INLINE_WIDGETS_CONFIG,
        enabled: localToggles.inlineWidgets,
      },
      smartFolds: {
        ...DEFAULT_SMART_FOLDS_CONFIG,
        enabled: localToggles.smartFolds,
      },
      theme,
    };
  }, [localToggles, theme]);

  const handleToggle = useCallback(
    (key: string) => {
      const start = performance.now();
      setLocalToggles((prev) => ({ ...prev, [key]: !prev[key] }));
      requestAnimationFrame(() => {
        const end = performance.now();
        setRebuildTime(end - start);
      });
    },
    [],
  );

  const handleSectionSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const idx = parseInt(e.target.value, 10);
      setSelectedIdx(idx);
      setUseRawInput(false);
    },
    [],
  );

  const handleRawInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRawEmdInput(e.target.value);
      if (e.target.value) {
        setUseRawInput(true);
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  const viewportClass = useMemo(() => {
    const base = 'bt-viewport';
    if (theme === 'dark') return `${base} dark`;
    if (theme === 'high-contrast') return `${base} high-contrast`;
    return base;
  }, [theme]);

  const overlayBorderColor = useMemo(() => {
    if (!overlayMode) return undefined;
    const active = DECORATION_FEATURES.filter(
      (k) => localToggles[k],
    );
    if (active.length === 0) return 'transparent';
    if (active.length === 1) return OVERLAY_COLORS[active[0]];
    return undefined;
  }, [overlayMode, localToggles]);

  const overlayGradient = useMemo(() => {
    if (!overlayMode) return undefined;
    const active = DECORATION_FEATURES.filter(
      (k) => localToggles[k],
    );
    if (active.length <= 1) return undefined;

    const stops = active.map((k, i) => {
      const pct = (i / (active.length - 1)) * 100;
      return `${OVERLAY_COLORS[k]} ${pct}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [overlayMode, localToggles]);

  return createElement(
    'div',
    {
      className: 'modal-overlay',
      onClick: (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
      },
      onKeyDown: handleKeyDown,
    },
    createElement(
      'div',
      { className: 'modal-content' },
      createElement(
        'div',
        { className: 'modal-header' },
        createElement(
          'h2',
          null,
          'Block Tester',
          currentFilename
            ? ` — ${currentFilename}`
            : '',
        ),
        createElement(
          'button',
          { className: 'modal-close-btn', onClick: onClose },
          '\u00D7',
        ),
      ),
      createElement(
        'div',
        { className: 'modal-body' },
        createElement(
          'div',
          { className: 'block-tester' },
          createElement(
            'div',
            { className: 'bt-row' },
            createElement(
              'div',
              { className: 'bt-controls' },
              createElement(
                'span',
                { className: 'bt-label' },
                'Section from file',
              ),
              createElement(
                'select',
                {
                  className: 'bt-select',
                  value: selectedIdx,
                  onChange: handleSectionSelect,
                },
                createElement('option', { value: -1 }, '— Select a section —'),
                sections.map((s) =>
                  createElement(
                    'option',
                    { key: s.value, value: s.value },
                    s.label,
                  ),
                ),
              ),
            ),
            createElement(
              'div',
              { className: 'bt-controls' },
              createElement(
                'span',
                { className: 'bt-label' },
                'Or paste raw EMD',
              ),
              createElement('textarea', {
                className: 'bt-textarea',
                value: rawEmdInput,
                onChange: handleRawInputChange,
                placeholder:
                  '## [task|done] Hello World\nPaste EMD text here...',
                rows: 4,
              }),
            ),
          ),

          createElement(
            'div',
            { className: 'bt-toggles' },
            DECORATION_FEATURES.map((key) =>
              createElement(
                'label',
                { key, className: 'bt-toggle' },
                key.charAt(0).toUpperCase() + key.slice(1),
                createElement('input', {
                  type: 'checkbox',
                  checked: localToggles[key] ?? false,
                  onChange: () => handleToggle(key),
                }),
              ),
            ),
          ),

          createElement(
            'div',
            {
              className: viewportClass,
              style: overlayMode
                ? {
                    border: overlayGradient
                      ? `3px solid transparent`
                      : `3px solid ${overlayBorderColor ?? 'transparent'}`,
                    borderImage: overlayGradient
                      ? overlayGradient + ' 1'
                      : undefined,
                    position: 'relative',
                  }
                : undefined,
            },
            viewportContent
              ? createElement(EmdEditor, {
                  value: viewportContent,
                  config: viewportConfig,
                  readOnly: false,
                  className: 'bt-editor',
                })
              : createElement(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#9ca3af',
                      fontSize: '14px',
                      fontFamily: 'system-ui, sans-serif',
                    },
                  },
                  'Select a section or paste EMD to preview decorations.',
                ),
            overlayMode &&
              createElement(
                'div',
                {
                  style: {
                    position: 'absolute',
                    top: 4,
                    right: 8,
                    fontSize: '10px',
                    color: '#8888a0',
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                  },
                },
                'OVERLAY',
              ),
          ),

          createElement(
            'div',
            { className: 'bt-footer' },
            rebuildTime !== null &&
              createElement(
                'span',
                { className: 'bt-perf' },
                `Rebuild: ${rebuildTime.toFixed(1)}ms`,
              ),
            createElement(
              'label',
              { className: 'bt-overlay-mode' },
              createElement('input', {
                type: 'checkbox',
                checked: overlayMode,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setOverlayMode(e.target.checked),
              }),
              'Decoration Overlay',
            ),
            overlayMode &&
              createElement(
                'div',
                { className: 'bt-legend' },
                DECORATION_FEATURES.map((key) =>
                  createElement(
                    'div',
                    { key, className: 'bt-legend-item' },
                    createElement('span', {
                      className: 'bt-legend-swatch',
                      style: {
                        backgroundColor: localToggles[key]
                          ? OVERLAY_COLORS[key]
                          : '#3d3d5f',
                      },
                    }),
                    key.charAt(0).toUpperCase() + key.slice(1),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),
  );
}
