import type { StorageProvider } from '@core/types';

export class TauriStorage implements StorageProvider {
  private invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null =
    null;

  async initialize(): Promise<void> {
    try {
      // @ts-expect-error - @tauri-apps/api is only available in Tauri context
      const tauri = await import('@tauri-apps/api/core');
      this.invoke = tauri.invoke;
    } catch {
      throw new Error(
        'Tauri API not available. Running outside Tauri? Use BrowserStorage or MemoryStorage.',
      );
    }
  }

  async read(path: string): Promise<string> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    return (await this.invoke('read_file', { path })) as string;
  }

  async write(path: string, content: string): Promise<void> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    await this.invoke('write_file', { path, content });
  }

  async list(dir: string): Promise<string[]> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    return (await this.invoke('list_files', { dir })) as string[];
  }

  async exists(path: string): Promise<boolean> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    return (await this.invoke('file_exists', { path })) as boolean;
  }

  async mkdir(path: string): Promise<void> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    await this.invoke('mkdir', { path });
  }

  async delete(path: string): Promise<void> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    await this.invoke('delete_file', { path });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }
    await this.invoke('rename_file', { oldPath, newPath });
  }

  watch(
    _path: string,
    _callback: (path: string, content: string) => void,
  ): () => void {
    if (!this.invoke) {
      throw new Error('TauriStorage not initialized. Call initialize() first.');
    }

    let unwatch: (() => void) | null = null;

    (async () => {
      try {
        // @ts-expect-error - @tauri-apps/api is only available in Tauri context
        const { listen }: { listen: (event: string, handler: (e: { payload: unknown }) => void) => Promise<() => void> } = await import('@tauri-apps/api/event');
        const unlisten = await listen(
          'file-changed',
          (event: { payload: unknown }) => {
            const payload = event.payload as { path: string; content: string };
            _callback(payload.path, payload.content);
          },
        );
        unwatch = unlisten;

        await this.invoke!('watch_path', { path: _path });
      } catch (err) {
        console.error('Failed to set up file watcher:', err);
      }
    })();

    return () => {
      unwatch?.();
    };
  }
}

export class RustStorage implements StorageProvider {
  private fs: StorageProvider;

  constructor(fs: StorageProvider) {
    this.fs = fs;
  }

  async read(path: string): Promise<string> {
    return this.fs.read(path);
  }

  async write(path: string, content: string): Promise<void> {
    return this.fs.write(path, content);
  }

  async list(dir: string): Promise<string[]> {
    return this.fs.list(dir);
  }

  async exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  async mkdir(path: string): Promise<void> {
    return this.fs.mkdir(path);
  }

  async delete(path: string): Promise<void> {
    return this.fs.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return this.fs.rename(oldPath, newPath);
  }

  watch(
    path: string,
    callback: (path: string, content: string) => void,
  ): () => void {
    return this.fs.watch?.(path, callback) ?? (() => {});
  }
}
