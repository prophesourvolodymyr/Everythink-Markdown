import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BlockManager } from '@core/block-manager';
import { computeDiff, generateBlockId, minimalDomDiff, takeSnapshot } from '@core/diff';
import { UndoManager } from '@core/undo-manager';
import { MemoryStorage } from '@storage/browser-storage';
import { registerBlockPlugin, unregisterBlockPlugin, pluginRegistry } from '@core/plugin-api';
import { BlockState, SectionType, CodeBlockTag } from '@core/types';
import type { Block, EmdSection, BlockPlugin, BlockChange } from '@core/types';
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

describe('Keyboard Navigation Integration', () => {
  let storage: MemoryStorage;
  let blockManager: BlockManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    document.body.innerHTML = '<div id="root"></div>';
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
    blockManager = new BlockManager({ storage });
  });

  afterEach(() => {
    blockManager.unmount();
  });

  it('moves focus via internal moveFocus', async () => {
    const root = document.getElementById('root')!;
    await blockManager.mount(root);

    const block1 = blockManager.addBlock(createMockSection({ title: 'Block 1' }), null);
    const block2 = blockManager.addBlock(createMockSection({ title: 'Block 2' }), null);
    const block3 = blockManager.addBlock(createMockSection({ title: 'Block 3' }), null);

    blockManager.setFocusedBlock(block1);
    expect(blockManager.getFocusedBlockId()).toBe(block1);

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    document.body.dispatchEvent(event);
    expect(blockManager.getFocusedBlockId()).toBe(block2);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(blockManager.getFocusedBlockId()).toBe(block3);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(blockManager.getFocusedBlockId()).toBe(block2);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(blockManager.getFocusedBlockId()).toBe(block1);
  });

  it('ArrowDown from nothing selects first block', async () => {
    const root = document.getElementById('root')!;
    await blockManager.mount(root);

    const blockId = blockManager.addBlock(createMockSection({ title: 'First' }), null);

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    document.body.dispatchEvent(event);

    const focused = blockManager.getFocusedBlockId();
    expect(focused).toBeDefined();
  });
});

describe('Undo/Redo Integration', () => {
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

  it('undoes and redoes block addition through keyboard', async () => {
    const root = document.getElementById('root')!;
    await blockManager.mount(root);

    const initialCount = blockManager.blocks.size;
    const blockId = blockManager.addBlock(createMockSection({ title: 'To Undo' }), null);
    expect(blockManager.blocks.has(blockId)).toBe(true);
    expect(blockManager.blocks.size).toBe(initialCount + 1);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }),
    );

    expect(blockManager.blocks.has(blockId)).toBe(false);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }),
    );

    expect(blockManager.blocks.size).toBe(initialCount + 1);
  });

  it('undoes then redoes block move through keyboard', async () => {
    const root = document.getElementById('root')!;
    await blockManager.mount(root);

    const parentId = blockManager.addBlock(createMockSection({ title: 'Parent' }), null);
    const childId = blockManager.addBlock(createMockSection({ title: 'Child' }), null);

    blockManager.moveBlock(childId, parentId, 0);
    expect(blockManager.blocks.get(childId)?.parent_id).toBe(parentId);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }),
    );

    expect(blockManager.blocks.get(childId)?.parent_id).toBeNull();

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }),
    );

    expect(blockManager.blocks.get(childId)?.parent_id).toBe(parentId);
  });
});

