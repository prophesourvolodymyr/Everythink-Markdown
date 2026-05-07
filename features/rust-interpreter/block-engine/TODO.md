# Block Engine — TODO

<!-- STATUS: designed -->

## BlockManager Core
- [ ] BlockManager class: holds flat block tree with parent references
- [ ] Add block: instantiate web component, mount in DOM
- [ ] Remove block: destroy component, remove DOM node, update tree
- [ ] Reorder block: move in sibling array, update DOM position
- [ ] Nest block: set parent reference, adjust indentation
- [ ] Unnest block: remove parent reference, flatten to sibling
- [ ] Block tree diff: compare old and new AST, produce minimal change list
- [ ] Change events: emit on every structural mutation for serializer

## Rendering Pipeline
- [ ] Parse .emd text via WASM parser (debounced 50ms)
- [ ] Diff AST: identify added, removed, changed, and moved sections
- [ ] Update changed blocks via block.update(newData)
- [ ] Mount new blocks, destroy removed blocks
- [ ] Leave unchanged blocks untouched

## Block Lifecycle
- [ ] Mount: component constructor → connectedCallback → render initial state
- [ ] Update: component.update(newSection) → re-render changed parts
- [ ] Destroy: component.destroy() → cleanup listeners, timers, contexts
- [ ] Selection: click block → select, show toolbar
- [ ] Multi-select: Shift+click (range), Cmd+click (toggle)
- [ ] Focus: Enter to edit, Escape to exit, arrow keys to navigate

## Plugin API
- [ ] registerBlockPlugin(plugin) → add to registry
- [ ] unregisterBlockPlugin(id) → remove from registry
- [ ] Plugin interface: id, name, sectionType/codeBlockTag, component, toolbar
- [ ] Core blocks registered through same API
- [ ] Plugin toolbar items rendered in block toolbar
- [ ] Fallback renderer for unknown types

## Drag & Drop
- [ ] Drag handle (⠿) on block hover/selection
- [ ] Drag up/down: reorder among siblings
- [ ] Drag left/right: indent/outdent (nest/unnest)
- [ ] Blue drop indicator line during drag
- [ ] Auto-scroll viewport when dragging near edges
- [ ] Touch support for mobile/tablet

## Block Toolbar
- [ ] Floating toolbar: appears above/below focused block
- [ ] Standard items: drag handle, Turn into dropdown, Delete, Move up/down
- [ ] Plugin items: rendered from plugin.toolbar[]
- [ ] AI items: Replace, Chat (context-aware, on text blocks)
- [ ] Positioning: above block if space, below if near viewport top
- [ ] Stays visible during scroll if block in view

## Keyboard Navigation
- [ ] Arrow keys: move focus between blocks
- [ ] Enter: edit focused block
- [ ] Escape: exit edit mode
- [ ] Tab/Shift+Tab: indent/outdent
- [ ] Backspace/Delete: delete block (with confirmation)
- [ ] Cmd+Z/Cmd+Shift+Z: undo/redo

## Undo/Redo
- [ ] Undo stack: content changes + structural changes
- [ ] Stack depth: 100 (configurable)
- [ ] Cross-type undo: undo section type conversion
- [ ] Grouped undo: rapid keystrokes grouped as one undo step

## Lazy Loading
- [ ] Dynamic imports for block renderer components
- [ ] Skeleton placeholder while loading
- [ ] Only load renderer when section type appears in file
- [ ] Preload hints for common block types (text, code)

## Performance
- [ ] 1000 blocks at 60fps
- [ ] Block mount: simple <50ms, heavy <200ms
- [ ] Drag reorder: perceptually instant (<16ms/frame)
- [ ] Undo/redo: <50ms regardless of stack depth

## Testing
- [ ] BlockManager mounts 1000 blocks without frame drops
- [ ] Drag reorder works with 500 blocks
- [ ] Plugin registration: custom block renders correctly
- [ ] Block type conversion preserves content
- [ ] Undo/redo handles mixed content + structural changes
- [ ] Lazy loading: unused block JS never loaded
- [ ] Keyboard navigation cycles through all blocks
