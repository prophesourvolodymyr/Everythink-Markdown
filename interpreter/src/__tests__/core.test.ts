import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BlockManager } from '@core/block-manager';
import { computeDiff, generateBlockId, minimalDomDiff, takeSnapshot } from '@core/diff';
import { UndoManager } from '@core/undo-manager';
import { MemoryStorage } from '@storage/browser-storage';
import { registerBlockPlugin, unregisterBlockPlugin, pluginRegistry } from '@core/plugin-api';
import { BlockState, SectionType } from '@core/types';
import type { Block, EmdSection, BlockPlugin } from '@core/types';
import '../blocks/fallback-block';

function createMockSection(overrides: Partial<EmdSection> = {}): EmdSection {
  return {
    level: 2,
    section_type: SectionType.Summary,
    title: 'Test Section',
    content: [{ Text: 'test content' }],
    subsections: [],
    source_span: { start_line: 1, start_col: 0, end_line: 1, end_col: 0 },
    diagnostics: [],
    metadata: { depends_on: [] },
    ...overrides,
  };
}

describe('BlockManager', () => {
  let storage: MemoryStorage;
  let blockManager: BlockManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    document.body.innerHTML = '<div id="root"></div>';
    blockManager = new BlockManager({ storage });
  });

  afterEach(() => {
    blockManager.unmount();
  });

  it('creates a BlockManager instance', () => {
    expect(blockManager).toBeDefined();
    expect(blockManager.blocks.size).toBe(0);
    expect(blockManager.rootBlockIds).toHaveLength(0);
  });

  it('mounts and adds an initial block', async () => {
    const root = document.getElementById('root')!;
    await blockManager.mount(root);

    expect(blockManager.blocks.size).toBeGreaterThan(0);
    expect(blockManager.rootBlockIds.length).toBeGreaterThan(0);
    expect(root.querySelector('.emd-block')).toBeTruthy();
  });

  it('adds a block manually', () => {
    const section = createMockSection();
    const blockId = blockManager.addBlock(section, null);

    expect(blockManager.blocks.has(blockId)).toBe(true);
    expect(blockManager.rootBlockIds).toContain(blockId);
  });

  it('removes a block', () => {
    const section = createMockSection();
    const blockId = blockManager.addBlock(section, null);

    blockManager.removeBlock(blockId);
    expect(blockManager.blocks.has(blockId)).toBe(false);
    expect(blockManager.rootBlockIds).not.toContain(blockId);
  });

  it('moves a block to a new parent', () => {
    const parent = createMockSection({ title: 'Parent' });
    const child = createMockSection({ title: 'Child' });

    const parentId = blockManager.addBlock(parent, null);
    const childId = blockManager.addBlock(child, null);

    blockManager.moveBlock(childId, parentId, 0);

    const parentBlock = blockManager.blocks.get(parentId);
    expect(parentBlock?.child_ids).toContain(childId);

    const childBlock = blockManager.blocks.get(childId);
    expect(childBlock?.parent_id).toBe(parentId);
  });
});

describe('Diff Engine', () => {
  it('generates unique block IDs', () => {
    const id1 = generateBlockId('task', 0, null);
    const id2 = generateBlockId('task', 1, null);
    expect(id1).not.toBe(id2);
  });

  it('minimalDomDiff detects additions', () => {
    const result = minimalDomDiff(['a', 'b'], ['a', 'b', 'c']);
    expect(result.added).toEqual(['c']);
    expect(result.removed).toHaveLength(0);
  });

  it('minimalDomDiff detects removals', () => {
    const result = minimalDomDiff(['a', 'b', 'c'], ['a', 'c']);
    expect(result.removed).toEqual(['b']);
    expect(result.added).toHaveLength(0);
  });

  it('minimalDomDiff detects moves', () => {
    const result = minimalDomDiff(['a', 'b', 'c'], ['b', 'a', 'c']);
    expect(result.moved).toHaveLength(2);
  });
});

describe('UndoManager', () => {
  let undo: UndoManager;

  beforeEach(() => {
    undo = new UndoManager(100);
  });

  it('starts with nothing to undo', () => {
    expect(undo.canUndo()).toBe(false);
    expect(undo.canRedo()).toBe(false);
  });

  it('stores and reverses changes', () => {
    undo.push([
      {
        type: 'add',
        block_id: 'test:1',
        new_parent: null,
        new_index: 0,
      },
    ]);

    expect(undo.canUndo()).toBe(true);

    const inverted = undo.undo();
    expect(inverted).not.toBeNull();
    expect(inverted![0]!.type).toBe('remove');
  });

  it('supports redo', () => {
    undo.push([{ type: 'add', block_id: 'test:1' }]);
    undo.undo();
    expect(undo.canRedo()).toBe(true);

    const restored = undo.redo();
    expect(restored).not.toBeNull();
    expect(restored![0]!.type).toBe('add');
  });

  it('truncates redo stack on new push', () => {
    undo.push([{ type: 'add', block_id: 'a' }]);
    undo.push([{ type: 'add', block_id: 'b' }]);
    undo.undo();
    undo.push([{ type: 'add', block_id: 'c' }]);

    expect(undo.canRedo()).toBe(false);
  });
});

describe('Plugin API', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('registers and retrieves a plugin', () => {
    const mockPlugin: BlockPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      section_types: [SectionType.Task],
      component: class extends HTMLElement {},
      toolbar: [],
    };

    registerBlockPlugin(mockPlugin);
    const retrieved = pluginRegistry.getPlugin('test-plugin');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-plugin');
  });

  it('resolves correct plugin for section type', () => {
    const mockPlugin: BlockPlugin = {
      id: 'task-plugin',
      name: 'Task Plugin',
      version: '1.0.0',
      section_types: [SectionType.Task],
      component: class extends HTMLElement {},
    };

    registerBlockPlugin(mockPlugin);
    const pluginId = pluginRegistry.resolvePlugin(SectionType.Task);
    expect(pluginId).toBe('task-plugin');
  });

  it('falls back to fallback-block for unknown types', () => {
    const pluginId = pluginRegistry.resolvePlugin(SectionType.Summary);
    expect(pluginId).toBe('fallback-block');
  });
});

describe('MemoryStorage', () => {
  it('writes and reads files', async () => {
    const storage = new MemoryStorage();
    await storage.write('test.emd', 'content');
    const content = await storage.read('test.emd');
    expect(content).toBe('content');
  });

  it('lists files', async () => {
    const storage = new MemoryStorage();
    await storage.write('a.emd', 'a');
    await storage.write('b.emd', 'b');

    const files = await storage.list('.');
    expect(files).toContain('a.emd');
    expect(files).toContain('b.emd');
  });

  it('checks file existence', async () => {
    const storage = new MemoryStorage();
    expect(await storage.exists('nope.emd')).toBe(false);

    await storage.write('yes.emd', '');
    expect(await storage.exists('yes.emd')).toBe(true);
  });

  it('renames files', async () => {
    const storage = new MemoryStorage();
    await storage.write('old.emd', 'data');
    await storage.rename('old.emd', 'new.emd');

    expect(await storage.exists('old.emd')).toBe(false);
    expect(await storage.read('new.emd')).toBe('data');
  });
});