describe('Diff + Apply Cycle', () => {
  it('computes diff for new sections and applies changes', () => {
    const blocks = new Map<string, Block>();

    const section1 = createMockSection({ title: 'Section 1', section_type: SectionType.Task });
    const section2 = createMockSection({ title: 'Section 2', section_type: SectionType.Detail });
    const newSections = [section1, section2];

    const changes = computeDiff(
      blocks,
      newSections,
      (s) => s.section_type,
      () => 'markdown',
    );

    const addChanges = changes.filter((c) => c.type === 'add');
    expect(addChanges.length).toBe(2);
    expect(addChanges[0]!.block_id).toContain('task');
    expect(addChanges[1]!.block_id).toContain('detail');

    for (const change of addChanges) {
      const block: Block = {
        id: change.block_id,
        parent_id: change.new_parent ?? null,
        child_ids: [],
        plugin_id: 'fallback-block',
        state: BlockState.Mounted,
        element: null,
        depth: 0,
        order: change.new_index ?? 0,
        collapsed: false,
      };
      blocks.set(change.block_id, block);
    }

    expect(blocks.size).toBe(2);
    const blockIds = Array.from(blocks.keys());
    expect(blockIds).toContain(addChanges[0]!.block_id);
    expect(blockIds).toContain(addChanges[1]!.block_id);
  });

  it('detects removed sections when block tree has extra entries', () => {
    const blocks = new Map<string, Block>();

    const existingBlock: Block = {
      id: 'detail:1:Old Section',
      parent_id: null,
      child_ids: [],
      plugin_id: 'fallback-block',
      state: BlockState.Mounted,
      element: null,
      depth: 0,
      order: 0,
      collapsed: false,
      section: createMockSection({
        title: 'Old Section',
        section_type: SectionType.Detail,
        source_span: { start_line: 1, start_col: 0, end_line: 1, end_col: 0 },
      }),
    };
    blocks.set(existingBlock.id, existingBlock);

    const newSections: EmdSection[] = [];

    const changes = computeDiff(
      blocks,
      newSections,
      (s) => s.section_type,
      () => 'markdown',
    );

    const removeChanges = changes.filter((c) => c.type === 'remove');
    expect(removeChanges.length).toBe(1);
    expect(removeChanges[0]!.block_id).toBe(existingBlock.id);
  });

  it('matches block tree after applying add+remove cycle', () => {
    const blocks = new Map<string, Block>();

    const keepBlock: Block = {
      id: 'task:2:Keep',
      parent_id: null,
      child_ids: [],
      plugin_id: 'fallback-block',
      state: BlockState.Mounted,
      element: null,
      depth: 0,
      order: 0,
      collapsed: false,
    };
    blocks.set(keepBlock.id, keepBlock);

    const removeBlock: Block = {
      id: 'detail:1:Remove Me',
      parent_id: null,
      child_ids: [],
      plugin_id: 'fallback-block',
      state: BlockState.Mounted,
      element: null,
      depth: 0,
      order: 1,
      collapsed: false,
    };
    blocks.set(removeBlock.id, removeBlock);

    const keepSection = createMockSection({
      title: 'Keep',
      section_type: SectionType.Task,
      source_span: { start_line: 2, start_col: 0, end_line: 2, end_col: 0 },
    });
    const addSection = createMockSection({
      title: 'New Entry',
      section_type: SectionType.Idea,
      source_span: { start_line: 3, start_col: 0, end_line: 3, end_col: 0 },
    });
    const newSections = [keepSection, addSection];

    const changes = computeDiff(
      blocks,
      newSections,
      (s) => s.section_type,
      () => 'markdown',
    );

    const removeChanges = changes.filter((c) => c.type === 'remove');
    const addChanges = changes.filter((c) => c.type === 'add');

    expect(removeChanges.length).toBe(1);
    expect(removeChanges[0]!.block_id).toBe(removeBlock.id);
    expect(addChanges.length).toBe(1);
    expect(addChanges[0]!.block_id).toContain('idea');

    for (const change of removeChanges) {
      blocks.delete(change.block_id);
    }
    for (const change of addChanges) {
      blocks.set(change.block_id, {
        id: change.block_id,
        parent_id: change.new_parent ?? null,
        child_ids: [],
        plugin_id: 'fallback-block',
        state: BlockState.Mounted,
        element: null,
        depth: 0,
        order: change.new_index ?? 0,
        collapsed: false,
      });
    }

    expect(blocks.has(keepBlock.id)).toBe(true);
    expect(blocks.has(removeBlock.id)).toBe(false);
    expect(blocks.size).toBe(2);
  });
});

interface DrawCommand {
  type: 'freehand' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'eraser';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  radius?: number;
  text?: string;
  strokeColor?: string;
  fillColor?: string;
  lineWidth?: number;
  opacity?: number;
  fontSize?: number;
}

interface CanvasData {
  version: number;
  width: number;
  height: number;
  commands: DrawCommand[];
}

