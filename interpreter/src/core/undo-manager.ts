import type { BlockChange, BlockId, UndoEntry } from './types';

export class UndoManager {
  private stack: UndoEntry[] = [];
  private index = -1;
  private maxDepth: number;
  private listeners = new Set<() => void>();
  private grouped = false;
  private groupId: string | null = null;

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  push(changes: BlockChange[]): void {
    if (changes.length === 0) {
      return;
    }

    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    const entry: UndoEntry = {
      id: this.groupId ?? generateId(),
      timestamp: Date.now(),
      changes: [...changes],
    };

    this.stack.push(entry);

    while (this.stack.length > this.maxDepth) {
      this.stack.shift();
    }

    this.index = this.stack.length - 1;
    this.groupId = this.grouped ? this.groupId : null;
    this.listeners.forEach((fn) => fn());
  }

  undo(): BlockChange[] | null {
    if (!this.canUndo()) {
      return null;
    }

    const entry = this.stack[this.index];
    this.index--;
    this.listeners.forEach((fn) => fn());

    if (!entry) {
      return null;
    }
    return this.invertChanges(entry.changes);
  }

  redo(): BlockChange[] | null {
    if (!this.canRedo()) {
      return null;
    }

    this.index++;
    const entry = this.stack[this.index];
    this.listeners.forEach((fn) => fn());

    if (!entry) {
      return null;
    }
    return entry.changes;
  }

  canUndo(): boolean {
    return this.index >= 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  beginGroup(): void {
    this.grouped = true;
    this.groupId = generateId();
  }

  endGroup(): void {
    this.grouped = false;
    this.groupId = null;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear(): void {
    this.stack = [];
    this.index = -1;
    this.listeners.forEach((fn) => fn());
  }

  getSnapshot(): { stackSize: number; currentIndex: number; canUndo: boolean; canRedo: boolean } {
    return {
      stackSize: this.stack.length,
      currentIndex: this.index,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  private invertChanges(changes: BlockChange[]): BlockChange[] {
    return changes
      .map((change) => {
        switch (change.type) {
          case 'add':
            return {
              ...change,
              type: 'remove' as const,
            };
          case 'remove':
            return {
              ...change,
              type: 'add' as const,
              new_parent: change.previous_parent,
              new_index: change.previous_index,
            };
          case 'move':
            return {
              ...change,
              type: 'move' as const,
              previous_parent: change.new_parent,
              new_parent: change.previous_parent,
              previous_index: change.new_index,
              new_index: change.previous_index,
            };
          case 'update':
            return {
              ...change,
              type: 'update' as const,
              previous_state: change.new_state,
              new_state: change.previous_state,
            };
          case 'reparent':
            return {
              ...change,
              type: 'reparent' as const,
              previous_parent: change.new_parent,
              new_parent: change.previous_parent,
              previous_index: change.new_index,
              new_index: change.previous_index,
            };
          default:
            return change;
        }
      })
      .reverse();
  }
}

function generateId(): string {
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
