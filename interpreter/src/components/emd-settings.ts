const EMD_SETTINGS_TAG = 'emd-settings';

interface EmdSettingsData {
  fontSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  theme: 'light' | 'dark' | 'high-contrast';
}

const DEFAULT_SETTINGS: EmdSettingsData = {
  fontSize: 14,
  lineNumbers: true,
  wordWrap: true,
  theme: 'light',
};

export class EmdSettings extends HTMLElement {
  private settings: EmdSettingsData;

  constructor() {
    super();
    this.settings = this.loadSettings();
  }

  connectedCallback(): void {
    this.classList.add('emd-settings-overlay');
    this.innerHTML = this.renderHTML();
    this.setupEvents();
    this.applyValues();
  }

  private loadSettings(): EmdSettingsData {
    try {
      const raw = localStorage.getItem('emd-settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem('emd-settings', JSON.stringify(this.settings));
    this.applyTheme();
  }

  private applyTheme(): void {
    const root = document.querySelector('emd-workspace')?.closest('html') ?? document.documentElement;
    root.classList.remove('emd-theme-light', 'emd-theme-dark', 'emd-theme-high-contrast');
    root.classList.add(`emd-theme-${this.settings.theme}`);
  }

  private renderHTML(): string {
    return `
      <div class="emd-settings-panel">
        <div class="emd-settings-header">
          <h2>Settings</h2>
          <button class="emd-settings-close" title="Close (Esc)">&times;</button>
        </div>
        <div class="emd-settings-body">
          <section class="emd-settings-section">
            <h3>Editor</h3>
            <div class="emd-settings-field">
              <label>Font Size</label>
              <input type="range" id="emd-settings-fontsize" min="10" max="24" value="${this.settings.fontSize}" step="1">
              <span class="emd-settings-value" id="emd-settings-fontsize-val">${this.settings.fontSize}px</span>
            </div>
            <div class="emd-settings-field">
              <label>Line Numbers</label>
              <input type="checkbox" id="emd-settings-linenumbers" ${this.settings.lineNumbers ? 'checked' : ''}>
            </div>
            <div class="emd-settings-field">
              <label>Word Wrap</label>
              <input type="checkbox" id="emd-settings-wordwrap" ${this.settings.wordWrap ? 'checked' : ''}>
            </div>
          </section>

          <section class="emd-settings-section">
            <h3>Theme</h3>
            <div class="emd-settings-field">
              <label>Appearance</label>
              <select id="emd-settings-theme">
                <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="high-contrast" ${this.settings.theme === 'high-contrast' ? 'selected' : ''}>High Contrast</option>
              </select>
            </div>
          </section>

          <section class="emd-settings-section">
            <h3>AI</h3>
            <p class="emd-settings-note">AI provider configuration coming in Phase 4.</p>
          </section>

          <section class="emd-settings-section">
            <h3>Keyboard Shortcuts</h3>
            <div class="emd-settings-shortcuts">
              <div class="emd-settings-shortcut"><kbd>Cmd+\\</kbd> <span>Toggle split view</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+W</kbd> <span>Close tab</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+S</kbd> <span>Save file</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+Z</kbd> <span>Undo</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+Shift+Z</kbd> <span>Redo</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+1..9</kbd> <span>Jump to tab</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+Shift+]</kbd> <span>Next tab</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+Shift+[</kbd> <span>Previous tab</span></div>
              <div class="emd-settings-shortcut"><kbd>Cmd+,</kbd> <span>Settings</span></div>
              <div class="emd-settings-shortcut"><kbd>Arrow Up/Down</kbd> <span>Navigate blocks</span></div>
              <div class="emd-settings-shortcut"><kbd>Tab</kbd> <span>Indent block</span></div>
              <div class="emd-settings-shortcut"><kbd>Shift+Tab</kbd> <span>Outdent block</span></div>
              <div class="emd-settings-shortcut"><kbd>Escape</kbd> <span>Dismiss / deselect</span></div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  private setupEvents(): void {
    this.addEventListener('click', (e) => {
      if (e.target === this) this.dismiss();
    });

    this.querySelector('.emd-settings-close')?.addEventListener('click', () => this.dismiss());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.dismiss();
    }, { once: true });

    const fontSizeSlider = this.querySelector('#emd-settings-fontsize') as HTMLInputElement;
    fontSizeSlider?.addEventListener('input', () => {
      this.settings.fontSize = parseInt(fontSizeSlider.value);
      const valEl = this.querySelector('#emd-settings-fontsize-val');
      if (valEl) valEl.textContent = `${this.settings.fontSize}px`;
      this.saveSettings();
    });

    const lineNumbers = this.querySelector('#emd-settings-linenumbers') as HTMLInputElement;
    lineNumbers?.addEventListener('change', () => {
      this.settings.lineNumbers = lineNumbers.checked;
      this.saveSettings();
    });

    const wordWrap = this.querySelector('#emd-settings-wordwrap') as HTMLInputElement;
    wordWrap?.addEventListener('change', () => {
      this.settings.wordWrap = wordWrap.checked;
      this.saveSettings();
    });

    const theme = this.querySelector('#emd-settings-theme') as HTMLSelectElement;
    theme?.addEventListener('change', () => {
      this.settings.theme = theme.value as EmdSettingsData['theme'];
      this.saveSettings();
    });
  }

  private applyValues(): void {
    this.applyTheme();
  }

  private dismiss(): void {
    this.dispatchEvent(new CustomEvent('close'));
    this.remove();
  }
}

if (!customElements.get(EMD_SETTINGS_TAG)) {
  customElements.define(EMD_SETTINGS_TAG, EmdSettings);
}

export { EMD_SETTINGS_TAG };