describe('Canvas Block Plugin', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('resolves plugin for CodeBlockTag.Draw', () => {
    const drawPlugin: BlockPlugin = {
      id: 'canvas-block',
      name: 'Canvas Drawing Block',
      version: '0.1.0',
      code_block_tags: [CodeBlockTag.Draw],
      component: class extends HTMLElement {},
    };

    registerBlockPlugin(drawPlugin);
    const pluginId = pluginRegistry.resolvePlugin(undefined, CodeBlockTag.Draw);
    expect(pluginId).toBe('canvas-block');
  });

  it('resolves Draw over section type when both present', () => {
    const drawPlugin: BlockPlugin = {
      id: 'canvas-block',
      name: 'Canvas Drawing Block',
      version: '0.1.0',
      code_block_tags: [CodeBlockTag.Draw],
      component: class extends HTMLElement {},
    };

    registerBlockPlugin(drawPlugin);
    const pluginId = pluginRegistry.resolvePlugin(SectionType.Summary, CodeBlockTag.Draw);
    expect(pluginId).toBe('canvas-block');
  });
});

describe('Canvas Serialization', () => {
  it('serializes and deserializes drawing commands round-trip', () => {
    const commands: DrawCommand[] = [
      { type: 'freehand', points: [{ x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 22 }], strokeColor: '#ff0000', lineWidth: 3 },
      { type: 'rect', x: 50, y: 50, width: 100, height: 80, strokeColor: '#0000ff', fillColor: '#aaaaff', lineWidth: 2, opacity: 0.8 },
      { type: 'circle', x: 200, y: 100, radius: 40, strokeColor: '#00ff00', fillColor: '#aaffaa', lineWidth: 4 },
      { type: 'line', x: 10, y: 10, x2: 200, y2: 150, strokeColor: '#000000', lineWidth: 2 },
      { type: 'arrow', x: 50, y: 200, x2: 250, y2: 100, strokeColor: '#ff00ff', lineWidth: 3 },
      { type: 'text', x: 300, y: 50, text: 'Hello Canvas', strokeColor: '#333333', fontSize: 24 },
    ];

    const data: CanvasData = {
      version: 1,
      width: 800,
      height: 500,
      commands,
    };

    const json = JSON.stringify(data);
    const restored: CanvasData = JSON.parse(json);

    expect(restored.version).toBe(1);
    expect(restored.width).toBe(800);
    expect(restored.height).toBe(500);
    expect(restored.commands).toHaveLength(6);

    expect(restored.commands[0]!.type).toBe('freehand');
    expect(restored.commands[0]!.points).toHaveLength(3);
    expect(restored.commands[0]!.strokeColor).toBe('#ff0000');

    expect(restored.commands[1]!.type).toBe('rect');
    expect(restored.commands[1]!.width).toBe(100);
    expect(restored.commands[1]!.fillColor).toBe('#aaaaff');

    expect(restored.commands[2]!.type).toBe('circle');
    expect(restored.commands[2]!.radius).toBe(40);

    expect(restored.commands[3]!.type).toBe('line');
    expect(restored.commands[3]!.x2).toBe(200);

    expect(restored.commands[4]!.type).toBe('arrow');
    expect(restored.commands[4]!.strokeColor).toBe('#ff00ff');

    expect(restored.commands[5]!.type).toBe('text');
    expect(restored.commands[5]!.text).toBe('Hello Canvas');
  });

  it('handles empty command list', () => {
    const data: CanvasData = { version: 1, width: 800, height: 500, commands: [] };
    const json = JSON.stringify(data);
    const restored: CanvasData = JSON.parse(json);
    expect(restored.commands).toHaveLength(0);
  });
});

