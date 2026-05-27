import { registerBlockPlugin } from '@core/plugin-api';
import { CodeBlockTag } from '@core/types';
import type { BlockPlugin, Block } from '@core/types';

const MEDIA_BLOCK_TAG = 'emd-media-block';

export class EmdMediaBlock extends HTMLElement {
  private block: Block | null = null;
  private container: HTMLElement | null = null;

  setBlock(block: Block): void {
    this.block = block;
    this.render();
  }

  connectedCallback(): void {
    this.classList.add('emd-block-media');
    this.render();
  }

  private render(): void {
    if (!this.block) return;

    this.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'emd-media-toolbar';
    toolbar.innerHTML = `
      <span class="emd-media-type">Media Block</span>
      <div class="emd-media-actions">
        <button data-action="play" title="Play">▶</button>
        <button data-action="pause" title="Pause">⏸</button>
        <button data-action="fullscreen" title="Fullscreen">⛶</button>
      </div>
    `;
    this.appendChild(toolbar);

    this.container = document.createElement('div');
    this.container.className = 'emd-media-content';
    this.appendChild(this.container);

    toolbar.querySelector('[data-action="play"]')?.addEventListener('click', () => {
      const media = this.container?.querySelector('video,audio') as HTMLMediaElement | null;
      media?.play();
    });

    toolbar.querySelector('[data-action="pause"]')?.addEventListener('click', () => {
      const media = this.container?.querySelector('video,audio') as HTMLMediaElement | null;
      media?.pause();
    });

    toolbar.querySelector('[data-action="fullscreen"]')?.addEventListener('click', () => {
      const el = this.container?.querySelector('video') ?? this.container;
      el?.requestFullscreen?.();
    });

    this.renderContent();
  }

  private renderContent(): void {
    if (!this.block?.section || !this.container) return;

    let srcUrl = '';
    for (const el of this.block.section.content) {
      if ('Text' in el && el.Text) {
        const trimmed = el.Text.trim();
        if (trimmed) {
          srcUrl = trimmed;
          break;
        }
      }
      if ('Paragraph' in el && el.Paragraph) {
        srcUrl = el.Paragraph.trim();
        break;
      }
    }

    if (!srcUrl && this.block.section.content.length > 0) {
      const first = this.block.section.content[0]!;
      if ('CodeBlock' in first && first.CodeBlock) {
        srcUrl = first.CodeBlock.content.trim();
      }
    }

    if (!srcUrl) {
      this.container.innerHTML =
        '<div class="emd-media-placeholder">Enter a media URL in the block content (video, audio, YouTube, or Vimeo link)</div>';
      return;
    }

    const ytMatch = srcUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
    );
    if (ytMatch) {
      const videoId = ytMatch[1]!;
      const wrapper = document.createElement('div');
      wrapper.className = 'emd-media-embed-wrapper';
      wrapper.innerHTML = `
        <iframe
          src="https://www.youtube-nocookie.com/embed/${videoId}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      `;
      this.container.appendChild(wrapper);
      return;
    }

    const vimeoMatch = srcUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1]!;
      const wrapper = document.createElement('div');
      wrapper.className = 'emd-media-embed-wrapper';
      wrapper.innerHTML = `
        <iframe
          src="https://player.vimeo.com/video/${videoId}?dnt=1"
          frameborder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
        ></iframe>
      `;
      this.container.appendChild(wrapper);
      return;
    }

    if (srcUrl.startsWith('data:audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/i.test(srcUrl)) {
      let sizeWarning = '';
      if (srcUrl.startsWith('data:audio/')) {
        const base64Len = srcUrl.split(',')[1]?.length ?? 0;
        const sizeMB = (base64Len * 0.75) / (1024 * 1024);
        if (sizeMB > 5) {
          sizeWarning = `<div class="emd-media-size-warning">Large base64 audio (${sizeMB.toFixed(1)}MB). Consider hosting externally.</div>`;
        }
      }
      this.container.innerHTML = `${sizeWarning}
        <audio controls style="width:100%">
          <source src="${this.escapeAttr(srcUrl)}" />
          Your browser does not support audio playback.
        </audio>`;
      return;
    }

    if (srcUrl.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|mkv)(\?|$)/i.test(srcUrl)) {
      let sizeWarning = '';
      if (srcUrl.startsWith('data:video/')) {
        const base64Len = srcUrl.split(',')[1]?.length ?? 0;
        const sizeMB = (base64Len * 0.75) / (1024 * 1024);
        if (sizeMB > 10) {
          sizeWarning = `<div class="emd-media-size-warning">Large base64 video (${sizeMB.toFixed(1)}MB). Consider hosting externally.</div>`;
        }
      }
      this.container.innerHTML = `${sizeWarning}
        <video controls style="max-width:100%">
          <source src="${this.escapeAttr(srcUrl)}" />
          Your browser does not support video playback.
        </video>`;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'emd-media-embed-wrapper';
    wrapper.innerHTML = `
      <iframe
        src="${this.escapeAttr(srcUrl)}"
        frameborder="0"
        allowfullscreen
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      ></iframe>
    `;
    this.container.appendChild(wrapper);
  }

  private escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

if (!customElements.get(MEDIA_BLOCK_TAG)) {
  customElements.define(MEDIA_BLOCK_TAG, EmdMediaBlock);
}

export const mediaBlockPlugin: BlockPlugin = {
  id: 'media-block',
  name: 'Media Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Media],
  component: EmdMediaBlock,
  onMount(block: Block, element: HTMLElement): void {
    if (element instanceof EmdMediaBlock) {
      element.setBlock(block);
    }
  },
  onUpdate(block: Block, element: HTMLElement): void {
    if (element instanceof EmdMediaBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(mediaBlockPlugin);

export { MEDIA_BLOCK_TAG };
