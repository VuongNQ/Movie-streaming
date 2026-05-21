---
description: "Use when planning or implementing Firestore schema and role-behavior migrations. Defines backward-compatible rollout, dual-read/dual-write strategy, verification, and rollback requirements for Movie-streaming."
applyTo: "{admin-dashboard/**,android-app-tv/**,extension/**,extensions/**,firebase/**,firestore.rules,firestore.rules.*,README.md,**/*migration*,**/*migrate*}"
---

# Firestore Migration And Compatibility Standards

## Purpose
Use this instruction for any data model evolution, enum extension, field rename, timestamp format change, or role behavior change.

## Migration Principles
- Prefer additive changes before destructive changes.
- Keep backward compatibility across app versions during rollout.
- Separate schema introduction, data backfill, and cleanup into distinct phases.
- Never assume all clients are upgraded at once.

## Required Migration Plan Sections
Every migration proposal must define:
- objective and affected collections/fields;
- compatibility strategy for old and new clients;
- rollout phases and success metrics;
- rollback trigger and rollback steps;
- test and validation checklist.

## Rollout Pattern
### Phase 1: Introduce
- Add new fields/enums without removing old ones.
- Update readers to support both old and new format.
- Keep writes compatible with current production readers.

### Phase 2: Dual Write
- Write both legacy and new representation when needed.
- Mark source-of-truth field clearly in code and docs.
- Monitor consistency between both representations.

### Phase 3: Backfill
- Run idempotent backfill jobs in small batches.
- Log progress, failures, and retry counts.
- Re-run safely without creating duplicates.

### Phase 4: Cutover
- Switch readers to new source of truth after verification.
- Keep guarded fallback for one release window where practical.

### Phase 5: Cleanup
- Remove legacy writes first, then legacy reads.
- Drop legacy fields only after confirming no active dependency remains.

## Schema And Role Change Guardrails
- Any role behavior change must be reflected in Firestore rules and tests in the same change cycle.
- Keep enum value additions non-breaking; never repurpose existing enum semantics.
- Preserve unknown metadata keys during transforms unless explicitly deprecated.
- For timestamp transitions, support Firestore Timestamp and ISO boundary conversion during migration window.

## Execution Safety
- Use dry-run mode where possible before mutating data.
- Use throttled/batched writes to avoid quota spikes.
- Record migration checkpoints for resume capability.
- Ensure each operation is idempotent.

## Verification Requirements
Before completion, verify:
- record counts expected vs migrated;
- random sample integrity for critical fields;
- role/permission behavior remains correct;
- no client-visible regression in read/write paths.

## Rollback Requirements
- Define rollback condition thresholds (error rate, data mismatch, auth failures).
- Keep reversible transforms until completion confidence is established.
- Document exact rollback commands or scripts and expected restoration outcome.

## Documentation Sync
When a migration changes contracts, update in same PR:
- project-data-contract instruction;
- firestore-security instruction if access/policy changed;
- README or technical notes for new canonical fields.
