---
description: "Use when designing Firestore queries, indexes, pagination, and read/write cost behavior. Establishes index planning and query conventions for movies, users, devices, reports, and tracking workloads in Movie-streaming."
applyTo: "{admin-dashboard/**,android-app-tv/**,app-extension/**,extension/**,extensions/**,firebase/**,firestore.indexes.json,**/*query*,**/*repository*,**/*firestore*}"
---

# Firestore Indexing And Query Performance Standards

## Purpose
Use this instruction when adding or changing Firestore queries. Optimize for predictable latency and controlled cost.

## Query Design Rules
- Design query shape first, then define index requirements.
- Avoid unbounded collection scans in interactive paths.
- Use explicit where/orderBy combinations that map to known indexes.
- Keep query filters aligned with actual UI access patterns.
- Start from current repository query shapes before adding indexes: admin-dashboard reads movies ordered by title, users ordered by created_at, and devices scoped under users/{uid}/devices without pagination.

## Pagination Requirements
- Use cursor-based pagination for large collections.
- Avoid offset-based pagination in Firestore.
- Always provide deterministic orderBy with pagination cursors.
- Keep stable sort keys to prevent duplicate or skipped records.

## Index Planning
- Track composite index requirements per query in code comments or docs.
- Update firestore.indexes.json with each new query requiring composite index.
- Avoid creating speculative indexes that no path uses.
- Remove obsolete indexes after query removal and verification.
- If firestore.indexes.json does not exist yet, create it in the same change that introduces the first required composite index.

## Collection-Specific Guidance
### movies
- Prioritize indexes for admin list filters (type, year, genre, status if introduced).
- Ensure sort-ready index for title/year based listing and moderation views.

### users and users/{uid}/devices
- Prefer scoped reads by uid and deviceId.
- Avoid global device scans unless truly required for admin diagnostics.
- Keep tracking_history reads bounded by device and recency constraints where possible.

### reports
- Treat reports as an append-heavy log collection with admin-facing filters.
- Add only query-backed composites (for example status + created_at, report_type + created_at, movie_id + created_at).
- Prefer ordering by created_at descending for moderation timelines.
- If admin UI is read-only, avoid adding speculative indexes for write-action workflows that do not exist.

## Cost Control
- Read only required fields where architecture allows projection patterns.
- Cache stable reads in app layer where appropriate.
- Avoid repeated identical queries in tight UI loops.
- Use batched writes for multi-document updates.
- In admin-dashboard, prefer reusing centralized query keys and invalidation in src/lib/queries.ts over ad-hoc duplicate query paths.

## Hot Path Performance Checks
For any new query in user-facing flows, verify:
- expected index exists;
- first-load latency acceptable on emulator and representative network;
- pagination works without duplication gaps;
- no unnecessary read amplification.

## Error Handling And Index Build State
- Handle missing-index errors gracefully in non-production environments.
- Do not ship features that depend on indexes not declared in source control.
- Confirm index deployment completion before production rollout.

## Testing Expectations
- Add tests for repository/query functions using realistic filters.
- Include pagination boundary tests (first page, middle, end, empty state).
- Validate sort order consistency with cursor pagination.

## Change Management
When query patterns change, update together:
- query code;
- firestore.indexes.json;
- this instruction if conventions evolve.