describe('Flowchart Block Plugin', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('resolves plugin for SectionType.Graph', () => {
    const flowchartPlugin: BlockPlugin = {
      id: 'flowchart-block',
      name: 'Flowchart Editor Block',
      version: '0.1.0',
      section_types: [SectionType.Graph],
      component: class extends HTMLElement {},
    };

    registerBlockPlugin(flowchartPlugin);
    const pluginId = pluginRegistry.resolvePlugin(SectionType.Graph);
    expect(pluginId).toBe('flowchart-block');
  });

  it('serializes and deserializes flowchart data round-trip', () => {
    interface FlowNode {
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
    }
    interface FlowEdge {
      id: string;
      fromId: string;
      toId: string;
      label: string;
      fromPort: string;
      toPort: string;
    }
    interface FlowchartData {
      version: number;
      width: number;
      height: number;
      nodes: FlowNode[];
      edges: FlowEdge[];
    }

    const nodes: FlowNode[] = [
      { id: 'n1', type: 'terminator', x: 100, y: 50, width: 140, height: 50, label: 'Start' },
      { id: 'n2', type: 'process', x: 100, y: 150, width: 140, height: 60, label: 'Do Work' },
      { id: 'n3', type: 'decision', x: 100, y: 260, width: 120, height: 80, label: 'Done?' },
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', fromId: 'n1', toId: 'n2', label: '', fromPort: 'output', toPort: 'input' },
      { id: 'e2', fromId: 'n2', toId: 'n3', label: 'check', fromPort: 'output', toPort: 'input' },
    ];

    const data: FlowchartData = { version: 1, width: 1200, height: 800, nodes, edges };
    const json = JSON.stringify(data);
    const restored: FlowchartData = JSON.parse(json);

    expect(restored.version).toBe(1);
    expect(restored.width).toBe(1200);
    expect(restored.height).toBe(800);
    expect(restored.nodes).toHaveLength(3);
    expect(restored.nodes[0]!.type).toBe('terminator');
    expect(restored.nodes[0]!.label).toBe('Start');
    expect(restored.nodes[2]!.type).toBe('decision');
    expect(restored.edges).toHaveLength(2);
    expect(restored.edges[0]!.fromId).toBe('n1');
    expect(restored.edges[1]!.label).toBe('check');
  });

  it('handles empty flowchart data', () => {
    interface FlowchartData {
      version: number;
      width: number;
      height: number;
      nodes: unknown[];
      edges: unknown[];
    }
    const data: FlowchartData = { version: 1, width: 1200, height: 800, nodes: [], edges: [] };
    const json = JSON.stringify(data);
    const restored: FlowchartData = JSON.parse(json);
    expect(restored.nodes).toHaveLength(0);
    expect(restored.edges).toHaveLength(0);
  });
});

describe('Kanban Block Plugin', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('resolves plugin for CodeBlockTag.Kanban', () => {
    const kanbanPlugin: BlockPlugin = {
      id: 'kanban-block',
      name: 'Kanban Board Block',
      version: '0.1.0',
      code_block_tags: [CodeBlockTag.Kanban],
      component: class extends HTMLElement {},
    };

    registerBlockPlugin(kanbanPlugin);
    const pluginId = pluginRegistry.resolvePlugin(undefined, CodeBlockTag.Kanban);
    expect(pluginId).toBe('kanban-block');
  });

  it('correctly maps task statuses to kanban columns', () => {
    function statusToColumnKey(status?: string): string {
      if (!status) return 'task';
      const map: Record<string, string> = {
        pending: 'pending',
        'in-progress': 'in-progress',
        done: 'done',
        blocked: 'in-progress',
        archived: 'done',
        cancelled: 'done',
      };
      return map[status] ?? 'task';
    }

    expect(statusToColumnKey(undefined)).toBe('task');
    expect(statusToColumnKey('task')).toBe('task');
    expect(statusToColumnKey('pending')).toBe('pending');
    expect(statusToColumnKey('in-progress')).toBe('in-progress');
    expect(statusToColumnKey('done')).toBe('done');
    expect(statusToColumnKey('blocked')).toBe('in-progress');
    expect(statusToColumnKey('archived')).toBe('done');
    expect(statusToColumnKey('cancelled')).toBe('done');
    expect(statusToColumnKey('unknown')).toBe('task');
  });

  it('serializes and deserializes kanban config round-trip', () => {
    interface KanbanConfig {
      columns: { id: string; title: string; statusKey: string; wipLimit: number }[];
      collapsedView: boolean;
    }

    const config: KanbanConfig = {
      columns: [
        { id: 'backlog', title: 'Backlog', statusKey: 'task', wipLimit: 0 },
        { id: 'todo', title: 'To Do', statusKey: 'pending', wipLimit: 3 },
        { id: 'done', title: 'Done', statusKey: 'done', wipLimit: 0 },
      ],
      collapsedView: true,
    };

    const json = JSON.stringify(config);
    const restored: KanbanConfig = JSON.parse(json);

    expect(restored.columns).toHaveLength(3);
    expect(restored.columns[0]!.id).toBe('backlog');
    expect(restored.columns[1]!.wipLimit).toBe(3);
    expect(restored.collapsedView).toBe(true);
  });

  it('parses task sections into kanban cards', () => {
    interface TaskSection {
      section_type: string;
      title: string;
      status?: string;
      metadata?: { depends_on: string[] };
    }

    function parseTaskSections(subsections: TaskSection[]): { title: string; status: string; dependsOn: string[] }[] {
      return subsections
        .filter((s) => s.section_type === 'task')
        .map((s) => ({
          title: s.title,
          status: s.status === 'done' ? 'done' : s.status === 'in-progress' ? 'in-progress' : 'pending',
          dependsOn: s.metadata?.depends_on ?? [],
        }));
    }

    const sections: TaskSection[] = [
      { section_type: 'task', title: 'A', status: 'pending' },
      { section_type: 'task', title: 'B', status: 'in-progress' },
      { section_type: 'task', title: 'C', status: 'done', metadata: { depends_on: ['A'] } },
      { section_type: 'detail', title: 'Not a task' },
    ];

    const cards = parseTaskSections(sections);
    expect(cards).toHaveLength(3);
    expect(cards[0]!.title).toBe('A');
    expect(cards[0]!.status).toBe('pending');
    expect(cards[1]!.title).toBe('B');
    expect(cards[1]!.status).toBe('in-progress');
    expect(cards[2]!.title).toBe('C');
    expect(cards[2]!.status).toBe('done');
    expect(cards[2]!.dependsOn).toContain('A');
  });
});

