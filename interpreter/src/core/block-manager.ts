import type {
  BlockId,
  Block,
  EmdDocument,
  EmdSection,
  BlockChange,
  BlockChangeEvent,
  SectionType,
  CodeBlockTag,
  StorageProvider,
  EmdEditorConfig,
  BlockPlugin,
} from './types';
import { BlockState } from './types';
import { computeDiff, takeSnapshot, minimalDomDiff, generateBlockId } from './diff';
import { registerBlockPlugin, resolveBlockPlugin, getBlockPlugin } from './plugin-api';
import { UndoManager } from './undo-manager';
import { KeyboardManager, createKeyboardManager } from './keyboard';

type EmdModuleType = {
  parse(source: string): Promise<import('./types').EmdDocument>;
  initSync(module: unknown): void;
};

let emdModule: EmdModuleType | null = null;

async function loadEmdWasm(): Promise<EmdModuleType> {
  if (emdModule) {
    return emdModule;
  }
  try {
    const mod = await import('@everthink/emd');
    emdModule = mod as unknown as EmdModuleType;
    return emdModule!;
  } catch {
    throw new Error(
      'Failed to load @everthink/emd WASM module. Install with: npm install @everthink/emd',
    );
  }
}

export class BlockManager {
  readonly blocks = new Map<BlockId, Block>();
  readonly rootBlockIds: BlockId[] = [];
  readonly undo = new UndoManager();
  readonly keyboard: KeyboardManager;
  readonly config: Required<EmdEditorConfig>;

  private focusedBlockId: BlockId | null = null;
  private selectedBlockIds = new Set<BlockId>();
  private listeners = new Set<(event: BlockChangeEvent) => void>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private mountRoot: HTMLElement | null = null;
  private storage: StorageProvider;

  constructor(config: EmdEditorConfig) {
    this.config = {
      plugins: config.plugins ?? [],
      undoDepth: config.undoDepth ?? 100,
      debounceMs: config.debounceMs ?? 50,
      theme: config.theme ?? 'light',
      storage: config.storage,
    };
    this.storage = config.storage;
    this.keyboard = createKeyboardManager();
    this.undo = new UndoManager(config.undoDepth ?? 100);
    this.setupPlugins();
    this.setupKeyboard();
  }

  async mount(root: HTMLElement): Promise<void> {
    this.mountRoot = root;
    this.mountRoot.innerHTML = '';
    this.mountRoot.setAttribute('data-emd-editor', '');
    this.mountRoot.classList.add(`emd-theme-${this.config.theme}`);
    this.keyboard.attach();

    await this.loadInitialState();
    this.emit({ type: 'selection-changed', blocks: [] });
  }

  unmount(): void {
    this.keyboard.detach();
    for (const block of this.blocks.values()) {
      this.destroyBlock(block);
    }
    this.blocks.clear();
    this.rootBlockIds.length = 0;
    this.mountRoot = null;
  }

  async loadFile(filePath: string): Promise<void> {
    const content = await this.storage.read(filePath);
    await this.parseAndDiff(content);
  }

  async parseAndDiff(source: string): Promise<BlockChange[]> {
    const emd = await loadEmdWasm();
    const document: EmdDocument = await emd.parse(source);

    const changes = computeDiff(
      this.blocks,
      document.sections,
      (section) => section.section_type,
      (tag) => tag ?? 'markdown',
    );

    if (changes.length > 0) {
      this.undo.push(changes);
      await this.applyChanges(changes);
    }

    return changes;
  }

