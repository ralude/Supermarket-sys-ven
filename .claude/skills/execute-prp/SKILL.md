---
name: execute-prp
description: Execute an approved Cullen PRP using the project's outside-in workflow and validation gates.
disable-model-invocation: true
---

# Execute Cullen PRP

PRP:

$ARGUMENTS

## Authority

The PRP does not override project documentation.

Priority:

1. AGENTS.md
2. accepted ADRs / architecture docs
3. cronograma + official specification/plan
4. PRP

## Preparation

Before editing:

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read the supplied PRP completely.
4. Read its source specification.
5. Read every MUST READ reference identified by the PRP.
6. Inspect `git status`.
7. Inspect the current implementation because the codebase may have changed since
   the PRP was generated.

If the PRP is materially stale, reconcile it with the authoritative sources before
implementing.

If implementation requires a missing business or architectural decision, stop that
part of the work and report the blocker. Do not invent policy.

## Execution

Follow the PRP in small outside-in slices.

For each slice:

1. establish observable expected behavior
2. write or modify the test first
3. confirm the test represents the required behavior
4. implement the minimum production change necessary
5. run the targeted test
6. fix failures
7. continue to the next slice

Respect existing architecture and patterns.

Do not:

- expand scope
- perform opportunistic refactors
- implement future phases
- add speculative abstractions
- add dependencies without concrete necessity
- change accepted architectural decisions implicitly
- weaken tests to make them pass

## Validation

Run targeted tests throughout implementation.

Before declaring completion:

pnpm lint
pnpm typecheck
pnpm test

Prefer:

pnpm pipeline

The implementation is not complete while required validation fails.

## Completion

After validation:

1. update the affected sub-phase checklist
2. update cronograma indexes if required
3. update architecture/ADR documentation only when a decision or contract changed
4. re-read the PRP and source specification
5. verify every acceptance criterion

Report:

- phase/sub-phase
- files changed
- behavior implemented
- tests executed
- final validation result
- remaining limitations/blockers
- documentation updated
