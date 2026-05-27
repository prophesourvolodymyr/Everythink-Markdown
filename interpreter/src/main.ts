import './blocks/fallback-block';
import './blocks/markdown-block';
import './blocks/code-block';
import './blocks/mermaid-block';
import './blocks/katex-block';
import './blocks/html-block';
import './blocks/image-block';
import './blocks/table-block';
import './blocks/diff-block';
import './blocks/task-block';
import './blocks/media-block';
import './blocks/canvas-block';
import './blocks/flowchart-block';
import './blocks/kanban-block';
import './components/emd-editor';
import './components/emd-workspace';
import './components/emd-settings';
import { EmdWorkspace } from './components/emd-workspace';
import { MemoryStorage, BrowserStorage } from './storage/browser-storage';

async function initializeApp(): Promise<void> {
  const workspace = document.getElementById('workspace') as EmdWorkspace;

  if (!workspace) {
    console.error('Workspace element not found');
    return;
  }

  let storage;

  const browserStorageSupported = await BrowserStorage.isSupported();
  if (browserStorageSupported) {
    const bs = new BrowserStorage();
    await bs.mount();
    storage = bs;
  } else {
    storage = new MemoryStorage();
  }

  workspace.initialize(storage);

  const sampleContent = [
    '## [summary] Welcome to EMD Interpreter',
    '',
    'This is the **Everything MarkDown** Visual Interpreter — interactive blocks for typed markdown.',
    '',
    '## [task|in-progress] Core blocks implemented',
    '',
    '- [x] Markdown text block with CodeMirror 6',
    '- [x] Code block with syntax highlighting',
    '- [x] Mermaid diagram block (lazy loaded)',
    '- [x] KaTeX math block (lazy loaded)',
    '- [x] HTML/CSS sandbox block',
    '- [x] Image block with resize',
    '- [x] Table block with sort + CSV export',
    '- [ ] Canvas, AI, and distribution',
    '',
    '## [detail] Code Block Demo',
    '',
    '```ts',
    'interface EmdPlugin {',
    '  id: string;',
    '  name: string;',
    '  version: string;',
    '  component: new () => HTMLElement;',
    '}',
    '',
    'function registerBlockPlugin(plugin: EmdPlugin): void {',
    '  registry.set(plugin.id, plugin);',
    '}',
    '```',
    '',
    '## [detail] Mermaid Diagram Demo',
    '',
    '```mermaid',
    'graph TD',
    '    A[EMD File] --> B[WASM Parser]',
    '    B --> C[Block Manager]',
    '    C --> D[Block Tree]',
    '    D --> E[Visual Blocks]',
    '    E --> F{Block Type}',
    '    F -->|text| G[CodeMirror 6]',
    '    F -->|mermaid| H[Mermaid.js]',
    '    F -->|katex| I[KaTeX]',
    '    F -->|html| J[Sandboxed iframe]',
    '```',
    '',
    '## [detail] KaTeX Math Demo',
    '',
    '```katex',
    '$$',
    '\\ int_{-\\ infty}^{\\ infty} e^{-x^2} dx = \\ sqrt{\\ pi}',
    '$$',
    '',
    'Matrix:',
    '$$',
    '\\ begin{pmatrix}',
    'a & b \\\\',
    'c & d',
    '\\ end{pmatrix}',
    '$$',
    '```',
    '',
    '## [detail] Table Demo',
    '',
    '| Language | Type | Speed | Popularity |',
    '|----------|------|-------|------------|',
    '| Rust | Compiled | Fast | Growing |',
    '| TypeScript | Interpreted | Medium | High |',
    '| Python | Interpreted | Slow | Very High |',
    '| Go | Compiled | Fast | High |',
    '',
    '## [detail] Canvas Drawing Demo',
    '',
    '```draw',
    JSON.stringify({
      version: 1,
      width: 800,
      height: 500,
      commands: [
        { type: 'rect', x: 50, y: 50, width: 200, height: 100, strokeColor: '#3b82f6', fillColor: '#dbeafe', lineWidth: 3, opacity: 0.9 },
        { type: 'circle', x: 300, y: 50, radius: 60, strokeColor: '#22c55e', fillColor: '#dcfce7', lineWidth: 3 },
        { type: 'freehand', points: [{ x: 400, y: 150 }, { x: 450, y: 120 }, { x: 500, y: 140 }, { x: 550, y: 100 }, { x: 600, y: 130 }], strokeColor: '#ef4444', lineWidth: 4 },
        { type: 'arrow', x: 80, y: 200, x2: 350, y2: 200, strokeColor: '#f59e0b', lineWidth: 3 },
        { type: 'text', x: 400, y: 220, text: 'Hello EMD!', strokeColor: '#8b5cf6', fontSize: 32 },
        { type: 'line', x: 20, y: 300, x2: 780, y2: 300, strokeColor: '#6b7280', lineWidth: 2, opacity: 0.5 },
      ],
      zoom: 1,
      panX: 0,
      panY: 0,
      gridEnabled: false,
      gridSize: 20,
    }),
    '```',
    '',
    '## [task] Next Steps',
    '',
    '- [x] Build canvas block (drawing + zoom + export)',
    '- [ ] Implement AI chat panel',
    '- [ ] Build flowchart + kanban blocks',
    '',
    '## [meta] Project Info',
    '',
    'Phase 3 of EMD interpreter — 20 tests passing, TypeScript + Vite + web components.',
    'All blocks register through the plugin API. No React, Vue, or Svelte.',
  ].join('\n');

  await storage.write('welcome.emd', sampleContent);
  await workspace.openFile('welcome.emd');

  document.getElementById('btn-new-file')?.addEventListener('click', async () => {
    const name = prompt('File name (e.g. notes.emd):');
    if (name) {
      await storage.write(name, '## [summary] New File\n\nStart writing...\n');
      await workspace.openFile(name);
    }
  });

  document.getElementById('btn-open-file')?.addEventListener('click', async () => {
    try {
      const files = await storage.list('.');
      const emdFiles = files.filter((f) => f.endsWith('.emd'));
      const file = prompt('Files:\n' + emdFiles.map((f) => `  ${f}`).join('\n') + '\n\nOpen:');
      if (file) {
        await workspace.openFile(file);
      }
    } catch (err) {
      console.error('Error listing files:', err);
    }
  });

  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    workspace.toggleSidebar();
    if (workspace.isSidebarVisible()) {
      workspace.refreshFileExplorer();
    }
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    workspace.showSettings();
  });

  console.log('EMD Interpreter initialized');
  console.log('- 13 block plugins loaded: markdown, code, mermaid, katex, html, image, table, diff, task, media, canvas, flowchart, kanban');
  console.log('- Storage: Browser (OPFS) / Memory');
}

document.addEventListener('DOMContentLoaded', initializeApp);
