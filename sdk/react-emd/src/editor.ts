import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { history, undo, redo } from '@codemirror/commands';
import { liveMarkdownPlugin } from './live-md';
import type { LiveMdConfig } from './live-md/types';
import type { EmdDocument } from '@everthink/emd';

export interface EmdEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  ast?: EmdDocument | null;
  config?: Partial<LiveMdConfig>;
  className?: string;
  readOnly?: boolean;
  onNavigate?: (target: string) => void;
  onSave?: () => void;
}

export interface EmdEditorRef {
  focus(): void;
  blur(): void;
  getContent(): string;
  setContent(content: string): void;
  undo(): void;
  redo(): void;
  getEditorView(): EditorView | null;
}

export const EmdEditor = React.forwardRef<EmdEditorRef, EmdEditorProps>(
  (props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const liveMdCompartmentRef = useRef(new Compartment());
    const readOnlyCompartmentRef = useRef(new Compartment());

    useEffect(() => {
      if (!containerRef.current) return;

      const view = new EditorView({
        doc: props.value ?? '',
        parent: containerRef.current,
        extensions: [
          history(),
          markdown({ base: markdownLanguage }),
          liveMdCompartmentRef.current.of(
            liveMarkdownPlugin(props.config, props.ast)
          ),
          readOnlyCompartmentRef.current.of(
            props.readOnly ? EditorState.readOnly.of(true) : []
          ),
          keymap.of([{
            key: 'Mod-s',
            run: () => {
              props.onSave?.();
              return true;
            },
            preventDefault: true,
          }]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              props.onChange?.(update.state.doc.toString());
            }
          }),
        ],
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentContent = view.state.doc.toString();
      if (props.value !== undefined && props.value !== currentContent) {
        view.dispatch({
          changes: { from: 0, to: currentContent.length, insert: props.value },
        });
      }
    }, [props.value]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: liveMdCompartmentRef.current.reconfigure(
          liveMarkdownPlugin(props.config, props.ast)
        ),
      });
    }, [props.config, props.ast]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: readOnlyCompartmentRef.current.reconfigure(
          props.readOnly ? EditorState.readOnly.of(true) : []
        ),
      });
    }, [props.readOnly]);

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      blur: () => viewRef.current?.contentDOM.blur(),
      getContent: () => viewRef.current?.state.doc.toString() ?? '',
      setContent: (content: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: content },
        });
      },
      undo: () => {
        const view = viewRef.current;
        if (view) undo(view);
      },
      redo: () => {
        const view = viewRef.current;
        if (view) redo(view);
      },
      getEditorView: () => viewRef.current,
    }), []);

    const className = `emd-editor ${props.className ?? ''}`.trim();

    return React.createElement('div', {
      ref: containerRef,
      className,
    });
  }
);
