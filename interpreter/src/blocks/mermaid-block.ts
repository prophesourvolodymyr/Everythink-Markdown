import { Block, BlockPlugin, CodeBlockTag, getCodeBlockContent } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const MERMAID_BLOCK_TAG = 'emd-mermaid-block';

let mermaidModule: typeof import('mermaid') | null = null;

async function loadMermaid(): Promise<typeof import('mermaid')> {
  if (mermaidModule) return mermaidModule;
  mermaidModule = await import('mermaid');
  mermaidModule.default.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
    journey: { useMaxWidth: true },
  });
  return mermaidModule;
}

export class EmdMermaidBlock extends HTMLElement {
  private blockData: Block | null = null;
  private svgContainer!: HTMLElement;
  private errorEl!: HTMLElement;
  private zoomLevel = 1;
  private renderId: string;

  constructor() {
    super();
    this.renderId = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
  }

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-mermaid');
    this.innerHTML = `
      <div class="emd-mermaid-toolbar">
        <button class="emd-mermaid-zoom-in" title="Zoom In">+</button>
        <button class="emd-mermaid-zoom-out" title="Zoom Out">−</button>
        <button class="emd-mermaid-zoom-reset" title="Reset Zoom">⌂</button>
        <button class="emd-mermaid-export-svg" title="Export SVG">⇩ SVG</button>
        <button class="emd-mermaid-export-png" title="Export PNG">⇩ PNG</button>
      </div>
      <div class="emd-mermaid-svg"></div>
      <div class="emd-mermaid-error" style="display:none;color:var(--emd-error, #dc2626);padding:8px;"></div>
    `;

    this.svgContainer = this.querySelector('.emd-mermaid-svg')!;
    this.errorEl = this.querySelector('.emd-mermaid-error')!;

    this.querySelector('.emd-mermaid-zoom-in')!.addEventListener('click', () => this.zoom(0.2));
    this.querySelector('.emd-mermaid-zoom-out')!.addEventListener('click', () => this.zoom(-0.2));
    this.querySelector('.emd-mermaid-zoom-reset')!.addEventListener('click', () => this.zoomTo(1));
    this.querySelector('.emd-mermaid-export-svg')!.addEventListener('click', () => this.exportSVG());
    this.querySelector('.emd-mermaid-export-png')!.addEventListener('click', () => this.exportPNG());
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  async render(content: string): Promise<void> {
    if (!content.trim()) {
      this.svgContainer.innerHTML = '';
      return;
    }

    try {
      const mermaid = await loadMermaid();
      this.errorEl.style.display = 'none';

      const { svg } = await mermaid.default.render(this.renderId, content);
      this.svgContainer.innerHTML = svg;
      this.applyZoom();
    } catch (err) {
      this.errorEl.style.display = '';
      this.errorEl.textContent = `Mermaid error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private zoom(delta: number): void {
    this.zoomTo(Math.max(0.1, Math.min(3, this.zoomLevel + delta)));
  }

  private zoomTo(level: number): void {
    this.zoomLevel = level;
    this.applyZoom();
  }

  private applyZoom(): void {
    const svg = this.svgContainer.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${this.zoomLevel})`;
      svg.style.transformOrigin = 'top left';
      svg.style.maxWidth = 'none';
    }
  }

  private exportSVG(): void {
    const svg = this.svgContainer.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    this.download(blob, 'diagram.svg');
  }

  private async exportPNG(): Promise<void> {
    const svg = this.svgContainer.querySelector('svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => { canvas.width = img.width * 2; canvas.height = img.height * 2; ctx.scale(2, 2); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(); };
      img.onerror = reject;
      img.src = url;
    });

    canvas.toBlob((b) => { if (b) this.download(b, 'diagram.png'); }, 'image/png');
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

if (!customElements.get(MERMAID_BLOCK_TAG)) {
  customElements.define(MERMAID_BLOCK_TAG, EmdMermaidBlock);
}

const mermaidBlockPlugin: BlockPlugin = {
  id: 'mermaid-block',
  name: 'Mermaid Diagram Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Mermaid, CodeBlockTag.Gantt],
  component: EmdMermaidBlock,
  toolbar: [
    { id: 'mermaid-zoomin', label: 'Zoom In', icon: '+', action: () => {} },
    { id: 'mermaid-zoomout', label: 'Zoom Out', icon: '−', action: () => {} },
    { id: 'mermaid-export', label: 'Export', icon: '⇩', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdMermaidBlock) {
      element.setBlock(block);
      const content = block.section ? getCodeBlockContent(block.section.content) : undefined;
      if (content) {
        element.render(content);
      }
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdMermaidBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(mermaidBlockPlugin);

export { MERMAID_BLOCK_TAG, mermaidBlockPlugin };
