# Fc1-DevApp — Playground Application Shell

A Vite + React application that imports the SDK directly from its source and renders a full workspace environment for visual testing during development. The DevApp is the primary tool for seeing the SDK in action without deploying it to an external application.

The app shell includes a sidebar file explorer that lists sample .emd files from Fc2-SampleFiles, a tab bar for opening multiple documents simultaneously (testing tab switching, dirty indicators, and close behavior), and the main editor area containing an `<EmdEditor>` instance. A toolbar above the editor provides theme switching (dropdown cycling through light, dark, and high-contrast), an AI panel toggle button, an inspector mode toggle that overlays decoration ranges on the editor for debugging, and a block tester launch button that opens the Fc3-BlockTester for the currently focused section.

The DevApp is configurable via a JSON config file so we can test different editor configurations without changing code — toggling the sidebar on/off, enabling or disabling specific toolbar buttons, setting the initial theme, and configuring mock AI responses for testing the chat panel without making real API calls.

Hot Module Replacement via Vite means that any change to any SDK source file — Fa-LiveMd decorations, React components, theme CSS — instantly updates in the DevApp without page reload. This is essential for rapid iteration on visual features where every change needs immediate visual feedback.

## Status: Not Started

Built after Fa-LiveMd and Fb-Components are functional. The DevApp is straightforward scaffolding around the existing components.
