# Movies Crawler

Starter crawler implementation for multi-site movie ingestion with Playwright and Firestore.

## Features
- direct mode from a local `movies.json` file
- discovery mode from list pages using DOM selectors or site API adapters
- bounded concurrency with `CONCURRENCY_LIMIT = 3`
- `.m3u8` interception with listener-before-click ordering
- Firestore upsert flow for `movies`
- existing-movie updates refresh only the current domain stream entry and `last_updated`

## Setup
1. Run `npm install` in this folder.
2. Install the Playwright browser used by this crawler with `npm run playwright:install`.
3. Authenticate Firebase Admin with one of these options:
   - set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON path
   - or set `FIREBASE_SERVICE_ACCOUNT_PATH` to a service account JSON path
4. Optional env vars:
   - `FIREBASE_PROJECT_ID` (or `FIRESTORE_PROJECT_ID`) for explicit project selection
   - `FIRESTORE_DATABASE_ID` defaults to `moviestreaming`
   - `CRAWLER_HEADLESS` defaults to `true`

## Playwright CLI
- Show Playwright CLI help: `npm run playwright -- --help`
- Install Chromium for the crawler: `npm run playwright:install`
- Record selectors and interactions for a target page: `npm run playwright:codegen -- https://motphim.film`
- Open a page in Playwright's headed browser for quick inspection: `npm run playwright:open -- https://tvhay.best`
- Use `codegen` to refine per-site selectors such as movie cards, detail fields, and watch buttons before updating `src/adapters.js`

## Inputs
- `movies.json`: array of movie URLs for direct mode
- `pages.json`: array of page/list URLs for discovery mode

## Run
- direct mode: `npm run crawl -- --input-mode=direct --site=motphim.film --input=./movies.json`
- discovery mode: `npm run crawl -- --input-mode=discovery --site=tvhay.best --input=./pages.json`

## Notes
- Site selectors and API details are starter placeholders and should be refined per target site.
- New movies are created with safe defaults when full metadata is unavailable.
- Existing movies are matched by exact `id` when provided, otherwise by exact `title_raw`.
