import type {
  BlockPlugin,
  PluginId,
  SectionType,
  CodeBlockTag,
  Block,
  BlockToolbarItem,
} from './types';

class PluginRegistry {
  private plugins = new Map<PluginId, BlockPlugin>();
  private sectionTypeIndex = new Map<SectionType, PluginId[]>();
  private codeBlockTagIndex = new Map<CodeBlockTag, PluginId[]>();
  private listeners = new Set<() => void>();

  registerBlockPlugin(plugin: BlockPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }

    this.plugins.set(plugin.id, plugin);

    for (const st of plugin.section_types ?? []) {
      const list = this.sectionTypeIndex.get(st) ?? [];
      list.push(plugin.id);
      this.sectionTypeIndex.set(st, list);
    }

    for (const tag of plugin.code_block_tags ?? []) {
      const list = this.codeBlockTagIndex.get(tag) ?? [];
      list.push(plugin.id);
      this.codeBlockTagIndex.set(tag, list);
    }

    this.listeners.forEach((fn) => fn());
  }

  unregisterBlockPlugin(pluginId: PluginId): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    for (const [st, ids] of this.sectionTypeIndex) {
      this.sectionTypeIndex.set(
        st,
        ids.filter((id) => id !== pluginId),
      );
    }

    for (const [tag, ids] of this.codeBlockTagIndex) {
      this.codeBlockTagIndex.set(
        tag,
        ids.filter((id) => id !== pluginId),
      );
    }

    this.plugins.delete(pluginId);
    this.listeners.forEach((fn) => fn());
  }

  getPlugin(pluginId: PluginId): BlockPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginsForSectionType(sectionType: SectionType): BlockPlugin[] {
    const ids = this.sectionTypeIndex.get(sectionType) ?? [];
    return ids.map((id) => this.plugins.get(id)).filter(Boolean) as BlockPlugin[];
  }

  getPluginsForCodeBlockTag(tag: CodeBlockTag): BlockPlugin[] {
    const ids = this.codeBlockTagIndex.get(tag) ?? [];
    return ids.map((id) => this.plugins.get(id)).filter(Boolean) as BlockPlugin[];
  }

  getAllPlugins(): BlockPlugin[] {
    return Array.from(this.plugins.values());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  resolvePlugin(
    sectionType?: SectionType,
    codeBlockTag?: CodeBlockTag,
  ): PluginId {
    if (codeBlockTag) {
      const plugins = this.getPluginsForCodeBlockTag(codeBlockTag);
      if (plugins.length > 0) {
        return plugins[0]!.id;
      }
    }

    if (sectionType) {
      const plugins = this.getPluginsForSectionType(sectionType);
      if (plugins.length > 0) {
        return plugins[0]!.id;
      }
    }

    return 'fallback-block';
  }

  getToolbarItems(pluginId: PluginId): BlockToolbarItem[] {
    const plugin = this.plugins.get(pluginId);
    return plugin?.toolbar ?? [];
  }

  clear(): void {
    this.plugins.clear();
    this.sectionTypeIndex.clear();
    this.codeBlockTagIndex.clear();
  }
}

const globalRegistry = new PluginRegistry();

export function registerBlockPlugin(plugin: BlockPlugin): void {
  globalRegistry.registerBlockPlugin(plugin);
}

export function unregisterBlockPlugin(pluginId: PluginId): void {
  globalRegistry.unregisterBlockPlugin(pluginId);
}

export function getBlockPlugin(pluginId: PluginId): BlockPlugin | undefined {
  return globalRegistry.getPlugin(pluginId);
}

export function getAllPlugins(): BlockPlugin[] {
  return globalRegistry.getAllPlugins();
}

export function onPluginRegistryChange(fn: () => void): () => void {
  return globalRegistry.onChange(fn);
}

export function resolveBlockPlugin(
  sectionType?: SectionType,
  codeBlockTag?: CodeBlockTag,
): PluginId {
  return globalRegistry.resolvePlugin(sectionType, codeBlockTag);
}

export function getToolbarItems(pluginId: PluginId): BlockToolbarItem[] {
  return globalRegistry.getToolbarItems(pluginId);
}

export { globalRegistry as pluginRegistry };
export { PluginRegistry };
