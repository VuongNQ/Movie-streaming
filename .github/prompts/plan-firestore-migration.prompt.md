---
description: "Create a safe Firestore migration plan with backward compatibility, rollout phases, verification, and rollback for Movie-streaming."
mode: ask
---

# Plan Firestore Migration

Create a migration plan for Firestore schema or role-behavior changes in this repository.

## Inputs
- Migration objective: ${input:objective:What is changing?}
- Affected collections/fields: ${input:targets:List paths and fields}
- Deadline or release window: ${input:timeline:Optional}
- Client versions impacted: ${input:clients:admin-dashboard|android-app-tv|app-extension|all}

## Requirements
- Use phased rollout:
  - introduce
  - dual write
  - backfill
  - cutover
  - cleanup
- Ensure backward compatibility for mixed client versions.
- Define idempotent backfill strategy and resume checkpoints.
- Define verification metrics and sampling method.
- Define rollback triggers and exact rollback actions.
- Identify updates needed in docs and related instructions.

## Expected Output
1. Migration design doc with phases and ownership.
2. Risk register with mitigations.
3. Validation checklist for pre, during, and post rollout.
4. Rollback playbook.
5. Optional pseudocode or scripts for backfill execution.

## Guardrails
- Prefer additive changes before destructive changes.
- Never require all clients to upgrade simultaneously.
- Call out any assumptions about current data shape.
- Preserve movie document id alignment and note the current admin-dashboard write path for created_at/last_updated when those fields are affected.
