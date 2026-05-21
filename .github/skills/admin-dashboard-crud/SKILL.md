---
name: admin-dashboard-crud
description: 'Generate or update admin-dashboard CRUD features for movies, users, and devices using React Hook Form, React Query, Zustand auth, and Firestore integration. Use for new manager pages, edit forms, list filters, and mutation flows with role-aware behavior.'
argument-hint: 'Provide entity (movie|user|device), action (create|read|update|delete|full), and target page or route'
user-invocable: true
---

# Admin Dashboard CRUD Workflow

## When To Use
- Add a new CRUD page for movie, user, or device data.
- Refactor existing forms and tables to align with Firestore data contract.
- Add role-aware action gating for admin vs user behavior.
- Add React Query query/mutation hooks and cache invalidation patterns.

## Required Inputs
- Entity: movie, user, or device.
- Action scope: create, read, update, delete, or full CRUD.
- Target path or files in admin-dashboard.
- Validation and permission requirements.

## Procedure
1. Map required fields and enums from the project data contract.
2. Design or update TS types for entity input and persisted shape.
3. Implement or update form with React Hook Form validation rules.
4. Implement Firestore service methods in centralized data layer.
5. Add React Query hooks and cache invalidation strategy.
6. Apply role-aware UI and service checks aligned with security policy.
7. Add loading, empty, and permission-denied states.
8. Add or update tests/checks for critical success and deny paths.

## Quality Checklist
- Field names match Firestore contract exactly.
- Enum values are preserved with no aliases.
- Required fields are validated before write.
- Query keys are stable and invalidation is scoped.
- Permission-denied paths are handled gracefully.

## Output Contract
When invoked, return:
1. implementation plan;
2. concrete file edits;
3. validation and role-check decisions;
4. test/check command suggestions.

## Related Policies
- Follow admin-dashboard architecture and component conventions.
- Follow project data contract and Firestore security role matrix.
- Prefer additive, backward-compatible changes for schema-impacting updates.
