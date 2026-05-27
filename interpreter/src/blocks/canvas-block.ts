import { Block, BlockPlugin, CodeBlockTag, getCodeBlockContent } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const CANVAS_BLOCK_TAG = 'emd-canvas-block';

interface Point {
  x: number;
  y: number;
}

interface DrawCommand {
  type: 'freehand' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'eraser';
  points?: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  radius?: number;
  text?: string;
  strokeColor?: string;
  fillColor?: string;
  lineWidth?: number;
  opacity?: number;
  fontSize?: number;
}

interface CanvasData {
  version: number;
  width: number;
  height: number;
  commands: DrawCommand[];
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  gridSize: number;
}

type ToolType = 'freehand' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'eraser';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 500;
const MAX_UNDO = 100;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ALIGN_THRESHOLD = 5;

export class EmdCanvasBlock extends HTMLElement {
  private blockData: Block | null = null;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private commands: DrawCommand[] = [];
  private undoStack: DrawCommand[][] = [];
  private redoStack: DrawCommand[][] = [];
  private currentTool: ToolType = 'freehand';
  private isDrawing = false;
  private startPoint: Point | null = null;
  private currentStroke: DrawCommand | null = null;
  private freehandPoints: Point[] = [];

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private panStart: Point | null = null;
  private spaceHeld = false;
  private middleHeld = false;

  private gridEnabled = false;
  private gridSize = 20;

  private strokeColor = '#000000';
  private fillColor = '#ffffff';
  private lineWidth = 3;
  private opacity = 1;
  private fontSize = 16;

  private canvasWidth = DEFAULT_WIDTH;
  private canvasHeight = DEFAULT_HEIGHT;

  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;

  private alignGuideX: number | null = null;
  private alignGuideY: number | null = null;

  private toolbar!: HTMLElement;
  private statusBar!: HTMLElement;
  private zoomBadge!: HTMLElement;
  private resizeHandle!: HTMLElement;
  private canvasContainer!: HTMLElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private gridToggleBtn!: HTMLButtonElement;
  private coordsLabel!: HTMLElement;
  private zoomLabel!: HTMLElement;
  private gridLabel!: HTMLElement;
  private domReady = false;

