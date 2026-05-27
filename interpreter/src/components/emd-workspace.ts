import type { StorageProvider, EmdIndexEntry } from '@core/types';
import { EmdEditor } from './emd-editor';

const EMD_WORKSPACE_TAG = 'emd-workspace';

interface TabState {
  path: string;
  sectionType: string;
  dirty: boolean;
}

const SECTION_TAB_COLORS: Record<string, string> = {
  task: '#f59e0b',
  agent: '#a855f7',
  graph: '#22c55e',
  spec: '#3b82f6',
  bug: '#ef4444',
  idea: '#ec4899',
  decision: '#f97316',
  verify: '#06b6d4',
  summary: '#6b7280',
  detail: '#64748b',
  meta: '#8b5cf6',
  config: '#84cc16',
  api: '#14b8a6',
  model: '#e11d48',
  prompt: '#d946ef',
  memory: '#78716c',
  schema: '#0ea5e9',
  log: '#a1a1aa',
};

interface BannerConfig {
  image?: string;
  color?: string;
  text?: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: Map<string, FileTreeNode>;
}

export class EmdWorkspace extends HTMLElement {
  private editors = new Map<string, EmdEditor>();
  private activeEditorPath: string | null = null;
  private storage: StorageProvider | null = null;
  private tabBar!: HTMLElement;
  private editorContainer!: HTMLElement;
  private splitContainer!: HTMLElement;
  private splitDivider!: HTMLElement;
  private secondaryEditorContainer!: HTMLElement;
  private sidebar!: HTMLElement;
  private sidebarVisible = false;
  private breadcrumbBar!: HTMLElement;
  private banner!: HTMLElement;
  private bannerConfig: BannerConfig = {};
  private bannerContextMenu: HTMLElement | null = null;
  private dirtyFiles = new Set<string>();
  private tabContextMenu: HTMLElement | null = null;
  private splitMode = false;

  get openFiles(): string[] {
    return Array.from(this.editors.keys());
  }

  get activeFile(): string | null {
    return this.activeEditorPath;
  }

