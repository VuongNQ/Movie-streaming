---
description: "Review Firestore query patterns and propose required indexes, pagination strategy, and cost/performance improvements for Movie-streaming."
mode: ask
---

# Review Firestore Index Needs

Analyze the repository query patterns and produce an actionable index and performance plan.

## Inputs
- Changed queries or feature area: ${input:featureArea:Optional}
- Priority collection: ${input:collection:movies|users|devices|all}
- Target latency goal: ${input:latencyGoal:Optional}

## Requirements
- Identify query shapes and required composite indexes.
- Highlight missing indexes that can block production behavior.
- Recommend cursor-based pagination where needed.
- Flag unbounded scans and read-amplification risks.
- Propose cost-control improvements and caching opportunities.
- Suggest updates to firestore.indexes.json.
- If the current query shapes do not need composite indexes, say so explicitly instead of proposing speculative indexes.
- Account for the current admin-dashboard query layer: movies ordered by title, users ordered by created_at, devices fetched per user.

## Expected Output
1. Table of query patterns mapped to index requirements.
2. Proposed firestore.indexes.json changes.
3. Risk list for hot paths and remediation steps.
4. Test checklist for pagination and ordering consistency.

## Guardrails
- Do not propose offset-based pagination for Firestore.
- Avoid speculative indexes with no query consumer.
- Separate must-have indexes from optional optimizations.
- If firestore.indexes.json is absent, create recommendations for a new file only when a real composite index is required.
