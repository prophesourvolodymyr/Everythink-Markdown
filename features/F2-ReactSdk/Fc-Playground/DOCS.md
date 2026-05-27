# Fc-Playground — Local Development Preview

The development environment for building and testing the React SDK. Not published. Not included in the npm bundle. Exists solely for us to see the SDK in action while we build it. A Vite + React application that imports `@everthink/react-emd` exactly as an external developer would.

## Sub-sub-features

**Fc1-DevApp** — the main playground application shell. Full workspace layout with file explorer sidebar (listing sample .emd files), tab bar for multiple open documents, and the EmdEditor component in the main area. Toolbar with buttons for theme switching, AI panel toggle, block tester mode toggle, and inspector mode (shows decoration ranges overlaid on the editor for debugging). The app loads on localhost via `npm run dev` with Vite HMR so changes to any SDK source file instantly reflect in the playground.

**Fc2-SampleFiles** — a curated collection of .emd files exercising the full EMD feature surface. One file per section type. One file with every link relation type. One file with every code block tag and valid content. One file with intentionally malformed EMD to test error recovery and diagnostic rendering. One very large file (1000+ sections) for performance testing. These files serve as the manual test suite — open each one and visually verify that all decorations, widgets, and interactions work correctly.

**Fc3-BlockTester** — an isolated block rendering tool. Select a single section from a loaded document, or paste raw EMD text for one section, and it renders with full decorations in an isolated viewport without other sections. Toggle individual sub-features (SyntaxHider, TextStyler, etc.) on and off to isolate visual issues. Overlay decoration ranges as colored rectangles to debug positioning. Measure decoration rebuild time for that specific section. The block tester is the primary tool for developing and debugging individual decoration sub-features.

## Status: Not Started

Built after Fa-LiveMd and Fb-Components are stable. The playground is useless without the SDK working first.
