import { Block, BlockPlugin, SectionType, getCodeBlockContent } from '@core/types';
import { registerBlockPlugin } from '@core/plugin-api';

const FLOWCHART_BLOCK_TAG = 'emd-flowchart-block';

interface Point {
  x: number;
  y: number;
}

type NodeType = 'process' | 'decision' | 'terminator' | 'io';

interface FlowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface FlowEdge {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  fromPort: 'output';
  toPort: 'input';
}

interface FlowchartData {
  version: number;
  width: number;
  height: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const DEFAULT_CANVAS_W = 1200;
const DEFAULT_CANVAS_H = 800;
const NODE_DEFAULTS = { process: [140, 60], decision: [120, 80], terminator: [140, 50], io: [140, 60] };
const PORT_RADIUS = 6;
const HANDLE_SIZE = 8;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const MAX_UNDO = 100;
const EDGE_HIT_THRESHOLD = 12;

let nodeIdCounter = 0;
let edgeIdCounter = 0;

function genNodeId(): string {
  return `fn${++nodeIdCounter}`;
}

function genEdgeId(): string {
  return `fe${++edgeIdCounter}`;
}

type ToolMode = 'select' | 'node-process' | 'node-decision' | 'node-terminator' | 'node-io';

export class EmdFlowchartBlock extends HTMLElement {
  private blockData: Block | null = null;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private canvasContainer!: HTMLElement;

  private nodes: FlowNode[] = [];
  private edges: FlowEdge[] = [];
  private undoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[] = [];
  private redoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[] = [];

  private canvasWidth = DEFAULT_CANVAS_W;
  private canvasHeight = DEFAULT_CANVAS_H;

  private tool: ToolMode = 'select';
  private mode: 'idle' | 'dragging-node' | 'resizing-node' | 'dragging-edge' | 'panning' = 'idle';
  private selectedNodeId: string | null = null;
  private selectedEdgeId: string | null = null;
  private resizeCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null;

  private dragStart: Point = { x: 0, y: 0 };
  private dragNodeStart: Point | null = null;
  private edgeSourceId: string | null = null;
  private edgeTempEnd: Point = { x: 0, y: 0 };

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private panStart: Point | null = null;
  private spaceHeld = false;

  private statusBar!: HTMLElement;
  private nodeCountEl!: HTMLElement;
  private edgeCountEl!: HTMLElement;
  private zoomLabel!: HTMLElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;

  connectedCallback(): void {
    this.classList.add('emd-block', 'emd-block-flowchart');
    this.setAttribute('tabindex', '0');

    this.innerHTML = `
      <div class="emd-fc-toolbar">
        <button class="emd-fc-tool emd-fc-tool-active" data-tool="select" title="Select / Move (V)">\u2b21</button>
        <span class="emd-canvas-sep"></span>
        <button class="emd-fc-tool" data-tool="node-process" title="Process (Rectangle)">\u25a1</button>
        <button class="emd-fc-tool" data-tool="node-decision" title="Decision (Diamond)">\u25c7</button>
        <button class="emd-fc-tool" data-tool="node-terminator" title="Start/End (Rounded)">\u25d1</button>
        <button class="emd-fc-tool" data-tool="node-io" title="Input/Output (Parallelogram)">\u25e3</button>
        <span class="emd-canvas-sep"></span>
        <button class="emd-fc-undo" title="Undo (Ctrl+Z)" disabled>\u21a9</button>
        <button class="emd-fc-redo" title="Redo (Ctrl+Shift+Z)" disabled>\u21aa</button>
        <button class="emd-fc-auto-layout" title="Auto Layout">\u2263 Layout</button>
        <span class="emd-canvas-sep"></span>
        <button class="emd-fc-export-png" title="Export PNG">PNG</button>
        <button class="emd-fc-export-svg" title="Export SVG">SVG</button>
      </div>
      <div class="emd-fc-container">
        <canvas class="emd-fc-canvas"></canvas>
        <div class="emd-canvas-zoom-badge">100%</div>
        <div class="emd-fc-minimap"><canvas class="emd-fc-minimap-canvas"></canvas></div>
        <div class="emd-canvas-resize-handle emd-fc-resize" title="Drag to resize"></div>
        <div class="emd-fc-label-input" style="display:none;">
          <input type="text" class="emd-fc-label-field">
        </div>
        <div class="emd-fc-edge-label-input" style="display:none;">
          <input type="text" class="emd-fc-edge-label-field">
        </div>
      </div>
      <div class="emd-canvas-status-bar">
        <span class="emd-fc-node-count">Nodes: 0</span>
        <span class="emd-fc-edge-count">Edges: 0</span>
        <span class="emd-fc-tool-display">Select</span>
        <span class="emd-canvas-zoom-label">100%</span>
      </div>
    `;

    this.canvasContainer = this.querySelector('.emd-fc-container')!;
    this.canvas = this.querySelector('.emd-fc-canvas')!;
    this.statusBar = this.querySelector('.emd-canvas-status-bar')!;
    this.nodeCountEl = this.querySelector('.emd-fc-node-count')!;
    this.edgeCountEl = this.querySelector('.emd-fc-edge-count')!;
    this.zoomLabel = this.querySelector('.emd-canvas-zoom-label')!;
    this.undoBtn = this.querySelector('.emd-fc-undo')!;
    this.redoBtn = this.querySelector('.emd-fc-redo')!;

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
    this.bindResize();
    this.bindLabelInput();
    this.bindEdgeLabelInput();
    this.updateStatusBar();
    this.render();
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
      const data: FlowchartData = JSON.parse(json);
      if (data.version === 1 && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        this.canvasWidth = data.width || DEFAULT_CANVAS_W;
        this.canvasHeight = data.height || DEFAULT_CANVAS_H;
        this.nodes = data.nodes;
        this.edges = data.edges;
        this.setCanvasSize(this.canvasWidth, this.canvasHeight);
        this.updateStatusBar();
        this.render();
      }
    } catch {
      this.nodes = [];
      this.edges = [];
    }
  }

