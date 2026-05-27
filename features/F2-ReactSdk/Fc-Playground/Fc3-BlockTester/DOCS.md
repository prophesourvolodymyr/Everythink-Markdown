# Fc3-BlockTester — Isolated Block Rendering Debug Tool

A specialized tool for developing individual decoration sub-features. The BlockTester renders a single EMD section in complete isolation, surrounded by controls that toggle each decoration sub-feature on and off, overlay decoration ranges as colored bounding boxes, and measure decoration rebuild time in milliseconds.

The interface has three sections. The top section is the source input: a textarea or monospace editor containing the raw EMD text for a single section. As the user types, the section is parsed and rendered in the preview area below, with the decoration pipeline running on every change. The user can test how Fa1-SyntaxHider handles edge cases in heading syntax, or how Fa3-LinkRenderer resolves a specific link pattern, without loading an entire document.

The middle section is the toggle panel. Each of the eight Fa-LiveMd sub-features (Fa1 through Fa8) has a checkbox toggle. Unchecking a sub-feature removes its decorations from the preview, making it easy to identify which sub-feature is responsible for a visual bug. When all toggles are off, the preview shows raw monospace text — the baseline. Toggle them on one by one to see each layer's contribution.

The preview area renders the section with full decorations. When inspector mode is enabled, each decoration range is outlined with a colored rectangle: hide decorations in red, mark decorations in blue, widget decorations in green, line decorations in orange. Hovering a range shows a tooltip with the decoration type, the responsible sub-feature name, and the byte offsets of the range. This makes it possible to visually debug decoration overlap, incorrect range positioning, and missing decorations.

The bottom section is a performance panel showing the last decoration rebuild time in milliseconds, a running average of the last 10 rebuilds, and a histogram of rebuild times. A "stress test" button rapidly cycles through 100 edge-case inputs and reports the maximum rebuild time.

## Status: Not Started

Built after Fa-LiveMd is functional. The BlockTester accelerates decoration development by providing isolated, instrumented feedback.
