# app-extension

Chrome Extension (Manifest V3) for capturing m3u8 links from the active tab network traffic.

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## Load Unpacked

1. Run `npm run build`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked and select `app-extension/dist`.

## Verify

1. Open a page that streams HLS traffic.
2. Open the extension popup and click Start capture.
3. Confirm detected m3u8 links appear.
4. Switch between latest and history modes.
5. Use Copy link and verify clipboard output.
6. Click Stop capture and confirm no new links are collected.
