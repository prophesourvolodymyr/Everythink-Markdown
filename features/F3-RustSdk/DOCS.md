# F3-RustSdk — GPUI Native Desktop Editor SDK

The native desktop SDK. Developers add `emd-native = "0.1"` to their Cargo.toml and embed `EmdEditor::new(file)` in their GPUI application to get a full EMD editing experience rendered directly on the GPU through Metal or Vulkan. No browser. No JavaScript. No WASM bridge. The Rust parser from F1-EmdCore is linked directly as a crate dependency, providing native-speed parsing, validation, and serialization without serialization overhead.

## Why a Native SDK Exists

The React SDK serves the web. But web-based editors have inherent limitations: they run in a browser rendering engine with memory constraints, they cannot access the native filesystem directly, they pay the WASM serialization tax on every parse call, and they cannot achieve the sub-millisecond input latency that native GPU rendering provides. A native SDK serves developers building desktop tools, IDE plugins, and performance-critical applications where a webview editor is unacceptable.

GPUI was chosen over other Rust UI frameworks (egui, iced, slint, tauri+webview) because it is the framework that powers Zed — a production-grade code editor handling millions of lines of text at 60fps. GPUI's text system, layout engine, and rendering pipeline have been battle-tested on the exact problem domain (text editing) that EMD requires. The trade-off is that GPUI is pre-1.0, has breaking changes, and currently supports only macOS and Linux. For projects that need Windows support or a stable API, an egui-based alternative may be developed later.

## Architecture

```
F3-RustSdk/
  Fa-GpuiEngine/       GPU text rendering engine. The heart.
  Fb-Components/        Public entities and functions.
  Fc-Playground/        Dev binary. `cargo run --example playground`
  Fd-AiPanel/           AI chat entity. Streaming, apply-edit.
```

Fa-GpuiEngine is the equivalent of Fa-LiveMd in the React SDK but implemented for GPUI's retained-mode entity/element system. Instead of producing CodeMirror Decoration objects, it produces GPUI `AnyElement` trees with `StyledText`, `InteractiveText`, and custom elements. Instead of hiding syntax via `Decoration.replace()`, it constructs `StyledText` runs that exclude the marker character ranges. Instead of embedding widgets via `Decoration.widget()`, it constructs child `AnyElement` instances that participate in GPUI's layout and paint cycles.

Because there is no CodeMirror and no DOM, Fa-GpuiEngine has full control over every pixel. It does not delegate text rendering to a browser engine — it shapes glyphs via GPUI's `TextSystem`, lays out lines via `LineLayout`, and paints them via GPU quad shaders. This gives it the performance characteristics of Zed: 100K+ lines at 60fps, instantaneous scrolling, and zero-latency input handling.

## Key Differences From React SDK

The Rust SDK does not use CodeMirror, the DOM, CSS, or JavaScript. Text editing is implemented through GPUI's `Editor` element (the same one Zed uses) or through a custom text input element built on GPUI's `PlatformInputHandler` trait. Syntax hiding is implemented by constructing `StyledText` runs that only include the visible text ranges — the marker characters are simply not included in the runs. Text styling is applied through GPUI's `TextStyle` and `HighlightStyle` structs. Themes are Rust structs, not CSS variables.

Block widgets in the native SDK implement a `BlockWidget` trait: `fn render(&mut self, content: &str, cx: &mut ViewContext<Self>) → impl IntoElement`. The widget receives the block content as a string and returns a GPUI element tree. This is the same conceptual pattern as Fa6-BlockResolver's widget registry, but in Rust with GPUI types.

The bridge to F1-EmdCore is a direct crate import. There is no WASM, no JSON serialization, no FFI. The `emd_core::parse(source)` function returns a native Rust `EmdDocument` struct that Fa-GpuiEngine walks directly. This eliminates the serialization overhead and memory duplication that the React SDK incurs when passing data across the WASM boundary.

## Dependencies

| Dependency | Why |
|-----------|-----|
| `emd-core` | Parser, validator, serializer, context loader. Direct crate import. |
| `gpui` | GPU-accelerated UI framework. Text rendering, layout, painting. |
| `tokio` | Async runtime for context loading and AI streaming. |
| `reqwest` | HTTP client for AI provider API calls. |

No web dependencies. No npm. No JavaScript. Pure Rust from parser to pixel.

## Status: Not Started

All sub-features planned. Implementation begins after F1-EmdCore's direct crate API is stabilized (the parser is currently exposed primarily through the WASM target; the direct Rust API needs documentation and a public-facing Cargo.toml entry).