  connectedCallback(): void {
    if (this.domReady) return;
    this.classList.add('emd-block', 'emd-block-canvas');
    this.setAttribute('tabindex', '0');

    this.innerHTML = `
      <div class="emd-canvas-toolbar">
        <button class="emd-canvas-tool emd-canvas-tool-active" data-tool="freehand" title="Freehand (F)">\u2710</button>
        <button class="emd-canvas-tool" data-tool="rect" title="Rectangle (R)">\u25a1</button>
        <button class="emd-canvas-tool" data-tool="circle" title="Circle (C)">\u25cb</button>
        <button class="emd-canvas-tool" data-tool="line" title="Line (L)">\u2571</button>
        <button class="emd-canvas-tool" data-tool="arrow" title="Arrow (A)">\u2192</button>
        <button class="emd-canvas-tool" data-tool="text" title="Text (T)">T</button>
        <button class="emd-canvas-tool" data-tool="eraser" title="Eraser (E)">\u232b</button>
        <span class="emd-canvas-sep"></span>
        <label class="emd-canvas-color-label" title="Stroke Color">
          <input type="color" class="emd-canvas-stroke-color" value="#000000">
        </label>
        <label class="emd-canvas-color-label" title="Fill Color">
          <input type="color" class="emd-canvas-fill-color" value="#ffffff">
        </label>
        <span class="emd-canvas-sep"></span>
        <input type="range" class="emd-canvas-line-width" min="1" max="20" value="3" title="Line Width">
        <span class="emd-canvas-width-display">3px</span>
        <input type="range" class="emd-canvas-opacity" min="0.1" max="1" step="0.1" value="1" title="Opacity">
        <span class="emd-canvas-sep"></span>
        <button class="emd-canvas-grid-toggle" title="Toggle Grid (G)">\u229e</button>
        <select class="emd-canvas-grid-size">
          <option value="10">10px</option>
          <option value="20" selected>20px</option>
          <option value="50">50px</option>
        </select>
        <span class="emd-canvas-sep"></span>
        <button class="emd-canvas-undo" title="Undo (Ctrl+Z)" disabled>\u21a9</button>
        <button class="emd-canvas-redo" title="Redo (Ctrl+Shift+Z)" disabled>\u21aa</button>
        <button class="emd-canvas-clear" title="Clear All">\u2715</button>
        <span class="emd-canvas-sep"></span>
        <button class="emd-canvas-export-png" title="Export PNG">PNG</button>
        <button class="emd-canvas-export-svg" title="Export SVG">SVG</button>
        <button class="emd-canvas-export-exc" title="Export Excalidraw JSON">EXC</button>
      </div>
      <div class="emd-canvas-container">
        <canvas class="emd-canvas-element"></canvas>
        <div class="emd-canvas-zoom-badge">100%</div>
        <div class="emd-canvas-resize-handle" title="Drag to resize"></div>
      </div>
      <div class="emd-canvas-status-bar">
        <span class="emd-canvas-coords">x: 0 y: 0</span>
        <span class="emd-canvas-status-tool">Freehand</span>
        <span class="emd-canvas-zoom-label">100%</span>
        <span class="emd-canvas-grid-label">Grid: Off</span>
      </div>
    `;

    this.toolbar = this.querySelector('.emd-canvas-toolbar')!;
    this.canvasContainer = this.querySelector('.emd-canvas-container')!;
    this.canvas = this.querySelector('.emd-canvas-element')!;
    this.zoomBadge = this.querySelector('.emd-canvas-zoom-badge')!;
    this.resizeHandle = this.querySelector('.emd-canvas-resize-handle')!;
    this.statusBar = this.querySelector('.emd-canvas-status-bar')!;
    this.undoBtn = this.querySelector('.emd-canvas-undo')!;
    this.redoBtn = this.querySelector('.emd-canvas-redo')!;
    this.gridToggleBtn = this.querySelector('.emd-canvas-grid-toggle')!;
    this.coordsLabel = this.querySelector('.emd-canvas-coords')!;
    this.zoomLabel = this.querySelector('.emd-canvas-zoom-label')!;
    this.gridLabel = this.querySelector('.emd-canvas-grid-label')!;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      this.innerHTML = '<div class="emd-canvas-error">Canvas 2D context not available</div>';
      return;
    }
    this.ctx = ctx;
    this.setCanvasSize(this.canvasWidth, this.canvasHeight);