  async initialize(storage: StorageProvider): Promise<void> {
    this.storage = storage;
    this.innerHTML = '';

    this.breadcrumbBar = document.createElement('div');
    this.breadcrumbBar.className = 'emd-workspace-breadcrumb';

    this.banner = document.createElement('div');
    this.banner.className = 'emd-workspace-banner';
    this.banner.textContent = 'EMD Interpreter';
    this.banner.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showBannerContextMenu(e.clientX, e.clientY);
    });
    this.loadBannerConfig();

    this.tabBar = document.createElement('div');
    this.tabBar.className = 'emd-workspace-tab-bar';
    this.tabBar.setAttribute('role', 'tablist');

    this.editorContainer = document.createElement('div');
    this.editorContainer.className = 'emd-workspace-editor-container';

    this.secondaryEditorContainer = document.createElement('div');
    this.secondaryEditorContainer.className = 'emd-workspace-editor-container emd-workspace-editor-secondary';
    this.secondaryEditorContainer.style.display = 'none';

    this.splitDivider = document.createElement('div');
    this.splitDivider.className = 'emd-workspace-split-divider';
    this.splitDivider.style.display = 'none';
    this.splitDivider.addEventListener('mousedown', this.onSplitDividerMouseDown);

    this.splitContainer = document.createElement('div');
    this.splitContainer.className = 'emd-workspace-split-container';
    this.splitContainer.appendChild(this.editorContainer);
    this.splitContainer.appendChild(this.splitDivider);
    this.splitContainer.appendChild(this.secondaryEditorContainer);

    this.sidebar = document.createElement('div');
    this.sidebar.className = 'emd-workspace-sidebar';
    this.sidebar.setAttribute('role', 'tree');
    this.sidebar.style.display = 'none';

    const mainArea = document.createElement('div');
    mainArea.className = 'emd-workspace-main';
    mainArea.appendChild(this.breadcrumbBar);
    mainArea.appendChild(this.banner);
    mainArea.appendChild(this.tabBar);
    mainArea.appendChild(this.splitContainer);

    this.appendChild(this.sidebar);
    this.appendChild(mainArea);

    this.classList.add('emd-workspace');
    this.setupKeyboardShortcuts();
  }

  async openFile(filePath: string, sectionType?: string): Promise<EmdEditor> {
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
    this.addTab(filePath, sectionType);
    this.setActiveFile(filePath);

    return editor;
  }

  closeFile(filePath: string): void {
    const editor = this.editors.get(filePath);
    if (!editor) return;

    editor.unmount();
    editor.remove();
    this.editors.delete(filePath);
    this.dirtyFiles.delete(filePath);
    this.removeTab(filePath);
    this.dismissContextMenu();

    if (this.activeEditorPath === filePath) {
      const remaining = Array.from(this.editors.keys());
      if (remaining.length > 0) {
        this.setActiveFile(remaining[remaining.length - 1]!);
      } else {
        this.activeEditorPath = null;
        this.updateBreadcrumb();
      }
    }
  }

  closeOtherTabs(filePath: string): void {
    const filesToClose = Array.from(this.editors.keys()).filter((f) => f !== filePath);
    for (const f of filesToClose) {
      this.closeFile(f);
    }
  }

  closeAllTabs(): void {
    for (const f of Array.from(this.editors.keys())) {
      this.closeFile(f);
    }
  }

  closeTabsToRight(filePath: string): void {
    const keys = Array.from(this.editors.keys());
    const idx = keys.indexOf(filePath);
    if (idx >= 0) {
      for (let i = idx + 1; i < keys.length; i++) {
        this.closeFile(keys[i]!);
      }
    }
  }

  setActiveFile(filePath: string): void {
    if (this.activeEditorPath) {
      const prevEditor = this.editors.get(this.activeEditorPath);
      if (prevEditor) prevEditor.style.display = 'none';
    }

    this.activeEditorPath = filePath;
    const editor = this.editors.get(filePath);
    if (editor) editor.style.display = '';

    this.updateActiveTab(filePath);
    this.updateBreadcrumb();
  }

  markDirty(filePath: string): void {
    this.dirtyFiles.add(filePath);
    this.updateTabDirty(filePath, true);
  }

  markClean(filePath: string): void {
    this.dirtyFiles.delete(filePath);
    this.updateTabDirty(filePath, false);
  }

  isDirty(filePath: string): boolean {
    return this.dirtyFiles.has(filePath);
  }

  getActiveEditor(): EmdEditor | null {
    if (!this.activeEditorPath) return null;
    return this.editors.get(this.activeEditorPath) ?? null;
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    this.sidebar.style.display = this.sidebarVisible ? '' : 'none';
  }

  isSidebarVisible(): boolean {
    return this.sidebarVisible;
  }

  toggleSplitView(): void {
    this.splitMode = !this.splitMode;
    this.secondaryEditorContainer.style.display = this.splitMode ? '' : 'none';
    this.splitDivider.style.display = this.splitMode ? '' : 'none';

    if (this.splitMode) {
      this.editorContainer.style.flex = '1 1 50%';
      this.secondaryEditorContainer.style.flex = '1 1 50%';
    } else {
      this.editorContainer.style.flex = '';
      this.secondaryEditorContainer.innerHTML = '';
    }
  }

  isSplitViewActive(): boolean {
    return this.splitMode;
  }

  showSettings(): void {
    const existing = document.querySelector('emd-settings');
    if (existing) {
      existing.remove();
      return;
    }

    const settings = document.createElement('emd-settings') as import('./emd-settings').EmdSettings;
    document.body.appendChild(settings);
    settings.addEventListener('close', () => settings.remove());
  }

  jumpToTab(index: number): void {
    const keys = Array.from(this.editors.keys());
    if (index >= 0 && index < keys.length) {
      this.setActiveFile(keys[index]!);
    }
  }

  cycleTab(direction: 1 | -1): void {
    const keys = Array.from(this.editors.keys());
    if (keys.length === 0) return;
    const currentIdx = this.activeEditorPath ? keys.indexOf(this.activeEditorPath) : -1;
    const newIdx = (currentIdx + direction + keys.length) % keys.length;
    this.setActiveFile(keys[newIdx]!);
  }

  async refreshFileExplorer(): Promise<void> {
    if (!this.storage || !this.sidebarVisible) return;

    try {
      const files = await this.storage.list('.');
      const emdFiles = files.filter((f) => f.endsWith('.emd'));

      const ignorePatterns = await this.loadGitignorePatterns();
      const filtered = emdFiles.filter((f) => !this.isGitignored(f, ignorePatterns));

      const tree = this.buildFileTree(filtered);

      this.sidebar.innerHTML = '';
      const searchBox = document.createElement('input');
      searchBox.className = 'emd-file-search';
      searchBox.placeholder = 'Filter files...';
      searchBox.addEventListener('input', () => {
        const term = searchBox.value.toLowerCase();
        const items = this.sidebar.querySelectorAll('.emd-file-tree-item, .emd-file-tree-folder');
        for (const item of items) {
          const el = item as HTMLElement;
          const text = (el.getAttribute('data-path') ?? '').toLowerCase();
          el.style.display = text.includes(term) ? '' : 'none';
        }
      });
      this.sidebar.appendChild(searchBox);

      const treeRoot = document.createElement('div');
      treeRoot.className = 'emd-file-tree';
      this.renderFileTree(treeRoot, tree, '');

      this.sidebar.appendChild(treeRoot);
    } catch (err) {
      console.error('Failed to refresh file explorer:', err);
    }
  }

  private buildFileTree(files: string[]): Map<string, FileTreeNode> {
    const root = new Map<string, FileTreeNode>();

    for (const file of files) {
      const parts = file.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const isFile = i === parts.length - 1;
        const fullPath = parts.slice(0, i + 1).join('/');

        if (!current.has(part)) {
          current.set(part, {
            name: part,
            path: fullPath,
            isFile,
            children: new Map(),
          });
        }

        const node = current.get(part)!;
        if (isFile) {
          node.isFile = true;
        }
        current = node.children;
      }
    }

    return root;
  }

  private renderFileTree(
    container: HTMLElement,
    nodes: Map<string, FileTreeNode>,
    indent: string,
  ): void {
    const sorted = Array.from(nodes.values()).sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    for (const node of sorted) {
      if (node.isFile) {
        const item = document.createElement('div');
        item.className = 'emd-file-tree-item';
        item.setAttribute('role', 'treeitem');
        item.setAttribute('data-path', node.path);
        item.style.paddingLeft = `${12 + indent.length * 16}px`;

        if (this.activeEditorPath === node.path) {
          item.classList.add('emd-file-tree-item-active');
        }

        const icon = document.createElement('span');
        icon.className = 'emd-file-tree-icon';
        icon.textContent = '📄';
        item.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'emd-file-tree-label';
        label.textContent = node.name;
        item.appendChild(label);

        const dragHandle = document.createElement('span');
        dragHandle.className = 'emd-file-tree-drag-handle';
        dragHandle.textContent = '⠿';
        dragHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          this.onFileTreeDragStart(e as MouseEvent, node.path);
        });
        item.appendChild(dragHandle);

        item.addEventListener('click', () => this.openFile(node.path));
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showFileTreeContextMenu(e.clientX, e.clientY, node.path, false);
        });

        container.appendChild(item);
      } else {
        const folder = document.createElement('div');
        folder.className = 'emd-file-tree-folder';
        folder.setAttribute('role', 'treeitem');
        folder.setAttribute('data-path', node.path);
        folder.style.paddingLeft = `${12 + indent.length * 16}px`;

        const header = document.createElement('div');
        header.className = 'emd-file-tree-folder-header';

        const toggle = document.createElement('span');
        toggle.className = 'emd-file-tree-toggle';
        toggle.textContent = '▶';
        header.appendChild(toggle);

        const icon = document.createElement('span');
        icon.className = 'emd-file-tree-icon';
        icon.textContent = '📁';
        header.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'emd-file-tree-label';
        label.textContent = node.name;
        header.appendChild(label);

        const children = document.createElement('div');
        children.className = 'emd-file-tree-children';
        children.style.display = 'none';

        this.renderFileTree(children, node.children, indent + '  ');

        header.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = children.style.display !== 'none';
          children.style.display = isOpen ? 'none' : '';
          toggle.textContent = isOpen ? '▶' : '▼';
        });

        folder.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showFileTreeContextMenu(e.clientX, e.clientY, node.path, true);
        });

        folder.appendChild(header);
        folder.appendChild(children);
        container.appendChild(folder);
      }
    }
  }

  private showFileTreeContextMenu(
    x: number,
    y: number,
    path: string,
    isFolder: boolean,
  ): void {
    this.dismissContextMenu();

    const menu = document.createElement('div');
    menu.className = 'emd-tab-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items: { label: string; action: () => void }[] = [];

    if (isFolder) {
      items.push(
        {
          label: 'New File',
          action: async () => {
            const name = prompt('File name (e.g. notes.emd):');
            if (name && this.storage) {
              const filePath = `${path}/${name}`;
              await this.storage.write(filePath, '## [summary] New File\n\nStart writing...\n');
              await this.refreshFileExplorer();
              await this.openFile(filePath);
            }
          },
        },
        {
          label: 'New Folder',
          action: async () => {
            const name = prompt('Folder name:');
            if (name && this.storage) {
              await this.storage.mkdir(`${path}/${name}`);
              await this.refreshFileExplorer();
            }
          },
        },
      );
    }

    items.push(
      {
        label: 'Rename',
        action: async () => {
          const newName = prompt('New name:', path.split('/').pop() ?? path);
          if (newName && this.storage) {
            const parts = path.split('/');
            parts[parts.length - 1] = newName;
            const newPath = parts.join('/');
            await this.storage.rename(path, newPath);
            await this.refreshFileExplorer();
          }
        },
      },
      {
        label: 'Delete',
        action: async () => {
          const confirmed = confirm(`Delete "${path}"?`);
          if (confirmed && this.storage) {
            await this.storage.delete(path);
            await this.refreshFileExplorer();
          }
        },
      },
      {
        label: 'Copy Path',
        action: () => navigator.clipboard.writeText(path),
      },
    );

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'emd-tab-context-menu-item';
      el.textContent = item.label;
      el.addEventListener('click', () => {
        item.action();
        menu.remove();
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('click', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }

  private async loadGitignorePatterns(): Promise<string[]> {
    if (!this.storage) return [];
    try {
      const content = await this.storage.read('.gitignore');
      return content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith('#'));
    } catch {
      return [];
    }
  }

  private isGitignored(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      let p = pattern;
      let negate = false;
      if (p.startsWith('!')) {
        negate = true;
        p = p.substring(1);
      }
      const regex = new RegExp(
        '^' +
          p
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') +
          '$',
      );
      if (regex.test(filePath)) {
        return !negate;
      }
    }
    return false;
  }

  private onFileTreeDragStart(e: MouseEvent, filePath: string): void {
    e.preventDefault();

    const item = this.sidebar.querySelector(`[data-path="${filePath}"]`) as HTMLElement;
    if (!item) return;

    const ghost = item.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.8';
    ghost.style.zIndex = '10000';
    ghost.style.background = 'var(--emd-bg)';
    ghost.style.border = '1px solid var(--emd-accent)';
    ghost.style.borderRadius = '4px';
    ghost.style.padding = '4px 12px';
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    document.body.appendChild(ghost);

    const onMove = (ev: MouseEvent) => {
      ghost.style.left = `${ev.clientX + 10}px`;
      ghost.style.top = `${ev.clientY + 10}px`;
    };

    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      ghost.remove();
      document.body.style.cursor = '';

      const target = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;
      const targetItem = target?.closest<HTMLElement>('[data-path]');
      if (targetItem) {
        const targetPath = targetItem.getAttribute('data-path');
        if (targetPath && targetPath !== filePath && this.storage) {
          const dir = targetPath.includes('/') ? targetPath.substring(0, targetPath.lastIndexOf('/')) : '.';
          const fileName = filePath.split('/').pop()!;
          const newPath = dir === '.' ? fileName : `${dir}/${fileName}`;
          if (newPath !== filePath) {
            await this.storage.rename(filePath, newPath);
            await this.refreshFileExplorer();
          }
        }
      }
    };

    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  async createNewFile(): Promise<void> {
    if (!this.storage) return;
    const name = prompt('File name (e.g. notes.emd):');
    if (name) {
      await this.storage.write(name, '## [summary] New File\n\nStart writing...\n');
      await this.openFile(name);
      if (this.sidebarVisible) {
        await this.refreshFileExplorer();
      }
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.metaKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        this.cycleTab(-1);
      }
      if (e.metaKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        this.cycleTab(1);
      }
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        this.jumpToTab(parseInt(e.key) - 1);
      }
      if (e.metaKey && e.key === '\\') {
        e.preventDefault();
        this.toggleSplitView();
      }
      if (e.metaKey && e.key === 'w') {
        e.preventDefault();
        if (this.activeEditorPath) this.closeFile(this.activeEditorPath);
      }
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        this.showSettings();
      }
      if (e.metaKey && e.key === 'n') {
        e.preventDefault();
        this.createNewFile();
      }
    });
  }

  private addTab(filePath: string, sectionType?: string): void {
    const tab = document.createElement('div');
    tab.className = 'emd-workspace-tab emd-workspace-tab-enter';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-file-path', filePath);

    const fileName = this.fileNameFromPath(filePath);

    if (sectionType && SECTION_TAB_COLORS[sectionType]) {
      const dot = document.createElement('span');
      dot.className = 'emd-workspace-tab-dot';
      dot.style.backgroundColor = SECTION_TAB_COLORS[sectionType]!;
      tab.appendChild(dot);
    }

    const label = document.createElement('span');
    label.className = 'emd-workspace-tab-label';
    label.textContent = fileName;
    tab.appendChild(label);

    const dirtyDot = document.createElement('span');
    dirtyDot.className = 'emd-workspace-tab-dirty';
    dirtyDot.textContent = '●';
    dirtyDot.style.display = 'none';
    tab.appendChild(dirtyDot);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'emd-workspace-tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeFile(filePath);
    });
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => this.setActiveFile(filePath));
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showTabContextMenu(e.clientX, e.clientY, filePath);
    });

    tab.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.closeFile(filePath);
      }
    });

    this.tabBar.appendChild(tab);

    requestAnimationFrame(() => {
      tab.classList.remove('emd-workspace-tab-enter');
    });
  }

  private removeTab(filePath: string): void {
    const tab = this.tabBar.querySelector(`[data-file-path="${filePath}"]`);
    if (tab) {
      tab.classList.add('emd-workspace-tab-leave');
      tab.addEventListener('transitionend', () => tab.remove(), { once: true });
      setTimeout(() => tab.remove(), 150);
    }
  }

  private updateActiveTab(filePath: string): void {
    for (const tab of this.tabBar.children) {
      tab.classList.toggle(
        'emd-workspace-tab-active',
        tab.getAttribute('data-file-path') === filePath,
      );
    }
  }

  private updateTabDirty(filePath: string, dirty: boolean): void {
    const tab = this.tabBar.querySelector(`[data-file-path="${filePath}"]`);
    if (tab) {
      const dirtyEl = tab.querySelector('.emd-workspace-tab-dirty') as HTMLElement | null;
      if (dirtyEl) dirtyEl.style.display = dirty ? '' : 'none';
    }
  }

  private updateBreadcrumb(): void {
    if (!this.activeEditorPath) {
      this.breadcrumbBar.innerHTML = '';
      return;
    }

    const parts = this.activeEditorPath.split('/');
    this.breadcrumbBar.innerHTML = '';

    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        const chevron = document.createElement('span');
        chevron.className = 'emd-breadcrumb-chevron';
        chevron.textContent = '›';
        this.breadcrumbBar.appendChild(chevron);
      }

      accumulated += (i > 0 ? '/' : '') + parts[i];

      const segment = document.createElement('span');
      segment.className = 'emd-breadcrumb-segment';
      segment.textContent = parts[i]!;
      segment.title = this.activeEditorPath;

      if (i < parts.length - 1) {
        segment.style.cursor = 'pointer';
        segment.addEventListener('click', () => {
          if (this.storage) this.openFile(accumulated);
        });
      }

      segment.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(this.activeEditorPath!).catch(() => {});
      });

      this.breadcrumbBar.appendChild(segment);
    }
  }

  private showTabContextMenu(x: number, y: number, filePath: string): void {
    this.dismissContextMenu();

    const menu = document.createElement('div');
    menu.className = 'emd-tab-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [
      { label: 'Close', action: () => this.closeFile(filePath) },
      { label: 'Close Others', action: () => this.closeOtherTabs(filePath) },
      { label: 'Close to Right', action: () => this.closeTabsToRight(filePath) },
      { label: 'Close All', action: () => this.closeAllTabs() },
      { label: 'Copy Path', action: () => navigator.clipboard.writeText(filePath) },
    ];

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'emd-tab-context-menu-item';
      el.textContent = item.label;
      el.addEventListener('click', () => {
        item.action();
        this.dismissContextMenu();
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);
    this.tabContextMenu = menu;

    const dismiss = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.dismissContextMenu();
        document.removeEventListener('click', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }

  private dismissContextMenu(): void {
    if (this.tabContextMenu) {
      this.tabContextMenu.remove();
      this.tabContextMenu = null;
    }
  }

  private fileNameFromPath(filePath: string): string {
    return filePath.split('/').pop() ?? filePath;
  }

  private onSplitDividerMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeftWidth = this.editorContainer.offsetWidth;
    const totalWidth = this.splitContainer.offsetWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newLeftPercent = ((startLeftWidth + dx) / totalWidth) * 100;

      let clamped = Math.max(20, Math.min(80, newLeftPercent));

      const thresholds = [25, 50, 75];
      for (const t of thresholds) {
        if (Math.abs(clamped - t) < 3) {
          clamped = t;
          break;
        }
      }

      this.editorContainer.style.flex = `1 1 ${clamped}%`;
      this.secondaryEditorContainer.style.flex = `1 1 ${100 - clamped}%`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  private loadBannerConfig(): void {
    try {
      const raw = localStorage.getItem('emd-workspace-banner');
      if (raw) {
        this.bannerConfig = JSON.parse(raw) as BannerConfig;
        this.applyBannerConfig();
      }
    } catch {
      this.bannerConfig = {};
    }
  }

  private saveBannerConfig(): void {
    localStorage.setItem('emd-workspace-banner', JSON.stringify(this.bannerConfig));
    this.applyBannerConfig();
  }

  private applyBannerConfig(): void {
    const { image, color, text } = this.bannerConfig;

    this.banner.style.backgroundImage = '';
    this.banner.style.backgroundColor = '';

    if (image) {
      this.banner.style.backgroundImage = `url(${image})`;
      this.banner.style.backgroundSize = 'cover';
      this.banner.style.backgroundPosition = 'center';
      this.banner.style.height = '120px';
    } else if (color) {
      this.banner.style.backgroundColor = color;
      this.banner.style.height = '120px';
    } else {
      this.banner.style.height = '32px';
    }

    if (text) {
      this.banner.textContent = text;
    } else if (!image && !color) {
      this.banner.textContent = 'EMD Interpreter';
    }

    if (image || color) {
      this.banner.style.textShadow = '0 1px 3px rgba(0,0,0,0.5)';
      this.banner.style.color = '#fff';
    } else {
      this.banner.style.textShadow = '';
      this.banner.style.color = '';
    }
  }

  private showBannerContextMenu(x: number, y: number): void {
    this.dismissBannerContextMenu();

    const menu = document.createElement('div');
    menu.className = 'emd-banner-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [
      {
        label: 'Set Image',
        action: () => {
          const url = prompt('Enter image URL:');
          if (url) {
            this.bannerConfig.image = url;
            this.saveBannerConfig();
          }
        },
      },
      {
        label: 'Set Color',
        action: () => {
          const hex = prompt('Enter hex color (e.g. #3b82f6):');
          if (hex) {
            this.bannerConfig.color = hex;
            delete this.bannerConfig.image;
            this.saveBannerConfig();
          }
        },
      },
      {
        label: 'Set Text',
        action: () => {
          const t = prompt('Enter banner text:', this.bannerConfig.text ?? '');
          if (t !== null) {
            this.bannerConfig.text = t || undefined;
            this.saveBannerConfig();
          }
        },
      },
      ...(this.bannerConfig.image || this.bannerConfig.color || this.bannerConfig.text
        ? [
            {
              label: 'Remove Banner',
              action: () => {
                this.bannerConfig = {};
                this.saveBannerConfig();
              },
            },
          ]
        : []),
    ];

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'emd-banner-context-menu-item';
      el.textContent = item.label;
      el.addEventListener('click', () => {
        item.action();
        this.dismissBannerContextMenu();
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);
    this.bannerContextMenu = menu;

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.dismissBannerContextMenu();
        document.removeEventListener('click', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }

  private dismissBannerContextMenu(): void {
    if (this.bannerContextMenu) {
      this.bannerContextMenu.remove();
      this.bannerContextMenu = null;
    }
  }
}

if (!customElements.get(EMD_WORKSPACE_TAG)) {
  customElements.define(EMD_WORKSPACE_TAG, EmdWorkspace);
}

export { EMD_WORKSPACE_TAG };
