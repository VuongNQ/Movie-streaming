---
description: "Use when building or updating a Chrome extension that captures m3u8 links from the active tab network traffic and provides show/copy actions in the UI. Covers MV3 architecture, permissions, and UX behavior."
name: "Chrome Extension m3u8 Capture"
applyTo: "{extension/**,extensions/**,chrome-extension/**}"
---
# Chrome Extension m3u8 Capture Guidelines

- Build for Manifest V3 with a background service worker as the network listener boundary.
- Use `chrome.debugger` with DevTools Network events as the primary capture mechanism for tab-scoped traffic monitoring.
- Capture m3u8 URLs only from the current active tab in the current window.
- Prefer deterministic filtering rules for HLS URLs:
  - Match URLs containing `.m3u8` in pathname or query string.
  - Optionally allow known HLS content types (for example `application/vnd.apple.mpegurl` and `application/x-mpegURL`) when URL suffix is missing.
  - Ignore non-http(s) schemes and extension-internal requests.
- Do not collect links from inactive tabs, other windows, or browser-wide traffic unless the user explicitly enables broader scope.

- Required UX behavior in popup/options UI:
  - Provide a configurable display mode:
    - `latest`: show only the latest detected m3u8 link.
    - `history`: show latest first with a short capped list (for example top 5 unique links).
  - Include a dedicated `Copy link` action that writes to clipboard and reports success/failure feedback.
  - Provide a clear empty state when no m3u8 link has been detected.

- Required extension wiring:
  - `manifest.json` must include only the minimum permissions needed for tab-scoped monitoring.
  - Keep host permissions scoped as narrowly as possible.
  - Keep debugger attach/detach lifecycle explicit so capture starts and stops with user intent.
  - Use message passing between popup and service worker for data retrieval and updates.
  - Avoid injecting page scripts unless strictly required for the capture strategy.

- Reliability and safety:
  - Deduplicate identical URLs to avoid noisy UI updates.
  - Handle service worker restarts by restoring last known link from extension storage when appropriate.
  - Never log sensitive headers, cookies, or request bodies.
  - Keep error handling user-visible for copy failures and listener attach failures.

- Code quality:
  - Separate capture logic, state/storage logic, and UI rendering into distinct modules.
  - Add lightweight tests for URL filtering and deduplication logic when a test harness exists.
  - Document setup and verification steps in the extension README (how to trigger capture and verify copy behavior).
