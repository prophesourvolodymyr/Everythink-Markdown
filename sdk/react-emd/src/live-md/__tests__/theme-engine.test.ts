import { describe, it, expect, beforeEach } from 'vitest';
import {
  LIGHT_THEME,
  DARK_THEME,
  HIGH_CONTRAST_THEME,
  buildThemeVariables,
  generateThemeCSS,
  injectThemeStyles,
  resolveThemeVariables,
  registerTheme,
  unregisterTheme,
  getTheme,
  listThemes,
} from '../theme-engine';

beforeEach(() => {
  for (const name of listThemes()) {
    unregisterTheme(name);
  }
});

describe('LIGHT_THEME', () => {
  it('contains all required variable groups', () => {
    expect(LIGHT_THEME['--emd-bg']).toBe('#ffffff');
    expect(LIGHT_THEME['--emd-text']).toBe('#1a1a2e');
    expect(LIGHT_THEME['--emd-accent']).toBe('#3b82f6');
    expect(LIGHT_THEME['--emd-font']).toBeDefined();
    expect(LIGHT_THEME['--emd-mono']).toBeDefined();
    expect(LIGHT_THEME['--emd-code-bg']).toBe('#f1f5f9');
    expect(LIGHT_THEME['--emd-widget-bg']).toBe('#ffffff');
    expect(LIGHT_THEME['--emd-progress-track']).toBe('#e5e7eb');
    expect(LIGHT_THEME['--emd-type-task']).toBe('#f59e0b');
    expect(LIGHT_THEME['--emd-status-done']).toBe('#22c55e');
  });

  it('contains all 25 type variables', () => {
    const typeVars = Object.keys(LIGHT_THEME).filter((k) =>
      k.startsWith('--emd-type-')
    );
    expect(typeVars.length).toBe(25);
  });

  it('contains all 7 status variables', () => {
    const statusVars = Object.keys(LIGHT_THEME).filter((k) =>
      k.startsWith('--emd-status-')
    );
    expect(statusVars.length).toBe(7);
  });
});

describe('DARK_THEME', () => {
  it('contains all required overrides', () => {
    expect(DARK_THEME['--emd-bg']).toBe('#1a1a2e');
    expect(DARK_THEME['--emd-text']).toBe('#e4e4e7');
    expect(DARK_THEME['--emd-accent']).toBe('#60a5fa');
    expect(DARK_THEME['--emd-code-bg']).toBe('#0f172a');
    expect(DARK_THEME['--emd-widget-bg']).toBe('#16213e');
    expect(DARK_THEME['--emd-progress-track']).toBe('#27272a');
  });

  it('only contains variables that differ from light', () => {
    const darkKeys = Object.keys(DARK_THEME);
    // Dark should not contain --emd-font (unchanged from light)
    expect(darkKeys).not.toContain('--emd-font');
    expect(darkKeys).not.toContain('--emd-mono');
    expect(darkKeys).not.toContain('--emd-radius');
    expect(darkKeys).not.toContain('--emd-transition');
    expect(darkKeys).not.toContain('--emd-heading-font');
  });
});

describe('HIGH_CONTRAST_THEME', () => {
  it('contains all required overrides', () => {
    expect(HIGH_CONTRAST_THEME['--emd-bg']).toBe('#000000');
    expect(HIGH_CONTRAST_THEME['--emd-text']).toBe('#ffffff');
    expect(HIGH_CONTRAST_THEME['--emd-accent']).toBe('#ffff00');
    expect(HIGH_CONTRAST_THEME['--emd-shadow']).toBe('none');
    expect(HIGH_CONTRAST_THEME['--emd-code-bg']).toBe('#1a1a1a');
    expect(HIGH_CONTRAST_THEME['--emd-widget-bg']).toBe('#1a1a1a');
  });
});

describe('buildThemeVariables', () => {
  it('light returns LIGHT_THEME values exactly', () => {
    const vars = buildThemeVariables('light');
    expect(vars['--emd-bg']).toBe('#ffffff');
    expect(vars['--emd-text']).toBe('#1a1a2e');
  });

  it('dark returns LIGHT_THEME merged with DARK_THEME overrides', () => {
    const vars = buildThemeVariables('dark');
    // Overridden
    expect(vars['--emd-bg']).toBe('#1a1a2e');
    expect(vars['--emd-text']).toBe('#e4e4e7');
    // Inherited from light
    expect(vars['--emd-font']).toBe('system-ui, -apple-system, sans-serif');
    expect(vars['--emd-radius']).toBe('4px');
  });

  it('high-contrast returns LIGHT_THEME merged with HIGH_CONTRAST_THEME overrides', () => {
    const vars = buildThemeVariables('high-contrast');
    expect(vars['--emd-bg']).toBe('#000000');
    expect(vars['--emd-text']).toBe('#ffffff');
    expect(vars['--emd-shadow']).toBe('none');
    // Inherited from light
    expect(vars['--emd-font']).toBe('system-ui, -apple-system, sans-serif');
  });
});

