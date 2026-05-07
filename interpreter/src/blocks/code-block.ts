import { Block, BlockPlugin, CodeBlockTag, getCodeBlockContent, getCodeBlockContentAndTag } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const CODE_BLOCK_TAG = 'emd-code-block';

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript', ts: 'TypeScript', py: 'Python', rs: 'Rust',
  go: 'Go', java: 'Java', cpp: 'C++', c: 'C', cs: 'C#',
  rb: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
  scala: 'Scala', r: 'R', sql: 'SQL', sh: 'Shell', bash: 'Bash',
  yaml: 'YAML', json: 'JSON', xml: 'XML', html: 'HTML', css: 'CSS',
  md: 'Markdown', graphql: 'GraphQL', dockerfile: 'Dockerfile',
  toml: 'TOML', ini: 'INI', lua: 'Lua', elixir: 'Elixir',
  erlang: 'Erlang', haskell: 'Haskell', ocaml: 'OCaml',
  zig: 'Zig', nim: 'Nim', dart: 'Dart',
};

const TAG_LANGUAGES: Record<string, string> = {
  snippet: 'ts', verify: 'ts', example: 'ts', schema: 'json',
  prompt: 'md', draw: 'js', kanban: 'js',
};

export class EmdCodeBlock extends HTMLElement {
  private blockData: Block | null = null;
  private header!: HTMLElement;
  private codeEl!: HTMLElement;
  private previewEl!: HTMLElement | null;
  private langSelect!: HTMLSelectElement;
  private copyBtn!: HTMLButtonElement;
  private toggleBtn!: HTMLButtonElement;
  private showPreview = false;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-code');
    this.innerHTML = `
      <div class="emd-code-header">
        <select class="emd-code-lang-select"></select>
        <div class="emd-code-actions">
          <button class="emd-code-toggle-btn" title="Toggle Preview">◐</button>
          <button class="emd-code-copy-btn" title="Copy">⎘</button>
        </div>
      </div>
      <pre class="emd-code-content"><code></code></pre>
      <div class="emd-code-preview" style="display:none"></div>
    `;

    this.header = this.querySelector('.emd-code-header')!;
    this.codeEl = this.querySelector('.emd-code-content code')!;
    this.previewEl = this.querySelector('.emd-code-preview');
    this.langSelect = this.querySelector('.emd-code-lang-select')!;
    this.copyBtn = this.querySelector('.emd-code-copy-btn')!;
    this.toggleBtn = this.querySelector('.emd-code-toggle-btn')!;

    this.langSelect.innerHTML = Object.entries(LANGUAGE_NAMES)
      .map(([key, name]) => `<option value="${key}">${name}</option>`)
      .join('');

    this.langSelect.addEventListener('change', () => {
      this.codeEl.className = `language-${this.langSelect.value}`;
    });

    this.copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.getContent()).catch(console.error);
      this.copyBtn.textContent = '✓';
      setTimeout(() => { this.copyBtn.textContent = '⎘'; }, 1500);
    });

    this.toggleBtn.addEventListener('click', () => {
      this.showPreview = !this.showPreview;
      this.codeEl.parentElement!.style.display = this.showPreview ? 'none' : '';
      if (this.previewEl) {
        this.previewEl.style.display = this.showPreview ? '' : 'none';
      }
    });
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);

    const codeContent = block.section ? getCodeBlockContent(block.section.content) ?? '' : '';
    const codeTag = block.section ? getCodeBlockContentAndTag(block.section.content)?.tag : undefined;

    const langKey = codeTag ? (TAG_LANGUAGES[codeTag] ?? 'md') : 'md';
    this.langSelect.value = langKey;
    this.codeEl.className = `language-${langKey}`;
    this.codeEl.textContent = codeContent;

    this.toggleBtn.style.display = codeTag ? '' : 'none';
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  getContent(): string {
    return this.codeEl.textContent ?? '';
  }

  setContent(content: string): void {
    this.codeEl.textContent = content;
  }
}

if (!customElements.get(CODE_BLOCK_TAG)) {
  customElements.define(CODE_BLOCK_TAG, EmdCodeBlock);
}

const codeBlockPlugin: BlockPlugin = {
  id: 'code-block',
  name: 'Code Block',
  version: '0.1.0',
  code_block_tags: Object.values(CodeBlockTag),
  component: EmdCodeBlock,
  toolbar: [
    { id: 'code-copy', label: 'Copy', icon: '⎘', action: () => {} },
    { id: 'code-toggle', label: 'Preview', icon: '◐', action: () => {} },
    { id: 'code-expand', label: 'Expand', icon: '⤢', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdCodeBlock) {
      element.setBlock(block);
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdCodeBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(codeBlockPlugin);

export { CODE_BLOCK_TAG, codeBlockPlugin };
