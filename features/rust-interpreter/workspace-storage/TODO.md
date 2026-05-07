# Workspace & Storage — TODO

## Tab System
- [ ] Tab bar: file icon + name + dirty indicator, color-coded by section type
- [ ] Scrollable overflow (min 100px width)
- [ ] [+] for new blank .emd
- [ ] Close: ✕ on hover, Cmd+W
- [ ] Navigation: click, Cmd+Shift+[/], Cmd+1-9, Cmd+T
- [ ] Right-click menu: Close, Close Others, Close All, Copy Path, Reveal
- [ ] Dirty indicator ●, Cmd+S save, auto-save toggle
- [ ] Closing unsaved: confirm dialog
- [ ] Tab switch animation: 150ms slide

## Breadcrumb
- [ ] Below tab bar, segments: Root > folder > filename
- [ ] Click segment → navigate file explorer
- [ ] Right-click: copy path variants
- [ ] Aliases via .emdenv/aliases.json
- [ ] Truncate from left "..."
- [ ] Hover shows full path tooltip

## File Explorer
- [ ] Left sidebar, Cmd+B toggle, 250px resizable
- [ ] Tree view with expand/collapse folders
- [ ] .emd with icon, others grayed
- [ ] Respects .gitignore
- [ ] Dotfiles toggle
- [ ] Search/filter input
- [ ] Cmd+N quick create
- [ ] Drag: reorder, move between folders, image to editor
- [ ] Right-click: Open, Open in Split, Rename, Delete, Copy Path, New File/Folder
- [ ] Smooth expand animation 200ms

## Split View
- [ ] Cmd+\ horizontal split
- [ ] Independent file, cursor, scroll per split
- [ ] Drag divider, min 200px
- [ ] Snap 25/50/75%
- [ ] Cmd+W close active split

## Banner
- [ ] Upload image per workspace (200px, full width)
- [ ] Hex color as gradient
- [ ] Optional toggle
- [ ] .emdenv/workspace.json

## Settings
- [ ] Cmd+, panel: Editor, Theme, AI, Highlight Menu, Workspace, Plugins, Shortcuts
- [ ] Per-workspace .emdenv/settings.emd
- [ ] Global defaults fallback

## Storage Adapter
- [ ] StorageProvider interface: read, write, list, watch, exists, mkdir, delete, rename
- [ ] TauriStorage: native fs via Tauri IPC
- [ ] RustStorage: std::fs for wry
- [ ] BrowserStorage: OPFS persistent
- [ ] MemoryStorage: in-memory (standalone)
- [ ] Import/export bridge for browser

## Keyboard Shortcuts
- [ ] Cmd+K Cmd+S: shortcuts overlay
- [ ] Searchable, categorized
- [ ] Rebinding: click shortcut → new combo