describe('Canvas Undo/Redo', () => {
  it('undoes and redoes canvas stroke operations', () => {
    const undoStack: DrawCommand[][] = [];
    const redoStack: DrawCommand[][] = [];
    let commands: DrawCommand[] = [];
    const MAX_UNDO = 100;

    function pushState() {
      undoStack.push([...commands]);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function undo() {
      const snap = undoStack.pop();
      if (snap === undefined) return false;
      redoStack.push([...commands]);
      commands = snap;
      return true;
    }

    function redo() {
      const snap = redoStack.pop();
      if (snap === undefined) return false;
      undoStack.push([...commands]);
      commands = snap;
      return true;
    }

    pushState();
    commands.push({ type: 'rect', x: 10, y: 10, width: 50, height: 50, strokeColor: '#000' });
    expect(commands).toHaveLength(1);

    pushState();
    commands.push({ type: 'circle', x: 100, y: 100, radius: 30, strokeColor: '#f00' });
    expect(commands).toHaveLength(2);

    pushState();
    commands.push({ type: 'line', x: 0, y: 0, x2: 100, y2: 100, strokeColor: '#0f0' });
    expect(commands).toHaveLength(3);

    expect(undoStack.length).toBe(3);

    const result1 = undo();
    expect(result1).toBe(true);
    expect(commands).toHaveLength(2);
    expect(commands[0]!.type).toBe('rect');
    expect(commands[1]!.type).toBe('circle');

    const result2 = undo();
    expect(result2).toBe(true);
    expect(commands).toHaveLength(1);
    expect(commands[0]!.type).toBe('rect');

    const result3 = redo();
    expect(result3).toBe(true);
    expect(commands).toHaveLength(2);
    expect(commands[0]!.type).toBe('rect');
    expect(commands[1]!.type).toBe('circle');

    const result4 = redo();
    expect(result4).toBe(true);
    expect(commands).toHaveLength(3);
    expect(commands[2]!.type).toBe('line');

    expect(redoStack.length).toBe(0);
    expect(undoStack.length).toBe(3);
  });

  it('truncates redo stack on new push after undo', () => {
    const undoStack: DrawCommand[][] = [];
    const redoStack: DrawCommand[][] = [];
    let commands: DrawCommand[] = [];

    function pushState() {
      undoStack.push([...commands]);
      redoStack.length = 0;
    }

    pushState();
    commands.push({ type: 'freehand', points: [{ x: 0, y: 0 }], strokeColor: '#000' });
    pushState();
    commands.push({ type: 'rect', x: 0, y: 0, width: 10, height: 10, strokeColor: '#000' });

    undoStack.pop();
    commands = undoStack.pop()!;
    expect(commands).toHaveLength(0);

    pushState();
    commands.push({ type: 'circle', x: 5, y: 5, radius: 20, strokeColor: '#00f' });
    expect(commands).toHaveLength(1);
    expect(redoStack.length).toBe(0);
  });

  it('caps undo stack at 100 entries', () => {
    const undoStack: DrawCommand[][] = [];
    let commands: DrawCommand[] = [];
    const MAX = 100;

    for (let i = 0; i < 120; i++) {
      undoStack.push([...commands]);
      if (undoStack.length > MAX) undoStack.shift();
      commands.push({ type: 'rect', x: i, y: i, width: 1, height: 1, strokeColor: '#000' });
    }

    expect(undoStack.length).toBeLessThanOrEqual(MAX);
  });
});
