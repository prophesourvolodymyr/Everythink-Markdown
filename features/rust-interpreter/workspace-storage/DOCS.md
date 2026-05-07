# Feature: Rust Interpreter — Workspace & Storage

<!-- STATUS: designed -->
<!-- DEPENDS_ON: emd-core, block-engine -->
<!-- PARENT: rust-interpreter -->

## What This Is

The workspace shell that surrounds the block editor: tabbed file management with color-coded tabs by section type, breadcrumb path navigation with clickable segments, a file explorer sidebar with drag-reorder and `.gitignore` support, a split view for side-by-side editing, workspace banner images, a full settings panel, a keyboard shortcut system, and — most critically — the storage adapter that makes file operations work identically across all four distribution targets (desktop native FS, browser OPFS, Rust wry, in-memory).

## Original User Notes

From the mockup:
- Tabs: "Drag - query via file + open path via panel in a tab. To move across the tabs I can just click them or shift cmd - [left] / [right]"
- Banner: "User can upload any banner from their device - For this specific workspace... user can alias in colors"
- Breadcrumb: "Show path in this domain - guide. It will act like a breadcrumb. I can right click to copy exact right from the root. I can also alias around."
- File explorer: "I can open up a new md file on the root of the folder... like a bit of manager"

## Component Details

### Tab System
Always visible at top. One tab per open `.emd` file. Tab shows: file icon + filename + dirty indicator (●). Color-coded by primary section type: task file = amber tab, kanban = blue, agent = purple, graph = green, mixed/none = default gray. Tabs scroll horizontally when overflow (never shrink below 100px width). `[+]` button opens new blank `.emd` — user picks save location via dialog. Close tab: ✕ on hover or Cmd+W. Tab switching animation: content slides 20px with 150ms ease-out.

Navigation: click to switch, Cmd+Shift+[/] to move left/right, Cmd+1-9 for index, Cmd+T for new blank. Right-click context menu: Close, Close Others, Close All, Copy Path, Reveal in File Explorer.

Dirty state: unsaved changes = ● dot on tab. Cmd+S to save. Auto-save toggle in settings (default: off). Closing unsaved tab: "Save changes?" dialog.

### Breadcrumb Path
Below tab bar, full width. Segments: Root → folder → folder → filename, separated by `>` chevrons. Click any segment → navigates file explorer to that folder. Right-click any segment → "Copy path from root". Right-click filename → "Copy full path", "Copy relative path". Alias support: rename displayed path without renaming actual file (via `.emdenv/aliases.json`). Truncates from left with "..." when too long. Hover shows full path tooltip. Root icon (🏠) always visible.

### File Explorer
Left sidebar (toggle Cmd+B). Width: 250px, resizable via drag handle on right edge. Tree view: filesystem root, folders expand/collapse (smooth 200ms height animation), `.emd` files with icon, other files grayed out. Respects `.gitignore` (patterns from `ignore` crate). Hide/show dotfiles toggle. Search/filter input: type to filter visible files by name.

Quick create: Cmd+N from file explorer focus → new `.emd` file with name prompt. Drag files to reorder within folder. Drag files between folders to move. Drag image files onto editor canvas to insert. Right-click menu: Open, Open in Split, Rename, Delete, Copy Path, New File, New Folder.

### Split View
Cmd+\ toggles horizontal split (two editors side-by-side). Each split: independent file, cursor position, scroll position. Drag divider to resize (min 200px per pane). Snap to 25/50/75% with haptic feedback (on supported devices). Cmd+W closes active split. Single split returns to normal view.

### Workspace Banner
Optional cover image per workspace. Appears below tab bar, full width, 200px height. Or hex color instead of image (renders as gradient). Upload via Settings → Workspace → Banner. Per-workspace config in `.emdenv/workspace.json`. Default: no banner (clean, minimal).

### Settings Panel
Cmd+, to open. Sections: Editor (font, size, line height, tab size, word wrap, line numbers), Theme (light/dark/system, accent color), AI (provider, model, keys, prompts), Highlight Menu (add/remove/reorder items per row), Workspace (auto-save, tab color defaults, banner), Plugins (list, enable/disable), Keyboard Shortcuts (view, search, customize). Stored per-workspace in `.emdenv/settings.emd` with global defaults fallback.

### Storage Adapter
The interpreter NEVER touches files directly. The host environment injects a `StorageProvider` with read, write, list, watch, exists, mkdir, delete, rename operations.

Providers: TauriStorage (native fs via Tauri IPC), RustStorage (std::fs injected into wry WebView), BrowserStorage (OPFS — persistent across sessions, 10-20% of disk), MemoryStorage (in-memory, reset on refresh — for standalone HTML).

OPFS bridge: import files via file picker dialog, export via download. Tauri: native file dialogs for open/save. File watcher detects external changes, prompts to reload.

### Keyboard Shortcuts
Cmd+K Cmd+S: shortcuts overlay (searchable, categorized, shows conflicts). Every shortcut is rebindable: click shortcut → press new key combo.

## Integration
**Block Engine**: Workspace wraps BlockManager in tab/file shell.
**EMD Core**: Storage adapter feeds files to parser. File watcher triggers re-parse.
**AI Integration**: Chat panel in right side panel. Agent runner in bottom panel.
**Distribution**: Storage adapter enables all 4 targets.

## Known Limitations
- OPFS storage limited per origin
- MemoryStorage lost on refresh
- Split view: horizontal only (no vertical grid)
- File explorer: no drag-to-rename

## V2
- Vertical/2x2 split grid
- Workspace presets (save/load tab layouts)
- Cloud storage provider (GitHub, S3)
