/// <reference types="vite/client" />

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  createElement,
} from 'react';
import { EmdEditor } from '@everthink/react-emd';
import type { EmdEditorRef } from '@everthink/react-emd';
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
import { BlockTester } from './BlockTester';
import './App.css';

const sampleModules = import.meta.glob('./samples/*.emd', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface SampleFile {
  filename: string;
  displayName: string;
}

function getSampleFiles(): SampleFile[] {
  return Object.keys(sampleModules)
    .map((path) => {
      const filename = path.replace('./samples/', '');
      const displayName = filename;
      return { filename, displayName };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

function loadSampleContent(filename: string): string | undefined {
  const key = `./samples/${filename}`;
  return sampleModules[key];
}

interface Tab {
  id: string;
  filename: string;
  content: string;
  isDirty: boolean;
}

interface ConsoleEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'navigate';
}

let consoleIdCounter = 0;

function makeTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
}

const FEATURE_KEYS = [
  'syntaxHider',
  'textStyler',
  'linkRenderer',
  'statusBadge',
  'typeBadge',
  'blockResolver',
  'inlineWidgets',
  'smartFolds',
] as const;

type FeatureKey = (typeof FEATURE_KEYS)[number];

export function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [showInspector, setShowInspector] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [showBlockTester, setShowBlockTester] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [featureToggles, setFeatureToggles] = useState<
    Record<FeatureKey, boolean>
  >({
    syntaxHider: true,
    textStyler: true,
    linkRenderer: true,
    statusBadge: true,
    typeBadge: true,
    blockResolver: false,
    inlineWidgets: true,
    smartFolds: true,
  });

  const editorRef = useRef<EmdEditorRef>(null);
  const sampleFiles = useMemo(() => getSampleFiles(), []);

  const activeTab = useMemo(() => {
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const liveMdConfig = useMemo((): Partial<LiveMdConfig> => {
    return {
      syntaxHider: {
        ...DEFAULT_SYNTAX_HIDER_CONFIG,
        enabled: featureToggles.syntaxHider,
      },
      textStyler: {
        ...DEFAULT_TEXT_STYLER_CONFIG,
        enabled: featureToggles.textStyler,
      },
      linkRenderer: {
        ...DEFAULT_LINK_RENDERER_CONFIG,
        enabled: featureToggles.linkRenderer,
      },
      statusBadge: {
        ...DEFAULT_STATUS_BADGE_CONFIG,
        enabled: featureToggles.statusBadge,
      },
      typeBadge: {
        ...DEFAULT_TYPE_BADGE_CONFIG,
        enabled: featureToggles.typeBadge,
      },
      blockResolver: {
        ...DEFAULT_BLOCK_RESOLVER_CONFIG,
        enabled: featureToggles.blockResolver,
      },
      inlineWidgets: {
        ...DEFAULT_INLINE_WIDGETS_CONFIG,
        enabled: featureToggles.inlineWidgets,
      },
      smartFolds: {
        ...DEFAULT_SMART_FOLDS_CONFIG,
        enabled: featureToggles.smartFolds,
      },
      theme,
    };
  }, [featureToggles, theme]);

  const addConsoleLog = useCallback(
    (message: string, type: ConsoleEntry['type'] = 'info') => {
      const id = ++consoleIdCounter;
      setConsoleLogs((prev) => [
        ...prev.slice(-199),
        { id, timestamp: makeTimestamp(), message, type },
      ]);
    },
    [],
  );

  const clearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const openFile = useCallback(
    (filename: string) => {
      const existing = tabs.find((t) => t.filename === filename);
      if (existing) {
        setActiveTabId(existing.id);
        addConsoleLog(`Switched to tab: ${filename}`, 'info');
        return;
      }

      const content = loadSampleContent(filename);
      if (content === undefined) {
        addConsoleLog(`Error: File not found: ${filename}`, 'error');
        return;
      }

      const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newTab: Tab = {
        id,
        filename,
        content,
        isDirty: false,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      addConsoleLog(`Opened: ${filename}`, 'info');

      setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
    },
    [tabs, addConsoleLog],
  );

  const openAllFiles = useCallback(() => {
    const fileList = getSampleFiles();
    const newTabs: Tab[] = [];
    const existingFilenames = new Set(tabs.map((t) => t.filename));

    for (const sf of fileList) {
      if (existingFilenames.has(sf.filename)) continue;
      const content = loadSampleContent(sf.filename);
      if (content === undefined) continue;
      const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      newTabs.push({ id, filename: sf.filename, content, isDirty: false });
    }

    if (newTabs.length === 0) {
      addConsoleLog('All files already open', 'info');
      return;
    }

    setTabs((prev) => [...prev, ...newTabs]);
    setActiveTabId(newTabs[0].id);
    addConsoleLog(`Opened ${newTabs.length} file(s)`, 'info');
  }, [tabs, addConsoleLog]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const closed = prev[idx];
        const next = prev.filter((t) => t.id !== tabId);

        if (activeTabId === tabId && next.length > 0) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        } else if (next.length === 0) {
          setActiveTabId(null);
        }

        if (closed) {
          addConsoleLog(`Closed: ${closed.filename}`, 'info');
        }

        return next;
      });
    },
    [activeTabId, addConsoleLog],
  );

  const selectTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        addConsoleLog(`Switched to: ${tab.filename}`, 'info');
      }
      setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
    },
    [tabs, addConsoleLog],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeTabId) return;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, content, isDirty: true }
            : t,
        ),
      );
    },
    [activeTabId],
  );

  const handleNavigate = useCallback(
    (target: string) => {
      addConsoleLog(`Navigate: ${target}`, 'navigate');

      const cleanTarget = target.replace(/\.emd(#.+)?$/, '.emd');
      const sampleFile = sampleFiles.find(
        (sf) => sf.filename === cleanTarget || sf.filename.startsWith(cleanTarget.replace('.emd', '')),
      );
      if (sampleFile) {
        openFile(sampleFile.filename);
      }
    },
    [addConsoleLog, sampleFiles, openFile],
  );

  const handleSave = useCallback(() => {
    addConsoleLog(
      `Save: ${activeTab?.filename ?? 'unknown'} (${activeTab?.content.length ?? 0} chars)`,
      'info',
    );
    if (activeTabId) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, isDirty: false } : t,
        ),
      );
    }
  }, [activeTabId, activeTab, addConsoleLog]);

  const toggleFeature = useCallback((key: FeatureKey) => {
    const start = performance.now();
    setFeatureToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    requestAnimationFrame(() => {
      const end = performance.now();
      addConsoleLog(
        `Toggle ${key}: ${!featureToggles[key] ? 'ON' : 'OFF'} (${(end - start).toFixed(1)}ms)`,
        'info',
      );
    });
  }, [featureToggles, addConsoleLog]);

  const handleToggleTheme = useCallback(
    (newTheme: ThemeMode) => {
      setTheme(newTheme);
      addConsoleLog(`Theme: ${newTheme}`, 'info');
    },
    [addConsoleLog],
  );

  const activeFileInSamples = useMemo(() => {
    if (!activeTabId) return null;
    const tab = tabs.find((t) => t.id === activeTabId);
    return tab ? tab.filename : null;
  }, [tabs, activeTabId]);

  const editorAreaClass = useMemo(() => {
    const base = 'editor-area';
    if (theme === 'dark') return `${base} dark`;
    if (theme === 'high-contrast') return `${base} high-contrast`;
    return base;
  }, [theme]);

  return createElement(
    'div',
    { className: 'playground-app' },

    createElement(
      'div',
      { className: 'playground-toolbar' },

      createElement('span', { className: 'toolbar-badge' }, 'EMD.DEV'),

      createElement('div', { className: 'toolbar-spacer' }),

      createElement(
        'button',
        {
          className: `toolbar-btn ${theme === 'dark' ? 'active' : ''}`,
          onClick: () => handleToggleTheme('dark'),
        },
        'Dark',
      ),
      createElement(
        'button',
        {
          className: `toolbar-btn ${theme === 'light' ? 'active' : ''}`,
          onClick: () => handleToggleTheme('light'),
        },
        'Light',
      ),
      createElement(
        'button',
        {
          className: `toolbar-btn ${theme === 'high-contrast' ? 'active' : ''}`,
          onClick: () => handleToggleTheme('high-contrast'),
        },
        'HC',
      ),

      createElement(
        'button',
        {
          className: `toolbar-btn ${showInspector ? 'active' : ''}`,
          onClick: () => setShowInspector((v) => !v),
        },
        'Inspector',
      ),
      createElement(
        'button',
        {
          className: `toolbar-btn ${showConsole ? 'active' : ''}`,
          onClick: () => setShowConsole((v) => !v),
        },
        'Console',
      ),
      createElement(
        'button',
        {
          className: 'toolbar-btn',
          onClick: handleSave,
        },
        'Save',
      ),
    ),

    createElement(
      'div',
      { className: 'playground-body' },

      createElement(
        'div',
        { className: 'playground-sidebar' },

        createElement(
          'div',
          { className: 'sidebar-header' },
          createElement('span', null, 'Files'),
          createElement(
            'button',
            {
              className: 'open-all-btn',
              onClick: openAllFiles,
            },
            'Open All',
          ),
        ),

        createElement(
          'ul',
          { className: 'file-list' },
          sampleFiles.map((sf) =>
            createElement(
              'li',
              {
                key: sf.filename,
                className:
                  sf.filename === activeTab?.filename ? 'active' : '',
                onClick: () => openFile(sf.filename),
              },
              sf.displayName,
            ),
          ),
        ),
      ),

      createElement(
        'div',
        { className: 'playground-main' },

        createElement(
          'div',
          { className: 'tab-bar' },
          tabs.map((tab) =>
            createElement(
              'button',
              {
                key: tab.id,
                className: `tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`,
                onClick: () => selectTab(tab.id),
              },
              tab.filename,
              createElement(
                'span',
                {
                  className: 'tab-close',
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  },
                  title: 'Close tab',
                },
                '\u00D7',
              ),
            ),
          ),
          tabs.length === 0 &&
            createElement(
              'div',
              { className: 'editor-empty' },
              createElement(
                'p',
                null,
                'Select a file from the sidebar to start editing.',
                createElement('br'),
                'Press ',
                createElement('kbd', null, 'Cmd+S'),
                ' to save.',
              ),
            ),
        ),

        tabs.length > 0 &&
          createElement(
            'div',
            { className: editorAreaClass },
            createElement(EmdEditor, {
              ref: editorRef,
              value: activeTab?.content ?? '',
              onChange: handleContentChange,
              config: liveMdConfig,
              onNavigate: handleNavigate,
              onSave: handleSave,
              className: 'playground-editor',
            }),
          ),

        showConsole &&
          createElement(
            'div',
            { className: 'playground-console' },
            createElement(
              'div',
              { className: 'console-header' },
              createElement('span', null, 'Console'),
              createElement(
                'button',
                {
                  className: 'console-clear-btn',
                  onClick: clearConsole,
                },
                'Clear',
              ),
            ),
            consoleLogs.map((entry) =>
              createElement(
                'div',
                {
                  key: entry.id,
                  className: `console-entry ${entry.type}`,
                },
                createElement('span', { className: 'ts' }, entry.timestamp),
                entry.message,
              ),
            ),
            consoleLogs.length === 0 &&
              createElement(
                'div',
                {
                  className: 'console-entry info',
                  style: { fontStyle: 'italic' },
                },
                'Events will appear here...',
              ),
          ),
      ),

      showInspector &&
        createElement(
          'div',
          { className: 'playground-inspector' },

          createElement(
            'div',
            { className: 'inspector-section' },
            createElement('h3', null, 'Theme'),
            createElement(
              'div',
              { className: 'theme-btn-group' },
              createElement(
                'button',
                {
                  className: `theme-btn ${theme === 'light' ? 'selected' : ''}`,
                  onClick: () => handleToggleTheme('light'),
                },
                'Light',
              ),
              createElement(
                'button',
                {
                  className: `theme-btn ${theme === 'dark' ? 'selected' : ''}`,
                  onClick: () => handleToggleTheme('dark'),
                },
                'Dark',
              ),
              createElement(
                'button',
                {
                  className: `theme-btn ${theme === 'high-contrast' ? 'selected' : ''}`,
                  onClick: () => handleToggleTheme('high-contrast'),
                },
                'HC',
              ),
            ),
          ),

          createElement(
            'div',
            { className: 'inspector-section' },
            createElement('h3', null, 'Live Markdown Features'),
            FEATURE_KEYS.map((key) =>
              createElement(
                'label',
                {
                  key,
                  className: 'feature-toggle',
                },
                key.charAt(0).toUpperCase() + key.slice(1),
                createElement('input', {
                  type: 'checkbox',
                  checked: featureToggles[key],
                  onChange: () => toggleFeature(key),
                }),
              ),
            ),
          ),

          createElement(
            'div',
            { className: 'inspector-actions' },
            createElement(
              'button',
              {
                className: 'inspector-btn primary',
                onClick: () => setShowBlockTester(true),
                disabled: !activeTab,
              },
              'Block Tester',
            ),
          ),
        ),
    ),

    showBlockTester &&
      createElement(BlockTester, {
        currentContent: activeTab?.content ?? '',
        currentFilename: activeFileInSamples ?? undefined,
        theme,
        featureToggles,
        onClose: () => setShowBlockTester(false),
      }),
  );
}
