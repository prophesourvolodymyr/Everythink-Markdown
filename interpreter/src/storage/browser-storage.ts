import type { StorageProvider } from '@core/types';

export class MemoryStorage implements StorageProvider {
  private files = new Map<string, string>();

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async list(dir: string): Promise<string[]> {
    const prefix = dir === '.' ? '' : `${dir.replace(/\/$/, '')}/`;
    const files: string[] = [];

    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        files.push(path);
      }
    }

    return files;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async mkdir(_path: string): Promise<void> {
    // No-op in memory storage
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const content = this.files.get(oldPath);
    if (content === undefined) {
      throw new Error(`File not found: ${oldPath}`);
    }
    this.files.set(newPath, content);
    this.files.delete(oldPath);
  }
}

export class BrowserStorage implements StorageProvider {
  private root: FileSystemDirectoryHandle | null = null;

  static async isSupported(): Promise<boolean> {
    try {
      return 'storage' in navigator && 'getDirectory' in navigator.storage!;
    } catch {
      return false;
    }
  }

  async mount(rootName = 'emd-workspace'): Promise<void> {
    try {
      this.root = await navigator.storage.getDirectory();
    } catch {
      throw new Error(
        'OPFS is not available. Use TauriStorage or MemoryStorage instead.',
      );
    }
  }

  async read(path: string): Promise<string> {
    if (!this.root) {
      throw new Error('BrowserStorage not mounted. Call mount() first.');
    }

    const fileHandle = await this.getFileHandle(path);
    if (!fileHandle) {
      throw new Error(`File not found: ${path}`);
    }

    const file = await fileHandle.getFile();
    return await file.text();
  }

  async write(path: string, content: string): Promise<void> {
    if (!this.root) {
      throw new Error('BrowserStorage not mounted. Call mount() first.');
    }

    await this.ensureDirectory(path);
    const parts = path.split('/');
    const fileName = parts.pop()!;
    const dirHandle = await this.resolveDirectory(parts.join('/') || '.');

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async list(dir: string): Promise<string[]> {
    if (!this.root) {
      throw new Error('BrowserStorage not mounted. Call mount() first.');
    }

    const dirHandle = await this.resolveDirectory(dir);
    const entries: string[] = [];

    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === 'file') {
        entries.push(dir === '.' ? name : `${dir}/${name}`);
      }
    }

    return entries;
  }

  async exists(path: string): Promise<boolean> {
    if (!this.root) {
      return false;
    }
    try {
      await this.getFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    if (!this.root) {
      throw new Error('BrowserStorage not mounted. Call mount() first.');
    }
    await this.resolveDirectory(path);
  }

  async delete(path: string): Promise<void> {
    if (!this.root) {
      throw new Error('BrowserStorage not mounted. Call mount() first.');
    }

    const parts = path.split('/');
    const fileName = parts.pop()!;
    const dirHandle = await this.resolveDirectory(parts.join('/') || '.');
    await dirHandle.removeEntry(fileName);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const content = await this.read(oldPath);
    await this.write(newPath, content);
    await this.delete(oldPath);
  }

  watch(
    path: string,
    callback: (path: string, content: string) => void,
  ): () => void {
    // OPFS does not support file-system watchers natively.
    // Poll-based fallback could be added in V2.
    console.warn('OPFS watch is a no-op. Filesystem watcher not available.');
    return () => {};
  }

  private async getFileHandle(path: string): Promise<FileSystemFileHandle | null> {
    const parts = path.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/') || '.';
    const dirHandle = await this.resolveDirectory(dirPath);
    return await dirHandle.getFileHandle(fileName);
  }

  private async resolveDirectory(dir: string): Promise<FileSystemDirectoryHandle> {
    if (!this.root) {
      throw new Error('BrowserStorage not mounted.');
    }

    if (dir === '.' || dir === '') {
      return this.root;
    }

    const parts = dir.split('/').filter(Boolean);
    let current = this.root;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    return current;
  }

  private async ensureDirectory(path: string): Promise<void> {
    const parts = path.split('/');
    parts.pop();
    if (parts.length > 0) {
      await this.resolveDirectory(parts.join('/'));
    }
  }
}

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}
