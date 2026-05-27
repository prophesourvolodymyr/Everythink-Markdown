# F4-SwiftSdk — SwiftUI Native Editor SDK for Apple Platforms

The native Apple platform SDK. Developers add EmdKit via Swift Package Manager and use `EmdEditorView(file: theme:)` in their SwiftUI applications to get a full EMD editing experience with native text rendering, Apple Pencil support on iPad, Dynamic Type, VoiceOver accessibility, and dark mode integration. The Rust parser from F1-EmdCore is linked as a static library via C FFI or embedded as WASM in a WKWebView bridge.

## Why a Native Swift SDK Exists

Apple platforms have unique capabilities that web-based editors cannot access. Apple Pencil on iPad provides pressure sensitivity and tilt detection — critical for the draw block's freehand tool. Dynamic Type allows users with vision needs to scale text system-wide, and an editor that ignores Dynamic Type feels broken on iOS. VoiceOver requires semantic accessibility metadata that DOM-based editors rarely provide. The native text system (TextKit 2, NSTextView) handles complex scripts, emoji, right-to-left text, and text input methods (Chinese, Japanese, Korean) with correctness that web-based text editors struggle to match.

SwiftUI integration means the editor automatically inherits the host app's navigation patterns, color scheme, font settings, and interaction design. A developer building a macOS documentation app gets an EMD editor that looks and feels like part of their app, not an embedded webview with a different visual language.

## Architecture

```
F4-SwiftSdk/
  Fa-SwiftUIEngine/     NSAttributedString rendering engine. The heart.
  Fb-Components/         SwiftUI views and ObservableObjects.
  Fc-Playground/         Xcode project for dev preview.
  Fd-AiPanel/            SwiftUI chat view. Streaming, apply-edit.
```

Fa-SwiftUIEngine is the equivalent of Fa-LiveMd but for Apple's text stack. It walks the EmdDocument AST and builds NSAttributedString instances with styled attributes, hidden character ranges, and inline text attachments for widgets. The attributed string is displayed in a custom SwiftUI `Text` view or in an NSTextView (for editable sections). This is fundamentally different from both the React SDK (which uses CodeMirror decorations) and the Rust SDK (which uses GPU text rendering).

The bridge to F1-EmdCore can take two forms. Option A is a C FFI static library: the Rust parser is compiled with `cbindgen` to produce a C-compatible header and a `.a` static library that Swift calls directly. The JSON AST is then deserialized into Swift structs. Option B is WASM in a WKWebView: the `@everthink/emd` WASM module is loaded in a hidden webview and Swift calls `evaluateJavaScript("parse('...')")` to get the AST. Option A is faster and has no webview overhead. Option B is simpler to set up and works immediately with the existing WASM package.

## Key Differences From Other SDKs

The most significant difference is the text rendering surface. NSAttributedString is the foundation of all text rendering on Apple platforms. It supports font styling, color, paragraph styles, inline attachments (for images and widgets), and accessibility metadata in a single object. Fa-SwiftUIEngine builds an attributed string from the AST, applying font attributes for headings, bold, and italic; color attributes for links and type badges; and NSTextAttachment objects for inline widgets (checkboxes, status dots) and block widgets (canvas, kanban).

The second difference is Apple Pencil integration for the draw block. On iPad, the canvas widget uses PencilKit (Apple's drawing framework) instead of raw Canvas2D. PencilKit provides pressure sensitivity, tilt detection, palm rejection, and a natural drawing feel that matches Apple Notes and Freeform. The drawing data is serialized to the same JSON format used by the web canvas block, maintaining cross-platform compatibility.

The third difference is accessibility. Every visual element in the SwiftUI SDK carries accessibility labels, hints, and traits. Type badges announce as "Task section" to VoiceOver. Status badges announce as "In progress." The progress bar announces its completion percentage. Links announce their relationship type and target. This accessibility metadata is built into the attributed string and SwiftUI view hierarchy during rendering, requiring no separate accessibility pass.

## Dependencies

| Dependency | Why |
|-----------|-----|
| `libemd.a` (Rust via C FFI) | Parser, validator, serializer. |
| SwiftUI | Declarative UI framework. |
| TextKit 2 / NSTextView | Text layout and editing. |
| PencilKit | Apple Pencil drawing (iPad draw block). |
| WKWebView | Optional: WASM bridge alternative to C FFI. |

## Status: Not Started

Implementation begins after the C FFI bridge for F1-EmdCore is stabilized and the Swift struct definitions mirror the EmdDocument AST.