describe('generateThemeCSS', () => {
  it('produces valid CSS with .emd-theme-light selector', () => {
    const css = generateThemeCSS('light');
    expect(css).toContain('.emd-theme-light');
    expect(css).toContain('--emd-bg: #ffffff;');
    expect(css).toContain('--emd-text: #1a1a2e;');
  });

  it('produces valid CSS with .emd-theme-dark selector', () => {
    const css = generateThemeCSS('dark');
    expect(css).toContain('.emd-theme-dark');
    expect(css).toContain('--emd-bg: #1a1a2e');
    expect(css).toContain('--emd-text: #e4e4e7');
  });

  it('produces valid CSS with .emd-theme-high-contrast selector', () => {
    const css = generateThemeCSS('high-contrast');
    expect(css).toContain('.emd-theme-high-contrast');
    expect(css).toContain('--emd-bg: #000000;');
  });

  it('with custom theme produces CSS using custom theme name', () => {
    registerTheme('sepia', {
      '--emd-bg': '#f4ecd8',
      '--emd-text': '#5c4b33',
    });
    const css = generateThemeCSS('light', 'sepia');
    expect(css).toContain('.emd-theme-custom-sepia');
    expect(css).toContain('--emd-bg: #f4ecd8;');
    expect(css).toContain('--emd-text: #5c4b33;');
  });
});

describe('registerTheme / getTheme / listThemes / unregisterTheme', () => {
  it('stores a custom theme and can be retrieved via getTheme', () => {
    registerTheme('moonlight', {
      '--emd-bg': '#111122',
      '--emd-text': '#ccccdd',
    });
    const def = getTheme('moonlight');
    expect(def).toBeDefined();
    expect(def!.name).toBe('moonlight');
    expect(def!.variables['--emd-bg']).toBe('#111122');
  });

  it('listThemes returns all registered custom theme names', () => {
    registerTheme('a', { '--emd-bg': '#111' });
    registerTheme('b', { '--emd-bg': '#222' });
    const names = listThemes();
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names.length).toBe(2);
  });

  it('unregisterTheme removes a custom theme', () => {
    registerTheme('temp', { '--emd-bg': '#999' });
    const removed = unregisterTheme('temp');
    expect(removed).toBe(true);
    expect(getTheme('temp')).toBeUndefined();
    expect(listThemes()).not.toContain('temp');
  });

  it('unregisterTheme returns false for non-existent theme', () => {
    const removed = unregisterTheme('nonexistent');
    expect(removed).toBe(false);
  });

  it('getTheme returns undefined for unregistered theme', () => {
    expect(getTheme('does-not-exist')).toBeUndefined();
  });
});

describe('resolveThemeVariables', () => {
  it('without custom theme name returns builtin theme variables', () => {
    const vars = resolveThemeVariables('dark');
    expect(vars['--emd-bg']).toBe('#1a1a2e');
  });

  it('with custom theme name merges custom vars over light defaults', () => {
    registerTheme('ocean', {
      '--emd-bg': '#0a192f',
      '--emd-text': '#8892b0',
    });
    const vars = resolveThemeVariables('light', 'ocean');
    expect(vars['--emd-bg']).toBe('#0a192f');
    expect(vars['--emd-text']).toBe('#8892b0');
    // Falls back to light defaults
    expect(vars['--emd-accent']).toBe('#3b82f6');
    expect(vars['--emd-font']).toBe('system-ui, -apple-system, sans-serif');
  });

  it('custom theme with partial variables inherits light defaults', () => {
    registerTheme('partial', {
      '--emd-accent': '#ff0000',
    });
    const vars = resolveThemeVariables('light', 'partial');
    expect(vars['--emd-accent']).toBe('#ff0000');
    expect(vars['--emd-bg']).toBe('#ffffff');
    expect(vars['--emd-text']).toBe('#1a1a2e');
  });

  it('with unknown custom theme name falls back to builtin', () => {
    const vars = resolveThemeVariables('dark', 'does-not-exist');
    expect(vars['--emd-bg']).toBe('#1a1a2e');
  });
});

describe('injectThemeStyles', () => {
  it('creates a <style> element in the container', () => {
    const container = document.createElement('div');
    injectThemeStyles(container, 'light');

    const styleEl = container.querySelector('#emd-theme-styles');
    expect(styleEl).not.toBeNull();
    expect(styleEl!.tagName).toBe('STYLE');
    expect(styleEl!.textContent).toContain('.emd-theme-light');
    expect(styleEl!.textContent).toContain('--emd-bg: #ffffff;');
  });

  it('updates existing <style> element instead of creating a new one', () => {
    const container = document.createElement('div');
    injectThemeStyles(container, 'light');
    injectThemeStyles(container, 'dark');

    const styles = container.querySelectorAll('#emd-theme-styles');
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain('.emd-theme-dark');
    expect(styles[0].textContent).toContain('--emd-bg: #1a1a2e');
  });
});
