---
name: movies-crawler
description: 'Generate or update a multi-site movie crawler tool using Node.js and Playwright. Use when building crawler scripts for motphim.film, tvhay.best, or similar sites, collecting movie lists from DOM or API, intercepting m3u8 streams, and writing/updating Firestore movie stream data by domain.'
argument-hint: 'Provide target sites, input mode (direct|discovery), and whether to create new crawl code or update an existing crawler'
user-invocable: true
---

# Movies Crawler Workflow

## When to Use
- Build a new movie crawler script for one or more streaming sites.
- Add support for a new site adapter such as motphim.film or tvhay.best.
- Implement or refactor movie-list discovery from listing pages via DOM or API.
- Add Playwright-based stream interception for m3u8/HLS links.
- Update Firestore persistence so existing movies refresh only the current domain stream entry.

## Required Inputs
- Target sites or domains.
- Input mode: direct movie URLs or discovery from list pages.
- Expected output: new crawler implementation, adapter update, or refactor.
- Firestore write expectation: create missing movie docs, update existing movie stream entries, or both.
- Any known selectors, API endpoints, watch button selectors, or pagination rules.

## Procedure
1. Identify the supported domains and define a hostname-based site adapter map.
2. For each adapter, define:
   - list-page DOM selectors or API endpoint config;
   - movie detail URL extraction and normalization;
   - detail-page selectors for metadata;
   - watch-button selector and any redirect expectations;
   - server name mapping derived from the domain or adapter name.
3. Support two input modes:
   - direct mode from a local `movies.json` file;
   - discovery mode from page/list URLs using DOM parsing or site APIs.
4. Process URL tasks with bounded concurrency using `CONCURRENCY_LIMIT = 3` by default, and avoid unbounded `Promise.all`.
5. For each URL task, open a new isolated Browser Context / Page inside the bounded worker slot, wait for `networkidle`, and always clean up the page/context in `finally`.
6. Extract movie metadata from the DOM, with API-first fallback when the adapter provides more stable metadata than the page markup.
7. Register `page.on('response', ...)` before clicking the watch button, resolve a promise on the first `.m3u8` response, and await it with the click using `Promise.all([waitForM3u8Promise, page.click(WATCH_BUTTON_SELECTOR)])`.
8. If no `.m3u8` response arrives within `M3U8_TIMEOUT_MS = 15000`, log a warning, treat the stream as missing for that crawl, and continue without throwing.
9. Verify CORS carefully inside `page.evaluate()`:
   - treat `TypeError: Failed to fetch` with no response as CORS-blocked;
   - treat any returned HTTP status, including 4xx, as CORS-accessible;
   - document that null-origin checks can produce false positives depending on browser behavior.
10. Normalize successful stream capture into the project `stream_connections` shape:
    - `server_name` from the current domain or adapter name;
    - `link` as the captured m3u8 URL;
    - `type` and `status` aligned with the project data contract;
    - provider-specific facts inside `metadata`.
11. Persist to Firestore `movies` using the project movie contract:
    - when the movie does not exist, create the document with canonical movie fields;
    - when the movie already exists, update only the matching `stream_connections` entry for the current domain and refresh `last_updated`;
    - preserve existing movie metadata unless the current crawl provides a better canonical value.
12. Use the project's existing DB write boundary or Firestore client conventions, and keep document IDs aligned with the stored `id` field.
13. Protect the crawl loop with `try...catch...finally` so one failed movie or one failed domain does not stop the full run.

## Quality Checklist
- Concurrency is explicitly bounded and not implemented with unbounded parallelism.
- Site-specific selectors and API rules are isolated in adapters.
- Discovery mode supports DOM extraction or API collection.
- m3u8 interception listener is registered before click/navigation.
- Timeout handling exists when no stream URL is captured.
- CORS verification distinguishes blocked fetches from ordinary HTTP failures.
- Firestore writes target the canonical `movies` schema.
- Existing movies update only the stream entry for the current domain and set `server_name` correctly.

## Output Contract
When invoked, return:
1. implementation plan;
2. concrete crawler/adaptor/file edits;
3. Firestore update strategy for new vs existing movies;
4. validation steps or run commands.

## Related Policy
- Follow the crawler requirements in `.github/instructions/movies-crawler.instructions.md`.
- Follow the canonical Firestore movie schema and stream contract used by this repository.
