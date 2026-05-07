import { Block, BlockPlugin } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const IMAGE_BLOCK_TAG = 'emd-image-block';

export class EmdImageBlock extends HTMLElement {
  private blockData: Block | null = null;
  private imgEl!: HTMLImageElement;
  private captionEl!: HTMLElement;
  private resizeHandle!: HTMLElement;
  private width: string | null = null;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-image');
    this.innerHTML = `
      <div class="emd-image-container">
        <img class="emd-image-img" alt="" style="max-width:100%;display:block;" />
        <div class="emd-image-resize-handle" title="Drag to resize"></div>
      </div>
      <div class="emd-image-caption" contenteditable="true" placeholder="Add caption..."></div>
      <div class="emd-image-toolbar" style="display:none;">
        <button class="emd-image-fit">Fit width</button>
        <button class="emd-image-actual">Actual size</button>
        <button class="emd-image-small">Small</button>
        <button class="emd-image-medium">Medium</button>
        <button class="emd-image-large">Large</button>
      </div>
    `;

    this.imgEl = this.querySelector('.emd-image-img')!;
    this.captionEl = this.querySelector('.emd-image-caption')!;
    this.resizeHandle = this.querySelector('.emd-image-resize-handle')!;

    const container = this.querySelector('.emd-image-container')! as HTMLElement;
    const toolbar = this.querySelector('.emd-image-toolbar')! as HTMLElement;

    container.addEventListener('mouseenter', () => { toolbar.style.display = ''; });
    container.addEventListener('mouseleave', () => { toolbar.style.display = 'none'; });

    this.querySelector('.emd-image-fit')!.addEventListener('click', () => this.setWidth('100%'));
    this.querySelector('.emd-image-actual')!.addEventListener('click', () => this.setWidth(null));
    this.querySelector('.emd-image-small')!.addEventListener('click', () => this.setWidth('200px'));
    this.querySelector('.emd-image-medium')!.addEventListener('click', () => this.setWidth('400px'));
    this.querySelector('.emd-image-large')!.addEventListener('click', () => this.setWidth('600px'));

    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    this.resizeHandle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startWidth = this.imgEl.offsetWidth;
      e.preventDefault();
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const delta = e.clientX - startX;
      this.imgEl.style.width = `${Math.max(50, startWidth + delta)}px`;
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        document.body.style.userSelect = '';
        this.width = this.imgEl.style.width || null;
      }
    });

    // Handle paste events for image insertion
    this.addEventListener('paste', (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              this.setSrc(reader.result as string);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    });

    // Handle drag-and-drop of images
    this.addEventListener('dragover', (e) => e.preventDefault());
    this.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          this.setSrc(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);

    // Find image URL from links or wiki-links in content
    for (const el of block.section?.content ?? []) {
      if ('Link' in el && (
        el.Link.target.startsWith('http') ||
        el.Link.target.startsWith('data:') ||
        el.Link.target.startsWith('/') ||
        el.Link.target.endsWith('.png') ||
        el.Link.target.endsWith('.jpg') ||
        el.Link.target.endsWith('.svg') ||
        el.Link.target.endsWith('.gif') ||
        el.Link.target.endsWith('.webp')
      )) {
        this.setSrc(el.Link.target);
      }
      if ('Text' in el && el.Text.trim()) {
        // Markdown image: ![alt](url)
        const match = el.Text.match(/!\[.*?\]\((.+?)\)/);
        if (match?.[1]) {
          this.setSrc(match[1]);
        }
      }
    }
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  setSrc(src: string): void {
    this.imgEl.src = src;
    this.imgEl.alt = this.captionEl.textContent ?? '';
  }

  getSrc(): string {
    return this.imgEl.src;
  }

  private setWidth(width: string | null): void {
    this.width = width;
    this.imgEl.style.width = width ?? '';
  }
}

if (!customElements.get(IMAGE_BLOCK_TAG)) {
  customElements.define(IMAGE_BLOCK_TAG, EmdImageBlock);
}

const imageBlockPlugin: BlockPlugin = {
  id: 'image-block',
  name: 'Image Block',
  version: '0.1.0',
  section_types: [],
  component: EmdImageBlock,
  toolbar: [
    { id: 'image-fit', label: 'Fit', icon: '↔', action: () => {} },
    { id: 'image-small', label: 'Small', icon: 'S', action: () => {} },
    { id: 'image-medium', label: 'Medium', icon: 'M', action: () => {} },
    { id: 'image-large', label: 'Large', icon: 'L', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdImageBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdImageBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(imageBlockPlugin);

export { IMAGE_BLOCK_TAG, imageBlockPlugin };
