import {
  ViewPlugin,
  Decoration,
  type ViewUpdate,
  type EditorView,
  type PluginValue,
  type DecorationSet,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Range } from '@codemirror/state';
import type { Tree } from '@lezer/common';
import {
  type LiveMdConfig,
  DEFAULT_LIVE_MD_CONFIG,
  type DecorationBuilder,
} from './types';
import { buildSyntaxHiderDecorations } from './syntax-hider';
import { buildTextStylerDecorations } from './text-styler';
import { buildLinkRendererDecorations } from './link-renderer';
import { buildStatusBadgeDecorations } from './status-badge';
import { buildTypeBadgeDecorations } from './type-badge';
import { buildBlockResolverDecorations, setBlockResolverView } from './block-resolver';
import type { EmdDocument } from '@everthink/emd';

const BUILDERS: DecorationBuilder[] = [
  (tree, _ast, config, _state) =>
    buildSyntaxHiderDecorations(tree, config.syntaxHider),
  (tree, _ast, config, _state) =>
    buildTextStylerDecorations(tree, config.textStyler),
  (tree, _ast, config, state) =>
    buildLinkRendererDecorations(tree, _ast, config, state.doc.toString()),
  (tree, _ast, config, _state) =>
    buildStatusBadgeDecorations(tree, _ast, config.statusBadge),
  (tree, _ast, config, _state) =>
    buildTypeBadgeDecorations(tree, _ast, config.typeBadge),
  (tree, _ast, config, state) =>
    buildBlockResolverDecorations(tree, _ast, config.blockResolver, state),
];

class LiveMdPlugin implements PluginValue {
  private decorations: DecorationSet = Decoration.none;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private config: LiveMdConfig;
  private ast: EmdDocument | null;

  constructor(
    private view: EditorView,
    config: Partial<LiveMdConfig> = {},
    ast: EmdDocument | null = null
  ) {
    this.config = { ...DEFAULT_LIVE_MD_CONFIG, ...config };
    this.ast = ast;
    this.rebuildDecorations(view.state);
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.rebuildDecorations(update.state);
    }, this.config.debounceMs);
  }

  rebuildDecorations(state: EditorState): void {
    const tree: Tree = syntaxTree(state);
    const allRanges: Range<Decoration>[] = [];

    setBlockResolverView(this.view);

    for (const builder of BUILDERS) {
      const ranges = builder(tree, this.ast, this.config, state);
      allRanges.push(...ranges);
    }

    this.decorations = Decoration.set(allRanges, true);
  }

  get decorationsField(): DecorationSet {
    return this.decorations;
  }
}

export function liveMdViewPlugin(
  config?: Partial<LiveMdConfig>,
  ast?: EmdDocument | null
) {
  return ViewPlugin.define(
    (view) => new LiveMdPlugin(view, config, ast ?? null),
    {
      decorations: (plugin) => plugin.decorationsField,
    }
  );
}

export { LiveMdPlugin };
