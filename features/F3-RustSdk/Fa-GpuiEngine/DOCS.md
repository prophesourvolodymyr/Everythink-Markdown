# Fa-GpuiEngine — GPU Text Rendering Engine

The live preview engine for the GPUI native desktop SDK. This is the equivalent of Fa-LiveMd in the React SDK, but implemented for GPUI's retained-mode entity and element system. It transforms the EmdDocument AST into a tree of GPUI elements that render styled text, type badges, status indicators, interactive block widgets, and inline controls directly on the GPU through Metal or Vulkan.

## How It Differs From the React Live Preview Engine

The most fundamental difference is the absence of a DOM. In the React SDK, decorations are applied to an existing text editor's DOM tree. In the GPUI SDK, there is no underlying text editor that decorations modify — the engine owns the entire rendering pipeline from AST to pixels. This means Fa-GpuiEngine does not "hide" syntax markers — it simply does not render them. The GPUI element tree only includes the visible text spans, badges, and widgets. The raw EMD source text is stored separately as the document model and is accessed when the user enters edit mode.

The second major difference is retained mode versus immediate mode. The React SDK's ViewPlugin is called on every frame and recomputes decorations from the syntax tree. GPUI's retained mode means that elements only re-render when their state changes. Fa-GpuiEngine sets up the initial element tree from the AST and then listens for document change events to update only the changed sections. This is more CPU-efficient for large documents because unchanged sections do not re-render.

The third difference is the text editing surface. In the React SDK, the user edits text through CodeMirror 6, which handles cursor positioning, selection, undo, copy/paste, and keyboard input. In the GPUI SDK, text editing is handled by the engine itself through GPUI's `Editor` element (from the Zed codebase) or through a custom implementation built on `PlatformInputHandler`. Fa-GpuiEngine manages the transition between "view mode" (styled text with hidden markers) and "edit mode" (raw EMD text in a monospace editor) — conceptually similar to Obsidian's source mode and live preview mode, but with instantaneous GPU-accelerated transitions rather than DOM swaps.

## Sub-sub-features

**Fa1-SyntaxHider** — does not "hide" syntax in the traditional sense. Instead, it constructs the GPUI element tree so that only the visible text ranges appear. Marker characters (`##`, `**`, `*`, ` `` `, `[]`, `()`) are excluded from the `StyledText` runs. The raw text containing the markers is preserved in the document model for editing. When the user clicks on a styled heading to edit it, the element swaps from a styled text display to a monospace editor showing the raw `## Heading` text with the markers visible.

**Fa2-TextStyler** — maps EMD AST node types to GPUI `TextStyle` and `HighlightStyle` values. Bold nodes map to `FontWeight(700)`. Italic nodes map to `FontStyle::Italic`. Heading nodes map to specific font sizes and weights defined in the theme. Code spans map to `FontFamily::Monospace` with a subtle background highlight. Blockquotes map to a left border element. All style values come from the `Theme` struct rather than CSS variables.

**Fa3-LinkRenderer** — creates `InteractiveText` elements for wiki-links, semantic links, and standard markdown links. The interactive text responds to clicks with navigation callbacks, hover with popover display, and right-click with context menus. Link resolution uses F1-EmdCore's ContextLoader directly (no WASM bridge), querying the EmdIndex for target file metadata.

**Fa4-StatusBadge** — renders colored status indicators using GPUI `div` elements with rounded corners, background colors from the theme, and text labels. The status is read from the EmdSection struct. Click handlers dispatch status change actions that write back to the document model.

**Fa5-TypeBadge** — renders section type labels using the same div-based approach as status badges. Each of the 24 section types has a distinct color defined in the theme struct. Right-click opens a context menu for type conversion.

**Fa6-BlockResolver** — replaces code block regions with GPUI elements implementing the `BlockWidget` trait. A widget is a GPUI entity that receives block content and returns an element tree. Widgets are registered via a type-erased registry mapping tag strings to entity constructors. The registry is global per application instance.

**Fa7-InlineWidgets** — renders checkboxes, progress bars, and approval buttons as GPUI elements positioned inline with text. Checkboxes use GPUI's interactive element system for click handling. Progress bars use GPUI's layout system with a filled and unfilled portion. Changes are written back to the document model through action dispatches.

**Fa8-ThemeEngine** — defines the `Theme` struct containing all color, font, and spacing values. Three preset themes are provided: `Theme::light()`, `Theme::dark()`, `Theme::high_contrast()`. Custom themes are created by constructing a `Theme` struct with custom values. The active theme is stored as a global GPUI resource and accessed by all sub-features through the GPUI context. Theme switching is instantaneous because GPUI's rendering pipeline re-draws the current frame with the new theme values.

## Edit Mode Integration

The transition between view mode and edit mode is a critical design decision. In view mode, sections render as styled text without markers. In edit mode, the clicked section swaps to a monospace text editor showing the raw EMD source with all markers visible. The editor element is a GPUI `Editor` (or custom text input) that supports syntax highlighting for EMD, standard editing keybindings, undo/redo, and selection. When the user presses Escape or clicks outside the editor, the content is parsed by F1-EmdCore and the view mode element tree is regenerated. This provides the same "click to edit" experience as Obsidian's Live Preview but rendered on the GPU.

## Status: Not Started

Implementation begins after the GPUI text system and editor element APIs stabilize. The concepts are proven in the React SDK's Fa-LiveMd; the GPUI implementation adapts them to native rendering.
