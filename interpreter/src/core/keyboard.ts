import type { KeyboardAction } from './types';

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardAction[] = [
  { key: 'ArrowUp', action: 'navigate-up', description: 'Move focus up one block' },
  { key: 'ArrowDown', action: 'navigate-down', description: 'Move focus down one block' },
  { key: 'ArrowLeft', action: 'navigate-out', description: 'Navigate out of nested block' },
  { key: 'ArrowRight', action: 'navigate-in', description: 'Navigate into nested block' },
  { key: 'Enter', action: 'create-below', description: 'Create new block below' },
  {
    key: 'Enter',
    shiftKey: true,
    action: 'create-above',
    description: 'Create new block above',
  },
  { key: 'Escape', action: 'escape', description: 'Exit editing / dismiss menu' },
  { key: 'Tab', action: 'indent', description: 'Indent block' },
  { key: 'Tab', shiftKey: true, action: 'outdent', description: 'Outdent block' },
  { key: 'Backspace', action: 'delete-block', description: 'Delete empty block' },
  { key: 'Delete', action: 'delete-block', description: 'Delete selected block' },
  { key: 'z', metaKey: true, action: 'undo', description: 'Undo' },
  { key: 'z', metaKey: true, shiftKey: true, action: 'redo', description: 'Redo' },
  { key: 'z', ctrlKey: true, action: 'undo', description: 'Undo' },
  { key: 'z', ctrlKey: true, shiftKey: true, action: 'redo', description: 'Redo' },
  { key: '/', metaKey: true, action: 'command-palette', description: 'Command palette' },
  { key: 'k', metaKey: true, action: 'ai-prompt', description: 'Open AI prompt menu' },
  { key: 'b', metaKey: true, action: 'bold', description: 'Bold' },
  { key: 'i', metaKey: true, action: 'italic', description: 'Italic' },
  { key: '\\', metaKey: true, action: 'split-view', description: 'Split view' },
  { key: 'w', metaKey: true, action: 'close-tab', description: 'Close current tab' },
  { key: 't', metaKey: true, action: 'new-tab', description: 'Create new tab' },
  { key: ',', metaKey: true, action: 'settings', description: 'Open settings' },
  { key: 'b', metaKey: true, shiftKey: true, action: 'toggle-sidebar', description: 'Toggle file explorer' },
  { key: 'c', metaKey: true, shiftKey: true, action: 'toggle-chat', description: 'Toggle AI chat' },
];

export class KeyboardManager {
  private bindings: Map<string, KeyboardAction>;
  private handlers = new Map<string, Set<() => void>>();
  private attached = false;

  constructor(bindings: KeyboardAction[] = DEFAULT_KEYBOARD_BINDINGS) {
    this.bindings = new Map();
    for (const binding of bindings) {
      this.bindings.set(this.bindingKey(binding), binding);
    }
  }

  registerBinding(binding: KeyboardAction): void {
    this.bindings.set(this.bindingKey(binding), binding);
  }

  unregisterBinding(action: string): void {
    for (const [key, binding] of this.bindings) {
      if (binding.action === action) {
        this.bindings.delete(key);
      }
    }
  }

  onAction(action: string, handler: () => void): () => void {
    const set = this.handlers.get(action) ?? new Set();
    set.add(handler);
    this.handlers.set(action, set);
    return () => set.delete(handler);
  }

  attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    window.addEventListener('keydown', this.handleKeyDown);
  }

  detach(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    this.detach();
    this.bindings.clear();
    this.handlers.clear();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.shouldIgnoreEvent(event)) {
      return;
    }

    const key = this.bindingKeyFromEvent(event);
    const binding = this.bindings.get(key);

    if (binding) {
      event.preventDefault();
      event.stopPropagation();
      this.fire(binding.action);
    }
  };

  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      if (event.key === 'Escape') {
        return false;
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        return false;
      }
      return true;
    }

    if (target.closest('.CodeMirror')) {
      return false;
    }

    return false;
  }

  private fire(action: string): void {
    const handlers = this.handlers.get(action);
    if (handlers) {
      for (const handler of handlers) {
        handler();
      }
    }
  }

  private bindingKey(binding: KeyboardAction): string {
    return [
      binding.ctrlKey ? 'Ctrl' : '',
      binding.metaKey ? 'Meta' : '',
      binding.shiftKey ? 'Shift' : '',
      binding.altKey ? 'Alt' : '',
      binding.key,
    ]
      .filter(Boolean)
      .join('+');
  }

  private bindingKeyFromEvent(event: KeyboardEvent): string {
    return [
      event.ctrlKey ? 'Ctrl' : '',
      event.metaKey ? 'Meta' : '',
      event.shiftKey ? 'Shift' : '',
      event.altKey ? 'Alt' : '',
      event.key,
    ]
      .filter(Boolean)
      .join('+');
  }
}

export function createKeyboardManager(
  customBindings?: KeyboardAction[],
): KeyboardManager {
  return new KeyboardManager(customBindings ?? DEFAULT_KEYBOARD_BINDINGS);
}
