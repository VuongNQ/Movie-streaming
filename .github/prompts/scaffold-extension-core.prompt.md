---
description: "Scaffold core Chrome extension files quickly for m3u8 capture flows: manifest, service worker, popup UI, and storage module."
mode: ask
---

# Scaffold Extension Core Files

Generate a minimal, working Chrome Extension (Manifest V3) scaffold for m3u8 link capture from the active tab network.

## Inputs
- Target folder: ${input:targetFolder:extension|extensions|chrome-extension}
- File format: ${input:fileFormat:javascript|typescript}
- Popup mode default: ${input:popupMode:latest|history}
- History max size: ${input:historyMax:5}
- Capture strategy: ${input:captureStrategy:chrome.debugger}

## Files to Generate
1. manifest.json
2. background/service-worker file
3. popup HTML + popup script
4. storage module for latest/history state

## Required Behaviors
- Service worker captures m3u8 links only for the active tab in the current window.
- URL filtering must match `.m3u8` in path or query, with optional content-type fallback.
- Duplicate URLs are ignored.
- Popup shows current state and includes a `Copy link` action with feedback.
- Popup supports configurable mode:
  - latest: show only latest link
  - history: show capped latest-first list
- State survives service worker restart using extension storage.

## Manifest and Permissions Rules
- Manifest must be MV3.
- Include only minimal required permissions.
- Scope host permissions narrowly.
- Keep debugger attach/detach lifecycle explicit.

## Output Format
Return in this order:
1. File tree
2. Full content for each generated file
3. Setup steps to load unpacked extension
4. Quick verification checklist for capture and copy behavior

## Guardrails
- Do not include cookie/header/body logging.
- Do not broaden monitoring beyond active-tab scope unless requested.
- If assumptions are needed, list them before code generation.
