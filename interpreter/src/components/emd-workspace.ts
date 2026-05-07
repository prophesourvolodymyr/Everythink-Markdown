import type { StorageProvider, EmdIndexEntry } from '@core/types';
import { EmdEditor } from './emd-editor';

const EMD_WORKSPACE_TAG = 'emd-workspace';

export class EmdWorkspace extends HTMLElement {
  private editors = new Map<string, EmdEditor>();
  private activeEditorPath: string | null = null;
  private storage: StorageProvider | null = null;
  private tabBar!: HTMLElement;
  private editorContainer!: HTMLElement;
  private sidebar!: HTMLElement;
  private sidebarVisible = false;

  get openFiles(): string[] {
    return Array.from(this.editors.keys());
  }

  get activeFile(): string | null {
    return this.activeEditorPath;
  }

  async initialize(storage: StorageProvider): Promise<void> {
    this.storage = storage;
    this.innerHTML = '';

    this.tabBar = document.createElement('div');
    this.tabBar.className = 'emd-workspace-tab-bar';
    this.tabBar.setAttribute('role', 'tablist');

    this.editorContainer = document.createElement('div');
    this.editorContainer.className = 'emd-workspace-editor-container';

    this.sidebar = document.createElement('div');
    this.sidebar.className = 'emd-workspace-sidebar';
    this.sidebar.setAttribute('role', 'tree');
    this.sidebar.style.display = 'none';

    const mainArea = document.createElement('div');
    mainArea.className = 'emd-workspace-main';
    mainArea.appendChild(this.tabBar);
    mainArea.appendChild(this.editorContainer);

    this.appendChild(this.sidebar);
    this.appendChild(mainArea);

    this.classList.add('emd-workspace');
  }

  async openFile(filePath: string): Promise<EmdEditor> {
    const existing = this.editors.get(filePath);
    if (existing) {
      this.setActiveFile(filePath);
      return existing;
    }

    const editor = document.createElement('emd-editor') as EmdEditor;
    editor.style.display = 'none';
    this.editorContainer.appendChild(editor);

    if (this.storage) {
      await editor.initialize({ storage: this.storage });
      await editor.loadFile(filePath);
    }

    this.editors.set(filePath, editor);
    this.addTab(filePath);
    this.setActiveFile(filePath);

    return editor;
  }

  closeFile(filePath: string): void {
    const editor = this.editors.get(filePath);
    if (!editor) {
      return;
    }

    editor.unmount();
    editor.remove();
    this.editors.delete(filePath);
    this.removeTab(filePath);

    if (this.activeEditorPath === filePath) {
      const remaining = Array.from(this.editors.keys());
      if (remaining.length > 0) {
        this.setActiveFile(remaining[remaining.length - 1]!);
      } else {
        this.activeEditorPath = null;
      }
    }
  }

  setActiveFile(filePath: string): void {
    if (this.activeEditorPath) {
      const prevEditor = this.editors.get(this.activeEditorPath);
      if (prevEditor) {
        prevEditor.style.display = 'none';
      }
    }

    this.activeEditorPath = filePath;
    const editor = this.editors.get(filePath);
    if (editor) {
      editor.style.display = '';
    }

    this.updateActiveTab(filePath);
  }

  getActiveEditor(): EmdEditor | null {
    if (!this.activeEditorPath) {
      return null;
    }
    return this.editors.get(this.activeEditorPath) ?? null;
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    this.sidebar.style.display = this.sidebarVisible ? '' : 'none';
  }

  isSidebarVisible(): boolean {
    return this.sidebarVisible;
  }

  async refreshFileExplorer(): Promise<void> {
    if (!this.storage || !this.sidebarVisible) {
      return;
    }

    try {
      const files = await this.storage.list('.');
      const emdFiles = files.filter((f) => f.endsWith('.emd'));

      this.sidebar.innerHTML = '';
      const treeRoot = document.createElement('div');
      treeRoot.className = 'emd-file-tree';

      for (const file of emdFiles) {
        const item = document.createElement('div');
        item.className = 'emd-file-tree-item';
        item.textContent = file;
        item.setAttribute('role', 'treeitem');
        item.addEventListener('click', () => this.openFile(file));
        treeRoot.appendChild(item);
      }

      this.sidebar.appendChild(treeRoot);
    } catch (err) {
      console.error('Failed to refresh file explorer:', err);
    }
  }

  private addTab(filePath: string): void {
    const tab = document.createElement('div');
    tab.className = 'emd-workspace-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-file-path', filePath);
    tab.textContent = this.fileNameFromPath(filePath);

    tab.addEventListener('click', () => this.setActiveFile(filePath));

    const closeBtn = document.createElement('span');
    closeBtn.className = 'emd-workspace-tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeFile(filePath);
    });

    tab.appendChild(closeBtn);
    this.tabBar.appendChild(tab);
  }

  private removeTab(filePath: string): void {
    const tab = this.tabBar.querySelector(`[data-file-path="${filePath}"]`);
    tab?.remove();
  }

  private updateActiveTab(filePath: string): void {
    for (const tab of this.tabBar.children) {
      tab.classList.toggle(
        'emd-workspace-tab-active',
        tab.getAttribute('data-file-path') === filePath,
      );
    }
  }

  private fileNameFromPath(filePath: string): string {
    return filePath.split('/').pop() ?? filePath;
  }
}

if (!customElements.get(EMD_WORKSPACE_TAG)) {
  customElements.define(EMD_WORKSPACE_TAG, EmdWorkspace);
}

export { EMD_WORKSPACE_TAG };
