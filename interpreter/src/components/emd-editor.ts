import { BlockManager } from '@core/block-manager';
import type { EmdEditorConfig } from '@core/types';
import '../blocks/fallback-block';

const EMD_EDITOR_TAG = 'emd-editor';

export class EmdEditor extends HTMLElement {
  private blockManager: BlockManager | null = null;
  private initialized = false;

  static get observedAttributes(): string[] {
    return ['file-path', 'theme', 'readonly'];
  }

  get filePath(): string | null {
    return this.getAttribute('file-path');
  }

  set filePath(value: string | null) {
    if (value) {
      this.setAttribute('file-path', value);
    } else {
      this.removeAttribute('file-path');
    }
  }

  get theme(): string {
    return this.getAttribute('theme') ?? 'light';
  }

  set theme(value: string) {
    this.setAttribute('theme', value);
  }

  get readonly(): boolean {
    return this.hasAttribute('readonly');
  }

  set readonly(value: boolean) {
    if (value) {
      this.setAttribute('readonly', '');
    } else {
      this.removeAttribute('readonly');
    }
  }

  async initialize(config: EmdEditorConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.blockManager = new BlockManager(config);
    await this.blockManager.mount(this);
    this.initialized = true;
  }

  getBlockManager(): BlockManager | null {
    return this.blockManager;
  }

  unmount(): void {
    this.blockManager?.unmount();
    this.blockManager = null;
    this.initialized = false;
  }

  async loadFile(path: string): Promise<void> {
    if (!this.blockManager) {
      throw new Error('EmdEditor not initialized. Call initialize() first.');
    }
    this.filePath = path;
    await this.blockManager.loadFile(path);
  }

  async loadContent(source: string): Promise<void> {
    if (!this.blockManager) {
      throw new Error('EmdEditor not initialized. Call initialize() first.');
    }
    await this.blockManager.parseAndDiff(source);
  }

  connectedCallback(): void {
    this.classList.add('emd-editor');
    this.setAttribute('role', 'application');
    this.setAttribute('aria-label', 'EMD Editor');
  }

  disconnectedCallback(): void {
    this.blockManager?.unmount();
    this.blockManager = null;
    this.initialized = false;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'theme' && this.blockManager) {
      this.classList.remove('emd-theme-light', 'emd-theme-dark', 'emd-theme-high-contrast');
      this.classList.add(`emd-theme-${newValue ?? 'light'}`);
    }

    if (name === 'file-path' && newValue && this.blockManager) {
      this.blockManager.loadFile(newValue).catch(console.error);
    }
  }
}

if (!customElements.get(EMD_EDITOR_TAG)) {
  customElements.define(EMD_EDITOR_TAG, EmdEditor);
}

export { EMD_EDITOR_TAG };
