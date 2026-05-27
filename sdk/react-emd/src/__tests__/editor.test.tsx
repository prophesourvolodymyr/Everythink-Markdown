import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React, { createRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EmdEditor } from '../editor';
import type { EmdEditorRef } from '../editor';

function getView(container: HTMLElement): EditorView | null {
  const cmEl = container.querySelector('.cm-editor') as HTMLElement | null;
  if (!cmEl) return null;
  return EditorView.findFromDOM(cmEl);
}

describe('EmdEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', () => {
    const { container } = render(React.createElement(EmdEditor));
    const editorDiv = container.querySelector('.emd-editor');
    expect(editorDiv).toBeTruthy();
    const cmEl = container.querySelector('.cm-editor');
    expect(cmEl).toBeTruthy();
  });

  it('displays initial content via value prop', () => {
    const { container } = render(
      React.createElement(EmdEditor, { value: '## Hello' })
    );
    const view = getView(container);
    expect(view).toBeTruthy();
    expect(view!.state.doc.toString()).toBe('## Hello');
  });

  it('calls onChange when editor content changes', () => {
    const onChange = vi.fn();
    const { container } = render(
      React.createElement(EmdEditor, { onChange })
    );
    const view = getView(container);
    expect(view).toBeTruthy();
    view!.dispatch({
      changes: { from: 0, to: 0, insert: 'Hello' },
    });
    expect(onChange).toHaveBeenCalledWith('Hello');
  });

  it('calls onSave on Mod-s keyboard shortcut', () => {
    const onSave = vi.fn();

    // Hook into contentDOM.addEventListener so we can capture the CM6
    // keydown handler and invoke it with a mock event (jsdom cannot
    // reliably simulate CodeMirror keyboard shortcut resolution).
    const origAddEventListener = HTMLElement.prototype.addEventListener;
    const captured: Array<{
      el: HTMLElement;
      type: string;
      handler: EventListenerOrEventListenerObject;
    }> = [];

    HTMLElement.prototype.addEventListener = function (
      type: string,
      handler: EventListenerOrEventListenerObject,
      ...args: any[]
    ) {
      captured.push({ el: this as unknown as HTMLElement, type, handler });
      return origAddEventListener.call(this, type, handler, ...args);
    };

    try {
      const { container } = render(
        React.createElement(EmdEditor, { value: 'test', onSave })
      );
      const view = getView(container);
      expect(view).toBeTruthy();

      // Find the keydown handler that CM6 installed on contentDOM
      const keydownEntries = captured.filter(
        (c) => c.el === view!.contentDOM && c.type === 'keydown'
      );
      expect(keydownEntries.length).toBeGreaterThanOrEqual(1);

      // Invoke the CM6 key handler with a mock KeyboardEvent.
      // jsdom defaults to Win32 platform, so Mod-s compiles to Ctrl-s.
      // Only set ctrlKey, not metaKey, to produce the correct "Ctrl-s" name.
      const mockEvent = {
        type: 'keydown',
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        repeat: false,
        getModifierState: () => false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        stopImmediatePropagation: vi.fn(),
        defaultPrevented: false,
        cancelable: true,
        bubbles: true,
        composed: true,
        target: view!.contentDOM,
        currentTarget: view!.contentDOM,
      } as unknown as KeyboardEvent;

      (keydownEntries[0].handler as EventListener).call(
        view!.contentDOM,
        mockEvent
      );
      expect(onSave).toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.addEventListener = origAddEventListener;
    }
  });

  it('updates content when value prop changes externally', () => {
    const { container, rerender } = render(
      React.createElement(EmdEditor, { value: 'A' })
    );
    const view = getView(container);
    expect(view).toBeTruthy();
    expect(view!.state.doc.toString()).toBe('A');

    rerender(React.createElement(EmdEditor, { value: 'B' }));
    expect(view!.state.doc.toString()).toBe('B');
  });

  it('exposes imperative ref with focus, getContent, setContent', () => {
    const ref = createRef<EmdEditorRef>();
    render(
      React.createElement(EmdEditor, { value: 'initial', ref })
    );

    expect(ref.current).toBeTruthy();
    expect(ref.current!.getContent()).toBe('initial');

    ref.current!.setContent('updated');
    expect(ref.current!.getContent()).toBe('updated');

    ref.current!.focus();
    ref.current!.blur();
  });

  it('applies custom className to container div', () => {
    const { container } = render(
      React.createElement(EmdEditor, { className: 'custom-editor' })
    );
    const editorDiv = container.querySelector('.emd-editor');
    expect(editorDiv).toBeTruthy();
    expect(editorDiv!.classList.contains('custom-editor')).toBe(true);
  });
});