  serialize(): string {
    const data: FlowchartData = {
      version: 1,
      width: this.canvasWidth,
      height: this.canvasHeight,
      nodes: this.nodes,
      edges: this.edges,
    };
    return JSON.stringify(data, null, 2);
  }

  // --- Toolbar ---

  private bindToolbar(): void {
    this.querySelectorAll('.emd-fc-tool').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset['tool'] as ToolMode;
        if (tool) this.selectTool(tool);
      });
    });

    this.undoBtn.addEventListener('click', () => this.undo());
    this.redoBtn.addEventListener('click', () => this.redo());
    this.querySelector('.emd-fc-auto-layout')!.addEventListener('click', () => this.autoLayout());
    this.querySelector('.emd-fc-export-png')!.addEventListener('click', () => this.exportPNG());
    this.querySelector('.emd-fc-export-svg')!.addEventListener('click', () => this.exportSVG());
  }

  private selectTool(tool: ToolMode): void {
    this.tool = tool;
    this.mode = 'idle';
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.querySelectorAll('.emd-fc-tool').forEach((btn) => {
      btn.classList.toggle('emd-fc-tool-active', (btn as HTMLElement).dataset['tool'] === tool);
    });
    this.querySelector('.emd-fc-tool-display')!.textContent =
      tool.replace('node-', '').charAt(0).toUpperCase() + tool.replace('node-', '').slice(1);
    this.render();
  }

  // --- Canvas Events ---

  private bindCanvasEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 1) {
      this.mode = 'panning';
      this.panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.spaceHeld) {
      this.mode = 'panning';
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const pt = this.screenToCanvas(e.clientX, e.clientY);

    if (this.tool === 'select') {
      const handleInfo = this.findResizeHandle(pt);
      if (handleInfo && this.selectedNodeId === handleInfo.nodeId) {
        this.mode = 'resizing-node';
        this.resizeCorner = handleInfo.corner;
        this.dragStart = pt;
        this.dragNodeStart = { x: this.getNode(handleInfo.nodeId)!.x, y: this.getNode(handleInfo.nodeId)!.y };
        return;
      }

      const portInfo = this.findPort(pt);
      if (portInfo?.type === 'output') {
        this.mode = 'dragging-edge';
        this.edgeSourceId = portInfo.nodeId;
        this.dragStart = pt;
        this.edgeTempEnd = pt;
        return;
      }

      const hitNode = this.findNodeAt(pt);
      if (hitNode) {
        if (this.selectedNodeId !== hitNode.id) {
          this.selectedNodeId = hitNode.id;
          this.selectedEdgeId = null;
        }
        this.mode = 'dragging-node';
        this.dragStart = pt;
        this.dragNodeStart = { x: hitNode.x, y: hitNode.y };
        return;
      }

      const hitEdge = this.findEdgeAt(pt);
      if (hitEdge) {
        this.selectedEdgeId = hitEdge.id;
        this.selectedNodeId = null;
        this.render();
        return;
      }

      this.selectedNodeId = null;
      this.selectedEdgeId = null;
      this.render();
      return;
    }

    // Node creation mode
    const [dw, dh] = this.nodeDims();
    const node: FlowNode = {
      id: genNodeId(),
      type: this.tool.replace('node-', '') as NodeType,
      x: pt.x - dw / 2,
      y: pt.y - dh / 2,
      width: dw,
      height: dh,
      label: '',
    };

    this.pushUndoState();
    this.nodes.push(node);
    this.selectedNodeId = node.id;
    this.redoStack = [];
    this.updateUndoRedoButtons();
    this.updateStatusBar();
    this.render();

    // Prompt for label
    this.showLabelInput(node);
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.mode === 'panning' && this.panStart) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.panX += dx;
      this.panY += dy;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.render();
      return;
    }

    if (this.mode === 'dragging-node' && this.selectedNodeId && this.dragNodeStart) {
      const pt = this.screenToCanvas(e.clientX, e.clientY);
      const dx = pt.x - this.dragStart.x;
      const dy = pt.y - this.dragStart.y;
      const node = this.getNode(this.selectedNodeId);
      if (node) {
        node.x = this.dragNodeStart.x + dx;
        node.y = this.dragNodeStart.y + dy;
        this.render();
      }
      return;
    }

    if (this.mode === 'resizing-node' && this.selectedNodeId && this.resizeCorner) {
      const pt = this.screenToCanvas(e.clientX, e.clientY);
      const node = this.getNode(this.selectedNodeId);
      if (node && this.dragNodeStart) {
        const oldX = this.dragNodeStart.x;
        const oldY = this.dragNodeStart.y;
        const oldW = node.width;
        const oldH = node.height;
        if (this.resizeCorner === 'se') {
          node.width = Math.max(40, pt.x - oldX);
          node.height = Math.max(30, pt.y - oldY);
        } else if (this.resizeCorner === 'sw') {
          node.width = Math.max(40, oldX + oldW - pt.x);
          node.x = pt.x;
          node.height = Math.max(30, pt.y - oldY);
        } else if (this.resizeCorner === 'ne') {
          node.width = Math.max(40, pt.x - oldX);
          node.height = Math.max(30, oldY + oldH - pt.y);
          node.y = pt.y;
        } else if (this.resizeCorner === 'nw') {
          node.width = Math.max(40, oldX + oldW - pt.x);
          node.x = pt.x;
          node.height = Math.max(30, oldY + oldH - pt.y);
          node.y = pt.y;
        }
        this.render();
      }
      return;
    }

    if (this.mode === 'dragging-edge' && this.edgeSourceId) {
      const pt = this.screenToCanvas(e.clientX, e.clientY);
      this.edgeTempEnd = pt;
      this.render();
      const targetPort = this.findPort(pt);
      this.canvas.style.cursor = targetPort?.type === 'input' ? 'copy' : 'no-drop';
      return;
    }

    const pt = this.screenToCanvas(e.clientX, e.clientY);
    if (this.tool === 'select') {
      const overHandle = this.findResizeHandle(pt);
      const overPort = this.findPort(pt);
      if (overHandle && this.selectedNodeId === overHandle.nodeId) {
        const cursors: Record<string, string> = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize' };
        this.canvas.style.cursor = cursors[overHandle.corner] || 'default';
      } else if (overPort?.type === 'output') {
        this.canvas.style.cursor = 'crosshair';
      } else if (this.findNodeAt(pt)) {
        this.canvas.style.cursor = 'move';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    if (this.mode === 'panning') {
      this.mode = 'idle';
      this.panStart = null;
      return;
    }

    if (this.mode === 'dragging-node') {
      this.mode = 'idle';
      return;
    }

    if (this.mode === 'resizing-node') {
      this.mode = 'idle';
      return;
    }

    if (this.mode === 'dragging-edge' && this.edgeSourceId) {
      const portInfo = this.findPort(this.edgeTempEnd);
      if (portInfo?.type === 'input' && portInfo.nodeId !== this.edgeSourceId) {
        const existing = this.edges.find(
          (e) => e.fromId === this.edgeSourceId && e.toId === portInfo.nodeId
        );
        if (!existing) {
          this.pushUndoState();
          this.edges.push({
            id: genEdgeId(),
            fromId: this.edgeSourceId,
            toId: portInfo.nodeId,
            label: '',
            fromPort: 'output',
            toPort: 'input',
          });
          this.redoStack = [];
          this.updateUndoRedoButtons();
          this.updateStatusBar();
        }
      }
      this.mode = 'idle';
      this.edgeSourceId = null;
      this.render();
      return;
    }
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

  private onDoubleClick(e: MouseEvent): void {
    const pt = this.screenToCanvas(e.clientX, e.clientY);
    if (this.tool === 'select') {
      const hitNode = this.findNodeAt(pt);
      if (hitNode) {
        this.showLabelInput(hitNode);
        return;
      }
      const hitEdge = this.findEdgeAt(pt);
      if (hitEdge) {
        this.showEdgeLabelInput(hitEdge);
        return;
      }
    }
  }

  // --- Keyboard ---

  private bindKeyboard(): void {
    this.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' && !this.spaceHeld) {
        e.preventDefault();
        this.spaceHeld = true;
        this.canvas.style.cursor = 'grab';
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      }

      if (e.key === 'v' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.selectTool('select');
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !this.isInputFocused()) {
        this.deleteSelected();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === ' ') {
        this.spaceHeld = false;
        this.canvas.style.cursor = this.tool === 'select' ? 'default' : 'crosshair';
      }
    });
  }

  private deleteSelected(): void {
    if (this.selectedNodeId) {
      this.pushUndoState();
      this.edges = this.edges.filter((e) => e.fromId !== this.selectedNodeId && e.toId !== this.selectedNodeId);
      this.nodes = this.nodes.filter((n) => n.id !== this.selectedNodeId);
      this.selectedNodeId = null;
      this.redoStack = [];
      this.updateUndoRedoButtons();
      this.updateStatusBar();
      this.render();
    } else if (this.selectedEdgeId) {
      this.pushUndoState();
      this.edges = this.edges.filter((e) => e.id !== this.selectedEdgeId);
      this.selectedEdgeId = null;
      this.redoStack = [];
      this.updateUndoRedoButtons();
      this.updateStatusBar();
      this.render();
    }
  }

  // --- Resize ---

  private bindResize(): void {
    const handle = this.querySelector('.emd-fc-resize')!;
    let isResizing = false;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    handle.addEventListener('pointerdown', (e: Event) => {
      const pe = e as PointerEvent;
      pe.preventDefault();
      pe.stopPropagation();
      isResizing = true;
      startX = pe.clientX;
      startY = pe.clientY;
      startW = this.canvasWidth;
      startH = this.canvasHeight;
      handle.setPointerCapture(pe.pointerId);
    });

    window.addEventListener('pointermove', (ev: Event) => {
      const e = ev as PointerEvent;
      if (!isResizing) return;
      this.canvasWidth = Math.max(200, startW + e.clientX - startX);
      this.canvasHeight = Math.max(150, startH + e.clientY - startY);
      this.setCanvasSize(this.canvasWidth, this.canvasHeight);
      this.render();
    });

    window.addEventListener('pointerup', () => { isResizing = false; });
  }

  // --- Label Input ---

  private labelInputShown = false;
  private labelInputEl!: HTMLInputElement;
  private labelInputWrap!: HTMLElement;
  private editingNode: FlowNode | null = null;

  private bindLabelInput(): void {
    this.labelInputWrap = this.querySelector('.emd-fc-label-input')!;
    this.labelInputEl = this.querySelector('.emd-fc-label-field')!;

    this.labelInputEl.addEventListener('blur', () => this.commitLabel());
    this.labelInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.commitLabel(); }
      if (e.key === 'Escape') { this.hideLabelInput(); }
    });
  }

  private showLabelInput(node: FlowNode): void {
    this.hideEdgeLabelInput();
    this.editingNode = node;
    this.labelInputEl.value = node.label;
    this.labelInputWrap.style.display = 'block';
    this.positionLabelInput(node);
    this.labelInputEl.focus();
    this.labelInputEl.select();
  }

  private positionLabelInput(node: FlowNode): void {
    const left = node.x + node.width / 2 - 60;
    const top = node.y + node.height / 2 - 12;
    this.labelInputWrap.style.left = `${left * this.zoom + this.panX}px`;
    this.labelInputWrap.style.top = `${top * this.zoom + this.panY}px`;
    this.labelInputWrap.style.transform = `scale(${this.zoom})`;
  }

  private commitLabel(): void {
    if (this.editingNode) {
      const text = this.labelInputEl.value.trim();
      this.pushUndoState();
      this.editingNode.label = text;
      this.redoStack = [];
      this.updateUndoRedoButtons();
      this.render();
    }
    this.hideLabelInput();
  }

  private hideLabelInput(): void {
    this.labelInputWrap.style.display = 'none';
    this.editingNode = null;
    this.canvas.focus();
  }

  // --- Edge Label Input ---

  private edgeLabelInputShown = false;
  private edgeLabelInputEl!: HTMLInputElement;
  private edgeLabelInputWrap!: HTMLElement;
  private editingEdge: FlowEdge | null = null;

  private bindEdgeLabelInput(): void {
    this.edgeLabelInputWrap = this.querySelector('.emd-fc-edge-label-input')!;
    this.edgeLabelInputEl = this.querySelector('.emd-fc-edge-label-field')!;

    this.edgeLabelInputEl.addEventListener('blur', () => this.commitEdgeLabel());
    this.edgeLabelInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.commitEdgeLabel(); }
      if (e.key === 'Escape') { this.hideEdgeLabelInput(); }
    });
  }

  private showEdgeLabelInput(edge: FlowEdge): void {
    this.hideLabelInput();
    this.editingEdge = edge;
    this.edgeLabelInputEl.value = edge.label;
    this.edgeLabelInputWrap.style.display = 'block';

    const fromNode = this.getNode(edge.fromId);
    const toNode = this.getNode(edge.toId);
    if (fromNode && toNode) {
      const mx = (fromNode.x + fromNode.width / 2 + toNode.x + toNode.width / 2) / 2;
      const my = (fromNode.y + fromNode.height + toNode.y) / 2;
      this.edgeLabelInputWrap.style.left = `${mx * this.zoom + this.panX - 60}px`;
      this.edgeLabelInputWrap.style.top = `${my * this.zoom + this.panY - 12}px`;
      this.edgeLabelInputWrap.style.transform = `scale(${this.zoom})`;
    }

    this.edgeLabelInputEl.focus();
    this.edgeLabelInputEl.select();
  }

  private commitEdgeLabel(): void {
    if (this.editingEdge) {
      const text = this.edgeLabelInputEl.value.trim();
      this.pushUndoState();
      this.editingEdge.label = text;
      this.redoStack = [];
      this.updateUndoRedoButtons();
      this.render();
    }
    this.hideEdgeLabelInput();
  }

  private hideEdgeLabelInput(): void {
    this.edgeLabelInputWrap.style.display = 'none';
    this.editingEdge = null;
    this.canvas.focus();
  }

  private isInputFocused(): boolean {
    return document.activeElement === this.labelInputEl || document.activeElement === this.edgeLabelInputEl;
  }

  // --- Hit Testing ---

  private findNodeAt(pt: Point): FlowNode | null {
    const nodes = [...this.nodes].reverse();
    for (const node of nodes) {
      if (pt.x >= node.x && pt.x <= node.x + node.width &&
          pt.y >= node.y && pt.y <= node.y + node.height) {
        return node;
      }
    }
    return null;
  }

  private findEdgeAt(pt: Point): FlowEdge | null {
    for (const edge of this.edges) {
      const fromNode = this.getNode(edge.fromId);
      const toNode = this.getNode(edge.toId);
      if (!fromNode || !toNode) continue;

      const x1 = fromNode.x + fromNode.width / 2;
      const y1 = fromNode.y + fromNode.height;
      const x2 = toNode.x + toNode.width / 2;
      const y2 = toNode.y;

      const dist = this.pointToLineSegment(pt.x, pt.y, x1, y1, x2, y2);
      if (dist < EDGE_HIT_THRESHOLD / this.zoom) return edge;
    }
    return null;
  }

  private pointToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  }

  private findPort(pt: Point): { type: 'input' | 'output'; nodeId: string } | null {
    for (const node of this.nodes) {
      const cx = node.x + node.width / 2;
      const inY = node.y;
      const outY = node.y + node.height;
      const dIn = Math.sqrt((pt.x - cx) ** 2 + (pt.y - inY) ** 2);
      const dOut = Math.sqrt((pt.x - cx) ** 2 + (pt.y - outY) ** 2);
      if (dIn < PORT_RADIUS + 4) return { type: 'input', nodeId: node.id };
      if (dOut < PORT_RADIUS + 4) return { type: 'output', nodeId: node.id };
    }
    return null;
  }

  private findResizeHandle(pt: Point): { nodeId: string; corner: 'nw' | 'ne' | 'sw' | 'se' } | null {
    for (const node of this.nodes) {
      const corners: { corner: 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number }[] = [
        { corner: 'nw', x: node.x, y: node.y },
        { corner: 'ne', x: node.x + node.width, y: node.y },
        { corner: 'sw', x: node.x, y: node.y + node.height },
        { corner: 'se', x: node.x + node.width, y: node.y + node.height },
      ];
      for (const c of corners) {
        if (Math.abs(pt.x - c.x) < HANDLE_SIZE + 2 && Math.abs(pt.y - c.y) < HANDLE_SIZE + 2) {
          return { nodeId: node.id, corner: c.corner };
        }
      }
    }
    return null;
  }

  // --- Helpers ---

  private getNode(id: string): FlowNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  private nodeDims(): [number, number] {
    const t = this.tool.replace('node-', '') as keyof typeof NODE_DEFAULTS;
    const dims = NODE_DEFAULTS[t] ?? [140, 60];
    return [dims[0]!, dims[1]!];
  }

  // --- Rendering ---

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

    for (const edge of this.edges) {
      this.drawEdge(ctx, edge);
    }

    for (const node of this.nodes) {
      this.drawNode(ctx, node);
    }

    if (this.mode === 'dragging-edge' && this.edgeSourceId) {
      const fromNode = this.getNode(this.edgeSourceId);
      if (fromNode) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height);
        ctx.lineTo(this.edgeTempEnd.x, this.edgeTempEnd.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();

    this.renderMinimap();
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: FlowNode): void {
    ctx.save();
    const isSelected = node.id === this.selectedNodeId;

    ctx.strokeStyle = isSelected ? '#3b82f6' : '#374151';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.lineJoin = 'round';

    if (node.type === 'decision') {
      this.drawDiamond(ctx, node);
    } else if (node.type === 'terminator') {
      this.drawRoundedRect(ctx, node);
    } else if (node.type === 'io') {
      this.drawParallelogram(ctx, node);
    } else {
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(node.x, node.y, node.width, node.height);
      ctx.strokeRect(node.x, node.y, node.width, node.height);
    }

    ctx.fillStyle = isSelected ? '#3b82f6' : '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxLabelWidth = node.type === 'decision' ? node.width * 0.45 : node.width - 16;
    const label = this.wrapText(ctx, node.label || this.defaultLabel(node.type), maxLabelWidth);
    const lineHeight = 14;
    const totalHeight = label.length * lineHeight;
    let startY = node.y + node.height / 2 - totalHeight / 2 + lineHeight / 2;
    for (const line of label) {
      ctx.fillText(line, node.x + node.width / 2, startY, maxLabelWidth);
      startY += lineHeight;
    }

    if (isSelected) {
      this.drawResizeHandles(ctx, node);
    }

    ctx.fillStyle = '#e5e7eb';
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    const cx = node.x + node.width / 2;
    ctx.beginPath();
    ctx.arc(cx, node.y, PORT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, node.y + node.height, PORT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, node: FlowNode): void {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(cx, node.y);
    ctx.lineTo(node.x + node.width, cy);
    ctx.lineTo(cx, node.y + node.height);
    ctx.lineTo(node.x, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, node: FlowNode): void {
    const r = 20;
    ctx.fillStyle = '#dbeafe';
    ctx.beginPath();
    ctx.moveTo(node.x + r, node.y);
    ctx.lineTo(node.x + node.width - r, node.y);
    ctx.arcTo(node.x + node.width, node.y, node.x + node.width, node.y + r, r);
    ctx.lineTo(node.x + node.width, node.y + node.height - r);
    ctx.arcTo(node.x + node.width, node.y + node.height, node.x + node.width - r, node.y + node.height, r);
    ctx.lineTo(node.x + r, node.y + node.height);
    ctx.arcTo(node.x, node.y + node.height, node.x, node.y + node.height - r, r);
    ctx.lineTo(node.x, node.y + r);
    ctx.arcTo(node.x, node.y, node.x + r, node.y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawParallelogram(ctx: CanvasRenderingContext2D, node: FlowNode): void {
    const skew = 15;
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.moveTo(node.x + skew, node.y);
    ctx.lineTo(node.x + node.width + skew, node.y);
    ctx.lineTo(node.x + node.width - skew, node.y + node.height);
    ctx.lineTo(node.x - skew, node.y + node.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawResizeHandles(ctx: CanvasRenderingContext2D, node: FlowNode): void {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    const handles = [
      { x: node.x, y: node.y },
      { x: node.x + node.width, y: node.y },
      { x: node.x, y: node.y + node.height },
      { x: node.x + node.width, y: node.y + node.height },
    ];
    for (const h of handles) {
      ctx.fillRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  private drawEdge(ctx: CanvasRenderingContext2D, edge: FlowEdge): void {
    const fromNode = this.getNode(edge.fromId);
    const toNode = this.getNode(edge.toId);
    if (!fromNode || !toNode) return;

    const x1 = fromNode.x + fromNode.width / 2;
    const y1 = fromNode.y + fromNode.height;
    const x2 = toNode.x + toNode.width / 2;
    const y2 = toNode.y;

    const isSelected = edge.id === this.selectedEdgeId;

    ctx.save();
    ctx.strokeStyle = isSelected ? '#ef4444' : '#6b7280';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.fillStyle = ctx.strokeStyle;

    const midY = (y1 + y2) / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);
    ctx.stroke();

    this.drawEdgeArrowhead(ctx, x2, y2, x2, midY);

    if (edge.label) {
      const mx = (x1 + x2) / 2;
      const my = midY - 12;
      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(edge.label, mx, my);
    }

    ctx.restore();
  }

  private drawEdgeArrowhead(ctx: CanvasRenderingContext2D, x2: number, y2: number, fromX: number, fromY: number): void {
    const angle = Math.atan2(y2 - fromY, x2 - fromX);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [' '];
  }

  private defaultLabel(type: NodeType): string {
    const labels: Record<NodeType, string> = {
      process: 'Process',
      decision: 'Decision?',
      terminator: 'Start/End',
      io: 'Input/Output',
    };
    return labels[type] ?? 'Node';
  }

  // --- Minimap ---

  private renderMinimap(): void {
    const miniCanvas = this.querySelector('.emd-fc-minimap-canvas') as HTMLCanvasElement;
    if (!miniCanvas) return;
    const mw = 150, mh = 100;
    miniCanvas.width = mw;
    miniCanvas.height = mh;
    const mctx = miniCanvas.getContext('2d')!;

    mctx.fillStyle = '#f3f4f6';
    mctx.fillRect(0, 0, mw, mh);

    const allX = [...this.nodes.map((n) => n.x), ...this.nodes.map((n) => n.x + n.width)];
    const allY = [...this.nodes.map((n) => n.y), ...this.nodes.map((n) => n.y + n.height)];
    if (allX.length === 0) return;
    const minX = Math.min(...allX) - 20;
    const maxX = Math.max(...allX) + 20;
    const minY = Math.min(...allY) - 20;
    const maxY = Math.max(...allY) + 20;
    const sx = mw / Math.max(maxX - minX, 1);
    const sy = mh / Math.max(maxY - minY, 1);
    const s = Math.min(sx, sy);

    const offsetX = (mw - (maxX - minX) * s) / 2 - minX * s;
    const offsetY = (mh - (maxY - minY) * s) / 2 - minY * s;

    mctx.fillStyle = 'rgba(59,130,246,0.3)';
    mctx.strokeStyle = '#3b82f6';
    mctx.lineWidth = 1;

    for (const node of this.nodes) {
      mctx.fillRect(node.x * s + offsetX, node.y * s + offsetY, node.width * s, node.height * s);
      mctx.strokeRect(node.x * s + offsetX, node.y * s + offsetY, node.width * s, node.height * s);
    }

    const vw = this.canvasContainer.clientWidth / this.zoom;
    const vh = this.canvasContainer.clientHeight / this.zoom;
    mctx.strokeStyle = '#ef4444';
    mctx.lineWidth = 1.5;
    mctx.strokeRect(
      (-this.panX / this.zoom) * s + offsetX,
      (-this.panY / this.zoom) * s + offsetY,
      vw * s,
      vh * s
    );
  }

  // --- Auto Layout ---

  autoLayout(): void {
    if (this.nodes.length === 0) return;
    this.pushUndoState();

    const layers = this.sugiyamaLayers();
    const xGap = 60;
    const yPad = 80;

    let maxLayerW = 0;
    const layerWidths: number[] = [];
    for (const layer of layers) {
      let w = 0;
      for (const nid of layer) {
        const node = this.getNode(nid);
        if (node) w = Math.max(w, node.width);
      }
      layerWidths.push(w);
      maxLayerW = Math.max(maxLayerW, w);
    }

    for (let li = 0; li < layers.length; li++) {
      const layerH = layers[li]!.length * (80) + yPad;
      const startY = (this.canvasHeight - layerH) / 2;
      const x = 60 + li * (maxLayerW + xGap);
      for (let ni = 0; ni < layers[li]!.length; ni++) {
        const node = this.getNode(layers[li]![ni]!);
        if (node) {
          node.x = x;
          node.y = startY + ni * 90;
        }
      }
    }

    this.redoStack = [];
    this.updateUndoRedoButtons();
    this.render();
  }

  private sugiyamaLayers(): string[][] {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const node of this.nodes) {
      adjList.set(node.id, []);
      inDegree.set(node.id, 0);
    }
    for (const edge of this.edges) {
      const list = adjList.get(edge.fromId) || [];
      list.push(edge.toId);
      adjList.set(edge.fromId, list);
      inDegree.set(edge.toId, (inDegree.get(edge.toId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const layers: string[][] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const layer: string[] = [];
      const nextQueue: string[] = [];
      for (const id of queue) {
        if (visited.has(id)) continue;
        visited.add(id);
        layer.push(id);
        for (const child of adjList.get(id) || []) {
          const newDeg = (inDegree.get(child) || 1) - 1;
          inDegree.set(child, newDeg);
          if (newDeg === 0) nextQueue.push(child);
        }
      }
      if (layer.length > 0) layers.push(layer);
      queue.length = 0;
      queue.push(...nextQueue);
    }

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        if (layers.length === 0) layers.push([]);
        layers[layers.length - 1]!.push(node.id);
      }
    }

    return layers;
  }

  // --- Undo / Redo ---

  private pushUndoState(): void {
    this.undoStack.push({
      nodes: this.nodes.map((n) => ({ ...n })),
      edges: this.edges.map((e) => ({ ...e })),
    });
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
  }

  undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;
    this.redoStack.push({
      nodes: this.nodes.map((n) => ({ ...n })),
      edges: this.edges.map((e) => ({ ...e })),
    });
    this.nodes = snapshot.nodes;
    this.edges = snapshot.edges;
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.updateUndoRedoButtons();
    this.updateStatusBar();
    this.render();
  }

  redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;
    this.undoStack.push({
      nodes: this.nodes.map((n) => ({ ...n })),
      edges: this.edges.map((e) => ({ ...e })),
    });
    this.nodes = snapshot.nodes;
    this.edges = snapshot.edges;
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.updateUndoRedoButtons();
    this.updateStatusBar();
    this.render();
  }

  private updateUndoRedoButtons(): void {
    this.undoBtn.disabled = this.undoStack.length === 0;
    this.redoBtn.disabled = this.redoStack.length === 0;
  }

  private updateZoomBadge(): void {
    const pct = Math.round(this.zoom * 100);
    this.querySelector('.emd-canvas-zoom-badge')!.textContent = `${pct}%`;
    this.zoomLabel.textContent = `${pct}%`;
  }

  private updateStatusBar(): void {
    this.nodeCountEl.textContent = `Nodes: ${this.nodes.length}`;
    this.edgeCountEl.textContent = `Edges: ${this.edges.length}`;
  }

  // --- Export ---

  exportPNG(): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    const ctx = canvas.getContext('2d')!;
    this.drawAll(ctx);
    canvas.toBlob((blob) => {
      if (blob) this.download(blob, 'flowchart.png');
    }, 'image/png');
  }

  exportSVG(): void {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvasWidth}" height="${this.canvasHeight}" viewBox="0 0 ${this.canvasWidth} ${this.canvasHeight}">\n`;
    svg += '  <rect width="100%" height="100%" fill="white"/>\n';

    for (const edge of this.edges) {
      const fromNode = this.getNode(edge.fromId);
      const toNode = this.getNode(edge.toId);
      if (!fromNode || !toNode) continue;
      const x1 = fromNode.x + fromNode.width / 2;
      const y1 = fromNode.y + fromNode.height;
      const x2 = toNode.x + toNode.width / 2;
      const y2 = toNode.y;
      const midY = (y1 + y2) / 2;
      svg += `  <path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#6b7280" stroke-width="1.5" marker-end="url(#arrowhead)"/>\n`;
    }

    svg += '  <defs>\n';
    svg += '    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">\n';
    svg += '      <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280"/>\n';
    svg += '    </marker>\n';
    svg += '  </defs>\n';

    for (const node of this.nodes) {
      const shape = this.nodeToSvgShape(node);
      svg += `  ${shape}\n`;
    }

    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    this.download(blob, 'flowchart.svg');
  }

  private nodeToSvgShape(node: FlowNode): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const label = esc(node.label || this.defaultLabel(node.type));
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;

    switch (node.type) {
      case 'process':
        return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="#f9fafb" stroke="#374151" stroke-width="1.5"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#374151">${label}</text>`;
      case 'decision':
        return `<polygon points="${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}" fill="#fef3c7" stroke="#374151" stroke-width="1.5"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#374151">${label}</text>`;
      case 'terminator':
        return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="20" ry="20" fill="#dbeafe" stroke="#374151" stroke-width="1.5"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#374151">${label}</text>`;
      case 'io':
        return `<polygon points="${node.x + 15},${node.y} ${node.x + node.width + 15},${node.y} ${node.x + node.width - 15},${node.y + node.height} ${node.x - 15},${node.y + node.height}" fill="#dcfce7" stroke="#374151" stroke-width="1.5"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#374151">${label}</text>`;
      default:
        return '';
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

  private drawAll(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    for (const edge of this.edges) this.drawEdge(ctx, edge);
    for (const node of this.nodes) this.drawNode(ctx, node);
  }
}

if (!customElements.get(FLOWCHART_BLOCK_TAG)) {
  customElements.define(FLOWCHART_BLOCK_TAG, EmdFlowchartBlock);
}

const flowchartBlockPlugin: BlockPlugin = {
  id: 'flowchart-block',
  name: 'Flowchart Editor Block',
  version: '0.1.0',
  section_types: [SectionType.Graph],
  component: EmdFlowchartBlock,
  toolbar: [
    { id: 'fc-undo', label: 'Undo', icon: '↩', action: () => {} },
    { id: 'fc-redo', label: 'Redo', icon: '↪', action: () => {} },
    { id: 'fc-layout', label: 'Auto Layout', icon: '≡', action: () => {} },
  ],
  onMount: (block, element) => {
    if (element instanceof EmdFlowchartBlock) {
      element.setBlock(block);
      const content = block.section ? getCodeBlockContent(block.section.content) : undefined;
      if (content) {
        element.loadContent(content);
      }
    }
  },
  onUpdate: (block, element) => {
    if (element instanceof EmdFlowchartBlock) {
      element.setBlock(block);
    }
  },
};

registerBlockPlugin(flowchartBlockPlugin);

export { FLOWCHART_BLOCK_TAG, flowchartBlockPlugin };
export type { FlowNode, FlowEdge, FlowchartData };