    this.bindToolbar();
    this.bindCanvasEvents();
    this.bindKeyboard();
    this.bindResizeHandle();
    this.domReady = true;
    this.render();
  }

  disconnectedCallback(): void {
    this.domReady = false;
    this.cleanupTextInput();
  }

  setBlock(block: Block): void {
    this.blockData = block;
    this.setAttribute('data-block-id', block.id);
  }

  getBlock(): Block | null {
    return this.blockData;
  }

  loadContent(json: string): void {
    try {
      const data: CanvasData = JSON.parse(json);
      if (data.version === 1 && Array.isArray(data.commands)) {
        this.canvasWidth = data.width || DEFAULT_WIDTH;
        this.canvasHeight = data.height || DEFAULT_HEIGHT;
        this.commands = data.commands;
        this.zoom = data.zoom || 1;
        this.panX = data.panX || 0;
        this.panY = data.panY || 0;
        this.gridEnabled = data.gridEnabled || false;
        this.gridSize = data.gridSize || 20;
        if (this.domReady) {
          this.setCanvasSize(this.canvasWidth, this.canvasHeight);
          this.updateGridUI();
          this.updateZoomBadge();
          this.render();
        }
      }
    } catch {
      this.clearAll();
    }
  }

  serialize(): string {
    const data: CanvasData = {
      version: 1,
      width: this.canvasWidth,
      height: this.canvasHeight,
      commands: this.commands,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      gridEnabled: this.gridEnabled,
      gridSize: this.gridSize,
    };
    return JSON.stringify(data, null, 2);
  }

  // --- Toolbar ---

  private currentTextInput: HTMLInputElement | null = null;

  private bindToolbar(): void {
    this.toolbar.querySelectorAll('.emd-canvas-tool').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset['tool'] as ToolType;
        if (tool) this.selectTool(tool);
      });
    });

    this.querySelector('.emd-canvas-stroke-color')!.addEventListener('input', (e) => {
      this.strokeColor = (e.target as HTMLInputElement).value;
    });

    this.querySelector('.emd-canvas-fill-color')!.addEventListener('input', (e) => {
      this.fillColor = (e.target as HTMLInputElement).value;
    });

    const lwInput = this.querySelector('.emd-canvas-line-width')! as HTMLInputElement;
    lwInput.addEventListener('input', () => {
      this.lineWidth = parseInt(lwInput.value, 10);
      this.querySelector('.emd-canvas-width-display')!.textContent = `${this.lineWidth}px`;
    });

    const opacityInput = this.querySelector('.emd-canvas-opacity')! as HTMLInputElement;
    opacityInput.addEventListener('input', () => {
      this.opacity = parseFloat(opacityInput.value);
    });

    this.gridToggleBtn.addEventListener('click', () => this.toggleGrid());
    this.querySelector('.emd-canvas-grid-size')!.addEventListener('change', (e) => {
      this.gridSize = parseInt((e.target as HTMLSelectElement).value, 10);
      if (this.gridEnabled) this.render();
    });

    this.undoBtn.addEventListener('click', () => this.undo());
    this.redoBtn.addEventListener('click', () => this.redo());
    this.querySelector('.emd-canvas-clear')!.addEventListener('click', () => this.clearAll());

    this.querySelector('.emd-canvas-export-png')!.addEventListener('click', () => this.exportPNG());
    this.querySelector('.emd-canvas-export-svg')!.addEventListener('click', () => this.exportSVG());
    this.querySelector('.emd-canvas-export-exc')!.addEventListener('click', () => this.exportExcalidraw());
  }

  private selectTool(tool: ToolType): void {
    this.cleanupTextInput();
    this.currentTool = tool;
    this.toolbar.querySelectorAll('.emd-canvas-tool').forEach((btn) => {
      btn.classList.toggle('emd-canvas-tool-active', (btn as HTMLElement).dataset['tool'] === tool);
    });
    this.querySelector('.emd-canvas-status-tool')!.textContent =
      tool.charAt(0).toUpperCase() + tool.slice(1);
    this.canvas.style.cursor = tool === 'eraser' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair';
  }

  // --- Canvas Events ---

  private bindCanvasEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 1) {
      this.middleHeld = true;
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 2 || this.middleHeld) return;

    if (this.spaceHeld) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const pt = this.screenToCanvas(e.clientX, e.clientY);

    if (this.currentTool === 'text') {
      this.cleanupTextInput();
      this.showTextInput(pt);
      return;
    }

    this.isDrawing = true;
    this.startPoint = pt;
    this.freehandPoints = [pt];

    this.currentStroke = {
      type: this.currentTool,
      strokeColor: this.strokeColor,
      fillColor: this.currentTool === 'circle' || this.currentTool === 'rect' ? this.fillColor : undefined,
      lineWidth: this.lineWidth,
      opacity: this.opacity,
    };

    if (this.currentTool === 'freehand' || this.currentTool === 'eraser') {
      this.currentStroke.points = [pt];
    }

    this.canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    const pt = this.screenToCanvas(e.clientX, e.clientY);
    this.coordsLabel.textContent = `x: ${Math.round(pt.x)} y: ${Math.round(pt.y)}`;

    if (this.isPanning && this.panStart) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.panX += dx;
      this.panY += dy;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.render();
      return;
    }

    if (!this.isDrawing || !this.currentStroke) return;

    if (this.currentTool === 'freehand' || this.currentTool === 'eraser') {
      this.freehandPoints.push(pt);
      this.currentStroke.points = [...this.freehandPoints];
      this.render();
      this.drawCurrentStroke(ctx => {
        this.drawFreehandPath(ctx, this.freehandPoints, this.currentStroke!);
      });
    } else {
      const snapped = this.snapToAlignment(pt);
      this.currentStroke.x = this.startPoint!.x;
      this.currentStroke.y = this.startPoint!.y;
      this.currentStroke.width = snapped.x - this.startPoint!.x;
      this.currentStroke.height = snapped.y - this.startPoint!.y;
      if (this.currentTool === 'line' || this.currentTool === 'arrow') {
        this.currentStroke.x2 = snapped.x;
        this.currentStroke.y2 = snapped.y;
      } else if (this.currentTool === 'circle') {
        this.currentStroke.radius = Math.sqrt(
          (snapped.x - this.startPoint!.x) ** 2 + (snapped.y - this.startPoint!.y) ** 2
        );
      }
      this.render();
      this.drawCurrentStroke(ctx => {
        this.drawShape(ctx, this.currentStroke!);
      });
      this.drawAlignmentGuides(this.ctx, snapped);
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.panStart = null;
      return;
    }

    if (!this.isDrawing || !this.currentStroke) return;
    this.isDrawing = false;

    const stroke = { ...this.currentStroke };

    if (this.currentTool === 'freehand' || this.currentTool === 'eraser') {
      stroke.points = [...this.freehandPoints];
      if (stroke.points.length < 2) {
        this.currentStroke = null;
        this.render();
        return;
      }
    }

    this.pushUndoState();
    this.commands.push(stroke);
    this.redoStack = [];
    this.currentStroke = null;
    this.updateUndoRedoButtons();
    this.render();
  }

  private onWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.005;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta));
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const ratio = newZoom / this.zoom;
      this.panX = mx - ratio * (mx - this.panX);
      this.panY = my - ratio * (my - this.panY);
      this.zoom = newZoom;
      this.updateZoomBadge();
      this.render();
    } else {
      e.preventDefault();
      this.panX -= e.deltaX;
      this.panY -= e.deltaY;
      this.render();
    }
  }

  // --- Keyboard ---

  private bindKeyboard(): void {
    this.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' && !this.spaceHeld && !this.isDrawing) {
        e.preventDefault();
        this.spaceHeld = true;
        this.canvas.style.cursor = 'grab';
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      }

      if (!e.ctrlKey && !e.metaKey && !this.isDrawing) {
        const toolMap: Record<string, ToolType> = {
          f: 'freehand', r: 'rect', c: 'circle', l: 'line',
          a: 'arrow', t: 'text', e: 'eraser',
        };
        const tool = toolMap[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          this.selectTool(tool);
        }
      }

      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !this.isDrawing) {
        e.preventDefault();
        this.toggleGrid();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.cleanupTextInput();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === ' ') {
        this.spaceHeld = false;
        if (!this.middleHeld) {
          this.canvas.style.cursor = this.currentTool === 'eraser' ? 'crosshair' : this.currentTool === 'text' ? 'text' : 'crosshair';
        }
      }
    });
  }

  // --- Resize Handle ---

  private bindResizeHandle(): void {
    this.resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      this.resizeStartW = this.canvasWidth;
      this.resizeStartH = this.canvasHeight;
      this.resizeHandle.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isResizing) return;
      const dx = e.clientX - this.resizeStartX;
      const dy = e.clientY - this.resizeStartY;
      this.canvasWidth = Math.max(100, this.resizeStartW + dx);
      this.canvasHeight = Math.max(100, this.resizeStartH + dy);
      this.setCanvasSize(this.canvasWidth, this.canvasHeight);
      this.render();
    });

    window.addEventListener('pointerup', () => {
      this.isResizing = false;
    });
  }

  // --- Grid & Alignment ---

  private toggleGrid(): void {
    this.gridEnabled = !this.gridEnabled;
    this.updateGridUI();
    this.render();
  }

  private updateGridUI(): void {
    this.gridToggleBtn.classList.toggle('emd-canvas-grid-active', this.gridEnabled);
    this.gridLabel.textContent = `Grid: ${this.gridEnabled ? 'On' : 'Off'}`;
    this.querySelector('.emd-canvas-grid-size')!.setAttribute('value', String(this.gridSize));
  }

  private snapToGrid(pt: Point): Point {
    if (!this.gridEnabled) return pt;
    return {
      x: Math.round(pt.x / this.gridSize) * this.gridSize,
      y: Math.round(pt.y / this.gridSize) * this.gridSize,
    };
  }

  private snapToAlignment(pt: Point): Point {
    let snapped = this.snapToGrid({ ...pt });
    this.alignGuideX = null;
    this.alignGuideY = null;

    for (const cmd of this.commands) {
      const edges = this.getCommandEdges(cmd);
      for (const edge of edges) {
        if (edge !== undefined) {
          if (Math.abs(snapped.x - edge) < ALIGN_THRESHOLD / this.zoom) {
            snapped.x = edge;
            this.alignGuideX = edge;
          }
          if (Math.abs(snapped.y - edge) < ALIGN_THRESHOLD / this.zoom) {
            snapped.y = edge;
            this.alignGuideY = edge;
          }
          if (cmd.type === 'circle' && cmd.radius !== undefined) {
            const cx = (cmd.x ?? 0) + cmd.radius;
            const cy = (cmd.y ?? 0) + cmd.radius;
            if (Math.abs(snapped.x - cx) < ALIGN_THRESHOLD / this.zoom) {
              snapped.x = cx;
              this.alignGuideX = cx;
            }
            if (Math.abs(snapped.y - cy) < ALIGN_THRESHOLD / this.zoom) {
              snapped.y = cy;
              this.alignGuideY = cy;
            }
          }
        }
      }
    }

    return snapped;
  }

  private getCommandEdges(cmd: DrawCommand): number[] {
    const edges: number[] = [];
    if (cmd.type === 'rect') {
      edges.push(cmd.x ?? 0, cmd.y ?? 0, (cmd.x ?? 0) + (cmd.width ?? 0), (cmd.y ?? 0) + (cmd.height ?? 0));
    } else if (cmd.type === 'circle' && cmd.radius !== undefined) {
      const cx = (cmd.x ?? 0) + cmd.radius;
      const cy = (cmd.y ?? 0) + cmd.radius;
      edges.push(cmd.x ?? 0, cmd.y ?? 0, cx, cy, (cmd.x ?? 0) + cmd.radius * 2, (cmd.y ?? 0) + cmd.radius * 2);
    } else if (cmd.type === 'line' || cmd.type === 'arrow') {
      edges.push(cmd.x ?? 0, cmd.y ?? 0, cmd.x2 ?? 0, cmd.y2 ?? 0);
    }
    return edges;
  }

  private drawAlignmentGuides(ctx: CanvasRenderingContext2D, pt: Point): void {
    if (!this.alignGuideX && !this.alignGuideY) return;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    if (this.alignGuideX !== null) {
      ctx.beginPath();
      ctx.moveTo(this.alignGuideX, 0);
      ctx.lineTo(this.alignGuideX, h);
      ctx.stroke();
    }
    if (this.alignGuideY !== null) {
      ctx.beginPath();
      ctx.moveTo(0, this.alignGuideY);
      ctx.lineTo(w, this.alignGuideY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Drawing ---

  private setCanvasSize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvasWidth = w;
    this.canvasHeight = h;
  }

  private screenToCanvas(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top - this.panY) / this.zoom,
    };
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.panX, this.panY);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (this.gridEnabled) {
      this.drawGrid(ctx, w, h);
    }

    for (const cmd of this.commands) {
      this.drawShape(ctx, cmd);
    }

    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gs = this.gridSize;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let x = 0; x <= w; x += gs) {
      for (let y = 0; y <= h; y += gs) {
        ctx.beginPath();
        ctx.arc(x, y, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCurrentStroke(drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.panX, this.panY);
    drawFn(ctx);
    ctx.restore();
  }

  private drawShape(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
    ctx.save();
    ctx.globalAlpha = cmd.opacity ?? 1;
    ctx.strokeStyle = cmd.strokeColor ?? '#000000';
    ctx.lineWidth = cmd.lineWidth ?? 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = cmd.fillColor ?? 'transparent';

    if (cmd.type === 'freehand') {
      ctx.fillStyle = 'transparent';
      this.drawFreehandPath(ctx, cmd.points ?? [], cmd);
    } else if (cmd.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      this.drawFreehandPath(ctx, cmd.points ?? [], cmd);
    } else if (cmd.type === 'rect') {
      if (cmd.fillColor && cmd.fillColor !== 'transparent') {
        ctx.fillRect(cmd.x ?? 0, cmd.y ?? 0, cmd.width ?? 0, cmd.height ?? 0);
      }
      ctx.strokeRect(cmd.x ?? 0, cmd.y ?? 0, cmd.width ?? 0, cmd.height ?? 0);
    } else if (cmd.type === 'circle') {
      ctx.beginPath();
      ctx.arc((cmd.x ?? 0) + (cmd.radius ?? 0), (cmd.y ?? 0) + (cmd.radius ?? 0), cmd.radius ?? 0, 0, Math.PI * 2);
      if (cmd.fillColor && cmd.fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
    } else if (cmd.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(cmd.x ?? 0, cmd.y ?? 0);
      ctx.lineTo(cmd.x2 ?? 0, cmd.y2 ?? 0);
      ctx.stroke();
    } else if (cmd.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(cmd.x ?? 0, cmd.y ?? 0);
      ctx.lineTo(cmd.x2 ?? 0, cmd.y2 ?? 0);
      ctx.stroke();
      this.drawArrowhead(ctx, cmd.x ?? 0, cmd.y ?? 0, cmd.x2 ?? 0, cmd.y2 ?? 0, cmd.lineWidth ?? 3);
    } else if (cmd.type === 'text' && cmd.text) {
      ctx.font = `${cmd.fontSize ?? 16}px var(--emd-font, sans-serif)`;
      ctx.fillStyle = cmd.strokeColor ?? '#000000';
      ctx.fillText(cmd.text, cmd.x ?? 0, (cmd.y ?? 0) + (cmd.fontSize ?? 16));
    }

    ctx.restore();
  }

  private drawFreehandPath(ctx: CanvasRenderingContext2D, points: Point[], _cmd: DrawCommand): void {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]!;
      const p1 = points[i]!;
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
    ctx.lineTo(points[points.length - 1]!.x, points[points.length - 1]!.y);
    ctx.stroke();
  }

  private drawArrowhead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lw: number): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = lw * 3;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  // --- Text Input ---

  private showTextInput(pt: Point): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'emd-canvas-text-input';
    input.style.position = 'absolute';
    input.style.left = `${pt.x * this.zoom + this.panX}px`;
    input.style.top = `${pt.y * this.zoom + this.panY}px`;
    input.style.fontSize = `${this.fontSize * this.zoom}px`;
    input.style.color = this.strokeColor;
    input.style.zIndex = '10';
    this.canvasContainer.appendChild(input);
    input.focus();
    this.currentTextInput = input;

    const commit = () => {
      const text = input.value.trim();
      if (text) {
        this.pushUndoState();
        this.commands.push({
          type: 'text',
          x: pt.x,
          y: pt.y,
          text,
          strokeColor: this.strokeColor,
          fontSize: this.fontSize,
        });
        this.redoStack = [];
        this.updateUndoRedoButtons();
        this.render();
      }
      this.cleanupTextInput();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { this.cleanupTextInput(); }
    });
  }

  private cleanupTextInput(): void {
    if (this.currentTextInput) {
      this.currentTextInput.remove();
      this.currentTextInput = null;
    }
  }

  // --- Undo / Redo ---

  private pushUndoState(): void {
    this.undoStack.push([...this.commands]);
    if (this.undoStack.length > MAX_UNDO) {
      this.undoStack.shift();
    }
  }

  undo(): void {
    const snapshot = this.undoStack.pop();
    if (snapshot === undefined) return;
    this.redoStack.push([...this.commands]);
    this.commands = snapshot;
    this.updateUndoRedoButtons();
    this.render();
  }

  redo(): void {
    const snapshot = this.redoStack.pop();
    if (snapshot === undefined) return;
    this.undoStack.push([...this.commands]);
    this.commands = snapshot;
    this.updateUndoRedoButtons();
    this.render();
  }

  clearAll(): void {
    if (this.commands.length === 0) return;
    this.pushUndoState();
    this.commands = [];
    this.redoStack = [];
    this.updateUndoRedoButtons();
    this.render();
  }

  private updateUndoRedoButtons(): void {
    this.undoBtn.disabled = this.undoStack.length === 0;
    this.redoBtn.disabled = this.redoStack.length === 0;
  }

  // --- Zoom ---

  private updateZoomBadge(): void {
    const pct = Math.round(this.zoom * 100);
    this.zoomBadge.textContent = `${pct}%`;
    this.zoomLabel.textContent = `${pct}%`;
  }

  // --- Export ---

  exportPNG(): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    const ctx = canvas.getContext('2d')!;
    this.drawToContext(ctx);
    canvas.toBlob((blob) => {
      if (blob) this.download(blob, 'drawing.png');
    }, 'image/png');
  }

  exportSVG(): void {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvasWidth}" height="${this.canvasHeight}" viewBox="0 0 ${this.canvasWidth} ${this.canvasHeight}">\n`;
    svg += `  <rect width="100%" height="100%" fill="white"/>\n`;

    for (const cmd of this.commands) {
      svg += this.commandToSVG(cmd);
    }

    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    this.download(blob, 'drawing.svg');
  }

  private commandToSVG(cmd: DrawCommand): string {
    const alpha = cmd.opacity ?? 1;
    const sc = cmd.strokeColor ?? '#000000';
    const fc = cmd.fillColor ?? 'none';
    const lw = cmd.lineWidth ?? 3;

    switch (cmd.type) {
      case 'freehand': {
        if (!cmd.points || cmd.points.length < 2) return '';
        let d = `M ${cmd.points[0]!.x} ${cmd.points[0]!.y}`;
        for (let i = 1; i < cmd.points.length; i++) {
          d += ` L ${cmd.points[i]!.x} ${cmd.points[i]!.y}`;
        }
        return `  <path d="${d}" fill="none" stroke="${sc}" stroke-width="${lw}" opacity="${alpha}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
      }
      case 'rect':
        return `  <rect x="${cmd.x ?? 0}" y="${cmd.y ?? 0}" width="${cmd.width ?? 0}" height="${cmd.height ?? 0}" fill="${fc}" stroke="${sc}" stroke-width="${lw}" opacity="${alpha}"/>\n`;
      case 'circle':
        return `  <circle cx="${(cmd.x ?? 0) + (cmd.radius ?? 0)}" cy="${(cmd.y ?? 0) + (cmd.radius ?? 0)}" r="${cmd.radius ?? 0}" fill="${fc}" stroke="${sc}" stroke-width="${lw}" opacity="${alpha}"/>\n`;
      case 'line':
        return `  <line x1="${cmd.x ?? 0}" y1="${cmd.y ?? 0}" x2="${cmd.x2 ?? 0}" y2="${cmd.y2 ?? 0}" stroke="${sc}" stroke-width="${lw}" opacity="${alpha}" stroke-linecap="round"/>\n`;
      case 'arrow': {
        const aSize = lw * 3;
        const angle = Math.atan2((cmd.y2 ?? 0) - (cmd.y ?? 0), (cmd.x2 ?? 0) - (cmd.x ?? 0));
        const ax1 = (cmd.x2 ?? 0) - aSize * Math.cos(angle - Math.PI / 6);
        const ay1 = (cmd.y2 ?? 0) - aSize * Math.sin(angle - Math.PI / 6);
        const ax2 = (cmd.x2 ?? 0) - aSize * Math.cos(angle + Math.PI / 6);
        const ay2 = (cmd.y2 ?? 0) - aSize * Math.sin(angle + Math.PI / 6);
        return `  <line x1="${cmd.x ?? 0}" y1="${cmd.y ?? 0}" x2="${cmd.x2 ?? 0}" y2="${cmd.y2 ?? 0}" stroke="${sc}" stroke-width="${lw}" opacity="${alpha}" stroke-linecap="round"/>\n` +
               `  <polygon points="${cmd.x2 ?? 0},${cmd.y2 ?? 0} ${ax1},${ay1} ${ax2},${ay2}" fill="${sc}" opacity="${alpha}"/>\n`;
      }
      case 'text':
        return `  <text x="${cmd.x ?? 0}" y="${(cmd.y ?? 0) + (cmd.fontSize ?? 16)}" fill="${sc}" font-size="${cmd.fontSize ?? 16}" font-family="sans-serif" opacity="${alpha}">${this.escapeXml(cmd.text ?? '')}</text>\n`;
      case 'eraser': {
        if (!cmd.points || cmd.points.length < 2) return '';
        let d = `M ${cmd.points[0]!.x} ${cmd.points[0]!.y}`;
        for (let i = 1; i < cmd.points.length; i++) {
          d += ` L ${cmd.points[i]!.x} ${cmd.points[i]!.y}`;
        }
        return `  <path d="${d}" fill="none" stroke="white" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
      }
      default:
        return '';
    }
  }

  private escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  exportExcalidraw(): void {
    const elements: Record<string, unknown>[] = [];
    for (const cmd of this.commands) {
      const el = this.commandToExcalidraw(cmd);
      if (el) elements.push(el);
    }
    const json = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'https://everthink.co',
      elements,
      appState: { viewBackgroundColor: '#ffffff' },
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    this.download(blob, 'drawing.excalidraw');
  }

  private commandToExcalidraw(cmd: DrawCommand): Record<string, unknown> | null {
    const base = {
      strokeColor: cmd.strokeColor ?? '#000000',
      backgroundColor: cmd.fillColor ?? 'transparent',
      strokeWidth: cmd.lineWidth ?? 2,
      opacity: Math.round((cmd.opacity ?? 1) * 100),
      roughness: 0,
      seed: Math.floor(Math.random() * 2 ** 31),
    };

    switch (cmd.type) {
      case 'freehand': {
        if (!cmd.points || cmd.points.length < 2) return null;
        return {
          ...base,
          type: 'freedraw',
          points: cmd.points.map((p) => [p.x, p.y]),
        };
      }
      case 'rect':
        return {
          ...base,
          type: 'rectangle',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 0,
          height: cmd.height ?? 0,
        };
      case 'circle':
        return {
          ...base,
          type: 'ellipse',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: (cmd.radius ?? 0) * 2,
          height: (cmd.radius ?? 0) * 2,
        };
      case 'line':
      case 'arrow':
        return {
          ...base,
          type: 'arrow',
          points: [[cmd.x ?? 0, cmd.y ?? 0], [cmd.x2 ?? 0, cmd.y2 ?? 0]],
        };
      case 'text':
        return {
          ...base,
          type: 'text',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          text: cmd.text ?? '',
          fontSize: cmd.fontSize ?? 16,
          fontFamily: 1,
        };
      default:
        return null;
    }
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Render to external context (for PNG export) ---

  private drawToContext(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    if (this.gridEnabled) {
      this.drawGrid(ctx, this.canvasWidth, this.canvasHeight);
    }
    for (const cmd of this.commands) {
      this.drawShape(ctx, cmd);
    }
  }
}

if (!customElements.get(CANVAS_BLOCK_TAG)) {
  customElements.define(CANVAS_BLOCK_TAG, EmdCanvasBlock);
}

const canvasBlockPlugin: BlockPlugin = {
  id: 'canvas-block',
  name: 'Canvas Drawing Block',
  version: '0.1.0',
  code_block_tags: [CodeBlockTag.Draw],
  component: EmdCanvasBlock,
  toolbar: [
    { id: 'canvas-undo', label: 'Undo', icon: '↩', action: () => {} },
    { id: 'canvas-redo', label: 'Redo', icon: '↪', action: () => {} },
    { id: 'canvas-clear', label: 'Clear', icon: '✕', action: () => {} },
    { id: 'canvas-export-png', label: 'Export PNG', icon: '⇩', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdCanvasBlock) {
      element.setBlock(block);
      const content = block.section ? getCodeBlockContent(block.section.content) : undefined;
      if (content) {
        element.loadContent(content);
      }
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdCanvasBlock) {
      element.setBlock(block);
    }
  },
  onDestroy: (_block, _element) => {},
};

registerBlockPlugin(canvasBlockPlugin);

export { CANVAS_BLOCK_TAG, canvasBlockPlugin };
export type { DrawCommand, CanvasData };