  async onContentChange(source: string): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        await this.parseAndDiff(source);
      } catch (err) {
        console.error('EMD parse error:', err);
      }
    }, this.config.debounceMs);
  }

  addBlock(
    section: EmdSection,
    parentId: BlockId | null,
    index?: number,
  ): BlockId {
    const pluginId = resolveBlockPlugin(section.section_type);
    const blockId = generateBlockId(
      section.section_type,
      index ?? this.blocks.size,
      parentId,
    );

    const block: Block = {
      id: blockId,
      parent_id: parentId,
      child_ids: [],
      section,
      plugin_id: pluginId,
      state: BlockState.Unmounted,
      element: null,
      depth: parentId ? (this.blocks.get(parentId)?.depth ?? 0) + 1 : 0,
      order: index ?? (parentId ? this.getChildCount(parentId) : this.rootBlockIds.length),
      collapsed: false,
    };

    this.blocks.set(blockId, block);

    if (parentId) {
      const parent = this.blocks.get(parentId);
      if (parent) {
        parent.child_ids.push(blockId);
      }
    } else {
      if (index !== undefined && index < this.rootBlockIds.length) {
        this.rootBlockIds.splice(index, 0, blockId);
      } else {
        this.rootBlockIds.push(blockId);
      }
    }

    this.mountBlock(block);

    const change: BlockChange = {
      type: 'add',
      block_id: blockId,
      new_parent: parentId,
      new_index: index,
    };
    this.undo.push([change]);
    this.emit({ type: 'block-added', block_id: blockId, parent_id: parentId, index });

    return blockId;
  }

  removeBlock(blockId: BlockId): void {
    const block = this.blocks.get(blockId);
    if (!block) {
      return;
    }

    const parentId = block.parent_id;

    for (const childId of block.child_ids) {
      this.removeBlock(childId);
    }

    this.destroyBlock(block);

    if (parentId) {
      const parent = this.blocks.get(parentId);
      if (parent) {
        parent.child_ids = parent.child_ids.filter((id) => id !== blockId);
      }
    } else {
      const idx = this.rootBlockIds.indexOf(blockId);
      if (idx !== -1) {
        this.rootBlockIds.splice(idx, 1);
      }
    }

    this.blocks.delete(blockId);
    this.selectedBlockIds.delete(blockId);

    if (this.focusedBlockId === blockId) {
      this.focusedBlockId = null;
    }

    const change: BlockChange = {
      type: 'remove',
      block_id: blockId,
      previous_parent: parentId,
    };
    this.undo.push([change]);
    this.emit({ type: 'block-removed', block_id: blockId });
  }

  moveBlock(blockId: BlockId, newParentId: BlockId | null, index: number): void {
    const block = this.blocks.get(blockId);
    if (!block) {
      return;
    }

    const oldParentId = block.parent_id;

    if (oldParentId) {
      const oldParent = this.blocks.get(oldParentId);
      if (oldParent) {
        oldParent.child_ids = oldParent.child_ids.filter((id) => id !== blockId);
      }
    } else {
      const idx = this.rootBlockIds.indexOf(blockId);
      if (idx !== -1) {
        this.rootBlockIds.splice(idx, 1);
      }
    }

    block.parent_id = newParentId;
    block.order = index;
    block.depth = newParentId ? (this.blocks.get(newParentId)?.depth ?? 0) + 1 : 0;

    if (newParentId) {
      const newParent = this.blocks.get(newParentId);
      if (newParent) {
        newParent.child_ids.splice(index, 0, blockId);
      }
    } else {
      this.rootBlockIds.splice(index, 0, blockId);
    }

    if (block.element && block.element.parentElement) {
      this.reinsertDomElement(blockId, newParentId, index);
    }

    const change: BlockChange = {
      type: 'move',
      block_id: blockId,
      previous_parent: oldParentId,
      new_parent: newParentId,
      previous_index: block.order,
      new_index: index,
    };
    this.undo.push([change]);
    this.emit({ type: 'block-moved', block_id: blockId, parent_id: newParentId, index });
  }

  nestBlock(blockId: BlockId): void {
    const block = this.blocks.get(blockId);
    if (!block || block.depth >= 6) {
      return;
    }

    const parentId = block.parent_id;
    const siblingIds = parentId
      ? this.blocks.get(parentId)?.child_ids ?? []
      : this.rootBlockIds;

    const currentIndex = siblingIds.indexOf(blockId);
    if (currentIndex <= 0) {
      return;
    }

    const newParentId = siblingIds[currentIndex - 1]!;
    const newParent = this.blocks.get(newParentId);
    if (!newParent) {
      return;
    }

    this.moveBlock(blockId, newParentId, newParent.child_ids.length);
  }

  unnestBlock(blockId: BlockId): void {
    const block = this.blocks.get(blockId);
    if (!block || !block.parent_id || block.depth <= 0) {
      return;
    }

    const grandparentId = this.blocks.get(block.parent_id)?.parent_id ?? null;
    const gp = grandparentId ? this.blocks.get(grandparentId) : null;
    const siblingIds = gp ? gp.child_ids : this.rootBlockIds;

    const parentIndex = siblingIds.indexOf(block.parent_id);
    const newIndex = parentIndex >= 0 ? parentIndex + 1 : siblingIds.length;

    this.moveBlock(blockId, grandparentId, newIndex);
  }

  reorderBlock(blockId: BlockId, newIndex: number): void {
    const block = this.blocks.get(blockId);
    if (!block) {
      return;
    }

    const parentId = block.parent_id;
    const siblingIds = parentId
      ? this.blocks.get(parentId)?.child_ids ?? []
      : this.rootBlockIds;

    const oldIndex = siblingIds.indexOf(blockId);
    if (oldIndex === -1) {
      return;
    }

    siblingIds.splice(oldIndex, 1);
    siblingIds.splice(newIndex, 0, blockId);

    block.order = newIndex;

    if (block.element && block.element.parentElement) {
      const container = parentId
        ? this.blocks.get(parentId)?.element?.querySelector('.emd-block-children')
        : this.mountRoot;
      if (container) {
        const refNode = container.children[newIndex] ?? null;
        container.insertBefore(block.element, refNode);
      }
    }

    this.emit({ type: 'block-moved', block_id: blockId, parent_id: parentId, index: newIndex });
  }

  setFocusedBlock(blockId: BlockId | null): void {
    const previousId = this.focusedBlockId;
    this.focusedBlockId = blockId;

    if (previousId && previousId !== blockId) {
      const prevBlock = this.blocks.get(previousId);
      if (prevBlock) {
        prevBlock.element?.classList.remove('emd-focused');
      }
    }

    if (blockId) {
      const block = this.blocks.get(blockId);
      if (block) {
        block.element?.classList.add('emd-focused');
        block.element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  getFocusedBlockId(): BlockId | null {
    return this.focusedBlockId;
  }

  toggleSelection(blockId: BlockId): void {
    if (this.selectedBlockIds.has(blockId)) {
      this.selectedBlockIds.delete(blockId);
      const block = this.blocks.get(blockId);
      if (block) {
        block.element?.classList.remove('emd-selected');
      }
    } else {
      this.selectedBlockIds.add(blockId);
      const block = this.blocks.get(blockId);
      if (block) {
        block.element?.classList.add('emd-selected');
      }
    }
    this.emit({ type: 'selection-changed', blocks: Array.from(this.selectedBlockIds) });
  }

  getSelectedBlockIds(): BlockId[] {
    return Array.from(this.selectedBlockIds);
  }

  getBlock(blockId: BlockId): Block | undefined {
    return this.blocks.get(blockId);
  }

  getBlockTree(): { block: Block; children: unknown[] }[] {
    const manager = this;
    function buildTree(ids: BlockId[]): { block: Block; children: unknown[] }[] {
      const result: { block: Block; children: unknown[] }[] = [];
      for (const id of ids) {
        const block = manager.blocks.get(id);
        if (block && !block.parent_id) {
          result.push({
            block,
            children: buildTree(block.child_ids) as unknown[],
          });
        }
      }
      return result;
    }
    return buildTree(manager.rootBlockIds);
  }

  getChildCount(blockId: BlockId): number {
    const block = this.blocks.get(blockId);
    return block ? block.child_ids.length : 0;
  }

  getDepth(blockId: BlockId): number {
    const block = this.blocks.get(blockId);
    return block?.depth ?? 0;
  }

  onChange(handler: (event: BlockChangeEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private async loadInitialState(): Promise<void> {
    if (!this.mountRoot) {
      return;
    }

    const emptyBlockId = generateBlockId('markdown', 0, null);
    const emptyBlock: Block = {
      id: emptyBlockId,
      parent_id: null,
      child_ids: [],
      section: {
        level: 2,
        section_type: 'summary' as SectionType,
        title: 'Welcome to EMD',
        content: [
          { Text: 'Start typing here...' },
        ],
        subsections: [],
        source_span: { start_line: 0, start_col: 0, end_line: 0, end_col: 0 },
        diagnostics: [],
        metadata: { depends_on: [] },
      },
      plugin_id: 'markdown-block',
      state: BlockState.Unmounted,
      element: null,
      depth: 0,
      order: 0,
      collapsed: false,
    };

    this.blocks.set(emptyBlockId, emptyBlock);
    this.rootBlockIds.push(emptyBlockId);
    this.mountBlock(emptyBlock);
  }

  private setupPlugins(): void {
    for (const plugin of this.config.plugins) {
      registerBlockPlugin(plugin);
    }
  }

  private setupKeyboard(): void {
    this.keyboard.onAction('undo', () => {
      const changes = this.undo.undo();
      if (changes) {
        this.applyReverseChanges(changes);
      }
    });

    this.keyboard.onAction('redo', () => {
      const changes = this.undo.redo();
      if (changes) {
        this.applyChanges(changes);
      }
    });

    this.keyboard.onAction('indent', () => {
      if (this.focusedBlockId) {
        this.nestBlock(this.focusedBlockId);
      }
    });

    this.keyboard.onAction('outdent', () => {
      if (this.focusedBlockId) {
        this.unnestBlock(this.focusedBlockId);
      }
    });

    this.keyboard.onAction('navigate-up', () => {
      this.moveFocus(-1);
    });

    this.keyboard.onAction('navigate-down', () => {
      this.moveFocus(1);
    });

    this.keyboard.onAction('escape', () => {
      this.selectedBlockIds.clear();
      this.emit({ type: 'selection-changed', blocks: [] });
    });

    this.keyboard.onAction('delete-block', () => {
      for (const id of this.selectedBlockIds) {
        this.removeBlock(id);
      }
      if (this.focusedBlockId) {
        this.removeBlock(this.focusedBlockId);
      }
    });
  }

  private moveFocus(delta: number): void {
    const allIds = this.getFlattenedBlockIds();
    if (allIds.length === 0) {
      return;
    }

    let index = this.focusedBlockId ? allIds.indexOf(this.focusedBlockId) : -1;
    if (index === -1) {
      index = delta > 0 ? -1 : allIds.length;
    }

    const newIndex = Math.max(0, Math.min(allIds.length - 1, index + delta));
    this.setFocusedBlock(allIds[newIndex]!);
  }

  private getFlattenedBlockIds(): BlockId[] {
    const result: BlockId[] = [];

    function walk(ids: BlockId[], blocks: Map<BlockId, Block>, out: BlockId[]): void {
      for (const id of ids) {
        out.push(id);
        const block = blocks.get(id);
        if (block) {
          walk(block.child_ids, blocks, out);
        }
      }
    }

    walk(this.rootBlockIds, this.blocks, result);
    return result;
  }

  private async applyChanges(changes: BlockChange[]): Promise<void> {
    for (const change of changes) {
      switch (change.type) {
        case 'add': {
          const existingBlock = this.blocks.get(change.block_id);
          if (!existingBlock) {
            const block: Block = {
              id: change.block_id,
              parent_id: change.new_parent ?? null,
              child_ids: [],
              plugin_id: 'fallback-block',
              state: BlockState.Unmounted,
              element: null,
              depth: 0,
              order: change.new_index ?? 0,
              collapsed: false,
            };
            this.blocks.set(change.block_id, block);
            if (change.new_parent) {
              const parent = this.blocks.get(change.new_parent);
              if (parent) {
                parent.child_ids.push(change.block_id);
              }
            } else {
              this.rootBlockIds.push(change.block_id);
            }
            this.mountBlock(block);
          }
          break;
        }
        case 'remove': {
          const block = this.blocks.get(change.block_id);
          if (block) {
            this.blocks.delete(change.block_id);
            if (block.parent_id) {
              const parent = this.blocks.get(block.parent_id);
              if (parent) {
                parent.child_ids = parent.child_ids.filter((id) => id !== change.block_id);
              }
            } else {
              const idx = this.rootBlockIds.indexOf(change.block_id);
              if (idx !== -1) {
                this.rootBlockIds.splice(idx, 1);
              }
            }
            this.destroyBlock(block);
          }
          break;
        }
        case 'move':
        case 'reparent': {
          const block = this.blocks.get(change.block_id);
          if (block) {
            if (block.parent_id) {
              const oldParent = this.blocks.get(block.parent_id);
              if (oldParent) {
                oldParent.child_ids = oldParent.child_ids.filter((id) => id !== change.block_id);
              }
            } else {
              const idx = this.rootBlockIds.indexOf(change.block_id);
              if (idx !== -1) {
                this.rootBlockIds.splice(idx, 1);
              }
            }

            block.parent_id = change.new_parent ?? null;
            block.order = change.new_index ?? 0;

            if (change.new_parent) {
              const newParent = this.blocks.get(change.new_parent);
              if (newParent) {
                newParent.child_ids.splice(change.new_index ?? newParent.child_ids.length, 0, change.block_id);
                block.depth = newParent.depth + 1;
              }
            } else {
              this.rootBlockIds.splice(change.new_index ?? this.rootBlockIds.length, 0, change.block_id);
              block.depth = 0;
            }
          }
          break;
        }
        case 'update': {
          const block = this.blocks.get(change.block_id);
          if (block) {
            block.state = BlockState.Updating;
            const plugin = getBlockPlugin(block.plugin_id);
            if (plugin?.onUpdate && block.element) {
              plugin.onUpdate(block, block.element);
            }
            block.state = BlockState.Mounted;
          }
          break;
        }
      }
    }
  }

  private applyReverseChanges(changes: BlockChange[]): void {
    this.applyChanges(changes);
  }

  private mountBlock(block: Block): void {
    block.state = BlockState.Mounting;

    const plugin = getBlockPlugin(block.plugin_id);
    let element: HTMLElement;

    if (plugin) {
      element = new plugin.component();
      plugin.onMount?.(block, element);
    } else {
      element = document.createElement('div');
      element.className = 'emd-block emd-block-fallback';
      element.textContent = block.section?.title ?? 'Unknown block';
    }

    element.setAttribute('data-block-id', block.id);
    element.setAttribute('data-plugin-id', block.plugin_id);
    element.classList.add('emd-block');
    element.style.paddingLeft = `${block.depth * 24}px`;

    element.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey) {
        this.toggleSelection(block.id);
      } else {
        this.setFocusedBlock(block.id);
      }
    });

    block.element = element;
    block.state = BlockState.Mounted;

    if (block.parent_id) {
      const parent = this.blocks.get(block.parent_id);
      if (parent?.element) {
        const childrenContainer = parent.element.querySelector('.emd-block-children') ??
          this.createChildrenContainer(parent);
        childrenContainer.appendChild(element);
      } else if (this.mountRoot) {
        this.mountRoot.appendChild(element);
      }
    } else {
      this.mountRoot?.appendChild(element);
    }
  }

  private destroyBlock(block: Block): void {
    block.state = BlockState.Destroying;

    const plugin = getBlockPlugin(block.plugin_id);
    if (plugin?.onDestroy && block.element) {
      plugin.onDestroy(block, block.element);
    }

    block.element?.remove();
    block.element = null;
    block.state = BlockState.Unmounted;
  }

  private reinsertDomElement(
    blockId: BlockId,
    newParentId: BlockId | null,
    index: number,
  ): void {
    const block = this.blocks.get(blockId);
    if (!block?.element) {
      return;
    }

    let container: Element | null = null;

    if (newParentId) {
      const parent = this.blocks.get(newParentId);
      if (parent?.element) {
        container = parent.element.querySelector('.emd-block-children') ??
          this.createChildrenContainer(parent);
      }
    } else {
      container = this.mountRoot;
    }

    if (container) {
      const refNode = container.children[index] ?? null;
      container.insertBefore(block.element, refNode);
    }
  }

  private createChildrenContainer(parent: Block): HTMLElement {
    const container = document.createElement('div');
    container.className = 'emd-block-children';
    parent.element?.appendChild(container);
    return container;
  }

  private emit(event: BlockChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
