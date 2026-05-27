import type { ThemeMode, ThemeDefinition } from './types';

export const LIGHT_THEME: Record<string, string> = {
  '--emd-bg': '#ffffff',
  '--emd-bg-secondary': '#f3f4f6',
  '--emd-bg-tertiary': '#e5e7eb',
  '--emd-text': '#1a1a2e',
  '--emd-text-secondary': '#4b5563',
  '--emd-text-muted': '#9ca3af',
  '--emd-border': '#d1d5db',
  '--emd-accent': '#3b82f6',
  '--emd-accent-hover': '#2563eb',
  '--emd-accent-text': '#ffffff',
  '--emd-selection': '#bfdbfe',
  '--emd-focus-ring': '#3b82f6',
  '--emd-shadow': '0 1px 3px rgba(0,0,0,0.1)',
  '--emd-radius': '4px',
  '--emd-transition': '150ms',
  '--emd-font': 'system-ui, -apple-system, sans-serif',
  '--emd-mono': 'ui-monospace, SFMono-Regular, monospace',
  '--emd-heading-font': 'system-ui, -apple-system, sans-serif',

  '--emd-code-bg': '#f1f5f9',
  '--emd-code-text': '#1e293b',
  '--emd-inline-code-bg': '#f1f5f9',

  '--emd-widget-bg': '#ffffff',
  '--emd-widget-border': '#e5e7eb',
  '--emd-tooltip-bg': '#1a1a2e',
  '--emd-tooltip-text': '#ffffff',

  '--emd-progress-track': '#e5e7eb',
  '--emd-progress-label': '#6b7280',

  '--emd-type-task': '#f59e0b',
  '--emd-type-decision': '#0d9488',
  '--emd-type-spec': '#2563eb',
  '--emd-type-api': '#4f46e5',
  '--emd-type-bug': '#ef4444',
  '--emd-type-idea': '#eab308',
  '--emd-type-verify': '#f97316',
  '--emd-type-summary': '#6b7280',
  '--emd-type-detail': '#78716c',
  '--emd-type-memory': '#a855f7',
  '--emd-type-log': '#9ca3af',
  '--emd-type-meta': '#6b7280',
  '--emd-type-config': '#64748b',
  '--emd-type-schema': '#38bdf8',
  '--emd-type-model': '#8b5cf6',
  '--emd-type-agent': '#d946ef',
  '--emd-type-graph': '#14b8a6',
  '--emd-type-prompt': '#d97706',
  '--emd-type-template': '#a8a29e',
  '--emd-type-human': '#f43f5e',
  '--emd-type-draw': '#ec4899',
  '--emd-type-flow': '#06b6d4',
  '--emd-type-kanban': '#84cc16',
  '--emd-type-example': '#22c55e',
  '--emd-type-unknown': '#9ca3af',

  '--emd-status-done': '#22c55e',
  '--emd-status-pending': '#9ca3af',
  '--emd-status-in-progress': '#f59e0b',
  '--emd-status-blocked': '#ef4444',
  '--emd-status-archived': '#6b7280',
  '--emd-status-cancelled': '#6b7280',
  '--emd-status-unknown': '#9ca3af',
};

export const DARK_THEME: Record<string, string> = {
  '--emd-bg': '#1a1a2e',
  '--emd-bg-secondary': '#16213e',
  '--emd-bg-tertiary': '#0f3460',
  '--emd-text': '#e4e4e7',
  '--emd-text-secondary': '#a1a1aa',
  '--emd-text-muted': '#71717a',
  '--emd-border': '#27272a',
  '--emd-accent': '#60a5fa',
  '--emd-accent-hover': '#3b82f6',
  '--emd-accent-text': '#1a1a2e',
  '--emd-selection': '#1e3a5f',
  '--emd-focus-ring': '#60a5fa',
  '--emd-shadow': '0 1px 3px rgba(0,0,0,0.4)',
  '--emd-code-bg': '#0f172a',
  '--emd-code-text': '#e2e8f0',
  '--emd-inline-code-bg': '#0f172a',
  '--emd-widget-bg': '#16213e',
  '--emd-widget-border': '#27272a',
  '--emd-tooltip-bg': '#e4e4e7',
  '--emd-tooltip-text': '#1a1a2e',
  '--emd-progress-track': '#27272a',
  '--emd-progress-label': '#71717a',
};

export const HIGH_CONTRAST_THEME: Record<string, string> = {
  '--emd-bg': '#000000',
  '--emd-bg-secondary': '#1a1a1a',
  '--emd-bg-tertiary': '#333333',
  '--emd-text': '#ffffff',
  '--emd-text-secondary': '#ffffff',
  '--emd-text-muted': '#cccccc',
  '--emd-border': '#ffffff',
  '--emd-accent': '#ffff00',
  '--emd-accent-hover': '#ffcc00',
  '--emd-accent-text': '#000000',
  '--emd-selection': '#333333',
  '--emd-focus-ring': '#ffff00',
  '--emd-shadow': 'none',
  '--emd-code-bg': '#1a1a1a',
  '--emd-code-text': '#ffffff',
  '--emd-inline-code-bg': '#1a1a1a',
  '--emd-widget-bg': '#1a1a1a',
  '--emd-widget-border': '#ffffff',
  '--emd-tooltip-bg': '#ffffff',
  '--emd-tooltip-text': '#000000',
  '--emd-progress-track': '#333333',
  '--emd-progress-label': '#cccccc',
};

const customThemes = new Map<string, ThemeDefinition>();

export function registerTheme(name: string, variables: Record<string, string>): void {
  customThemes.set(name, { name, variables });
}

export function unregisterTheme(name: string): boolean {
  return customThemes.delete(name);
}

export function getTheme(name: string): ThemeDefinition | undefined {
  return customThemes.get(name);
}

export function listThemes(): string[] {
  return Array.from(customThemes.keys());
}

export function buildThemeVariables(mode: ThemeMode): Record<string, string> {
  const overrides =
    mode === 'dark'
      ? DARK_THEME
      : mode === 'high-contrast'
        ? HIGH_CONTRAST_THEME
        : {};
  return { ...LIGHT_THEME, ...overrides };
}

export function resolveThemeVariables(
  mode: ThemeMode,
  customThemeName?: string
): Record<string, string> {
  if (customThemeName) {
    const def = customThemes.get(customThemeName);
    if (def) return { ...LIGHT_THEME, ...def.variables };
  }
  return buildThemeVariables(mode);
}

export function generateThemeCSS(
  mode: ThemeMode,
  customThemeName?: string
): string {
  const variables = resolveThemeVariables(mode, customThemeName);
  const className =
    customThemeName ? `emd-theme-custom-${customThemeName}` : `emd-theme-${mode}`;
  const varsCSS = Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `.${className} {\n${varsCSS}\n}`;
}

export function injectThemeStyles(
  container: HTMLElement,
  mode: ThemeMode,
  customThemeName?: string
): void {
  const styleId = 'emd-theme-styles';
  let styleEl = container.querySelector(`#${styleId}`) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    container.appendChild(styleEl);
  }

  styleEl.textContent = generateThemeCSS(mode, customThemeName);
}
