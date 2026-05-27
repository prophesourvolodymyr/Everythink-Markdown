import type { Tree } from '@lezer/common';
import type { Range, EditorState } from '@codemirror/state';
import { Decoration, WidgetType, type EditorView } from '@codemirror/view';
import type {
  BlockResolverConfig,
  BlockWidget,
  BlockWidgetConstructor,
  BlockWidgetContext,
} from './types';
import type { EmdDocument } from '@everthink/emd';

const widgetRegistry = new Map<string, BlockWidgetConstructor>();

export function registerBlockWidget(
  tag: string,
  constructor: BlockWidgetConstructor
): void {
  widgetRegistry.set(tag, constructor);
}

export function unregisterBlockWidget(tag: string): void {
  widgetRegistry.delete(tag);
}

export function getBlockWidget(
  tag: string
): BlockWidgetConstructor | undefined {
  return widgetRegistry.get(tag);
}

const KNOWN_LANGUAGES = new Set([
  'javascript',
  'js',
  'typescript',
  'ts',
  'python',
  'py',
  'rust',
  'rs',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'cs',
  'ruby',
  'rb',
  'php',
  'swift',
  'kotlin',
  'scala',
  'elixir',
  'ex',
  'haskell',
  'hs',
  'lua',
  'r',
  'sql',
  'sh',
  'bash',
  'zsh',
  'yaml',
  'yml',
  'json',
  'xml',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'graphql',
  'gql',
  'dockerfile',
  'docker',
  'toml',
  'ini',
  'cfg',
  'makefile',
  'cmake',
  'perl',
  'pl',
  'markdown',
  'md',
  'tex',
  'latex',
]);

let currentView: EditorView | null = null;

export function setBlockResolverView(view: EditorView | null): void {
  currentView = view;
}

function getCodeFenceTag(infoString: string): string {
  const trimmed = infoString.trim();
  const spaceIndex = trimmed.indexOf(' ');
  return spaceIndex > 0 ? trimmed.slice(0, spaceIndex) : trimmed;
}

class BlockWidgetDecoration extends WidgetType {
  private widget: BlockWidget | null = null;

  constructor(
    private tag: string,
    private content: string,
    private ctor: BlockWidgetConstructor,
    private sourceSpan: { from: number; to: number }
  ) {
    super();
  }

  eq(other: BlockWidgetDecoration): boolean {
    return this.tag === other.tag && this.content === other.content;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'emd-block-resolver-widget';

    const context: BlockWidgetContext = {
      view: currentView!,
      sourceSpan: this.sourceSpan,
      writeBack: (newContent: string) => {
        this.doWriteBack(newContent);
      },
    };

    this.widget = this.ctor(this.content, context);
    this.widget.mount(container);

    return container;
  }

  destroy(_dom: HTMLElement): void {
    if (this.widget) {
      this.widget.destroy();
      this.widget = null;
    }
  }

  get estimatedHeight(): number {
    return this.widget?.getEstimatedHeight() ?? 150;
  }

  private doWriteBack(newContent: string): void {
    if (!currentView) return;

    const view = currentView;
    const doc = view.state.doc;

    const blockText = doc.sliceString(this.sourceSpan.from, this.sourceSpan.to);

    const openFenceEnd = blockText.indexOf('\n');
    if (openFenceEnd < 0) return;

    const lastNewline = blockText.lastIndexOf('\n');
    if (lastNewline <= openFenceEnd) return;

    const blockContentFrom = this.sourceSpan.from + openFenceEnd + 1;
    const blockContentTo = this.sourceSpan.from + lastNewline;

    view.dispatch({
      changes: {
        from: blockContentFrom,
        to: blockContentTo,
        insert: newContent,
      },
    });
  }
}

function findInfoStringTag(
  tree: Tree,
  fencedCodeFrom: number,
  state: EditorState
): string | null {
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'CodeInfo' && cursor.from > fencedCodeFrom) {
      const tagText = state.doc.sliceString(cursor.from, cursor.to);
      return getCodeFenceTag(tagText);
    }
  } while (cursor.next() && cursor.from < fencedCodeFrom + 200);
  return null;
}

export function buildBlockResolverDecorations(
  tree: Tree,
  _ast: EmdDocument | null,
  config: BlockResolverConfig,
  state: EditorState
): Range<Decoration>[] {
  if (!config.enabled) return [];

  const decorations: Range<Decoration>[] = [];
  const cursor = tree.cursor();

  do {
    if (cursor.type.name !== 'FencedCode') continue;

    const fencedCodeFrom = cursor.from;
    const fencedCodeTo = cursor.to;

    const tag = findInfoStringTag(tree, fencedCodeFrom, state);
    if (!tag || tag === '') continue;

    const tagLower = tag.toLowerCase();
    if (KNOWN_LANGUAGES.has(tagLower)) continue;

    const widgetCtor = config.widgets[tagLower];
    if (!widgetCtor) continue;

    const blockText = state.doc.sliceString(fencedCodeFrom, fencedCodeTo);

    const openFenceEnd = blockText.indexOf('\n');
    if (openFenceEnd < 0) continue;

    const lastNewline = blockText.lastIndexOf('\n');
    if (lastNewline <= openFenceEnd) continue;

    const contentFromOffset = openFenceEnd + 1;
    const contentToOffset = lastNewline;
    const blockContent = blockText.slice(contentFromOffset, contentToOffset);

    if (blockContent.length > config.maxBlockSize) {
      console.warn(
        `[BlockResolver] Block content for tag "${tag}" exceeds maxBlockSize (${blockContent.length} > ${config.maxBlockSize}), skipping.`
      );
      continue;
    }

    const blockDecoration = new BlockWidgetDecoration(
      tag,
      blockContent,
      widgetCtor,
      { from: fencedCodeFrom, to: fencedCodeTo }
    );

    decorations.push(
      Decoration.replace({
        widget: blockDecoration,
        block: true,
      }).range(fencedCodeFrom, fencedCodeTo)
    );
  } while (cursor.next());

  return decorations;
}
