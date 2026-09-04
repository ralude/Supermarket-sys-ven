---
name: generate-prp
description: Generate a context-rich execution PRP for a Cullen specification or sub-phase plan. Research only; do not implement product code.
disable-model-invocation: true
---

# Generate Cullen PRP

Input specification or plan:

$ARGUMENTS

## Objective

Transform the supplied Cullen specification/plan into an implementation-ready
PRP with enough context for a coding agent to execute it with minimal rediscovery.

The PRP is an execution artifact, not a source of truth.

Priority of authority:

1. AGENTS.md
2. accepted ADRs and architecture documentation
3. official cronograma and sub-phase specification/plan
4. PRP

If they conflict, the higher-level source wins.

## Process

1. Read `AGENTS.md` completely.
2. Read `CLAUDE.md`.
3. Read `docs/cronograma/README.md`.
4. Read the supplied specification/plan completely.
5. Verify the phase/sub-phase is allowed to proceed.
6. Read `docs/architecture/README.md`.
7. Follow the mandatory-reading table in AGENTS.md and read only the architecture
   documents and ADRs relevant to this change.
8. Inspect `git status` and the current implementation.
9. Search the codebase for the closest existing domain, application, persistence,
   transport, UI and test patterns.
10. If the feature is already partially implemented, establish the actual baseline
    and plan only the remaining work.
11. Use external documentation only when behavior of an external library/API needs
    verification.

Do not implement application code during this skill.

## Context discipline

Prefer precise references over copying large amounts of code.

Reference:

- exact file paths
- symbols/classes/functions
- existing test patterns
- relevant invariants
- relevant ADR decisions

Do not paste entire source files or large documentation sections into the PRP.

## Required PRP structure

Create `PRPs/<phase-or-feature>-<slug>.md`.

It must contain:

# Goal

# Source specification

# Current baseline

What already exists and what remains.

# Scope

# Out of scope

# Architectural constraints

# Domain invariants

# Relevant existing patterns

For every important reference include:

- file path
- symbol/pattern
- why it matters

# Files expected to change

Classify as:

- CREATE
- MODIFY
- VERIFY ONLY

Do not invent files unnecessarily.

# Outside-in implementation sequence

Break implementation into small observable slices.

For each slice include:

1. expected behavior
2. test to write/change first
3. implementation area
4. validation command

# Persistence/migration impact

If applicable.

# HTTP/contracts/UI impact

If applicable.

# Permissions/security impact

If applicable.

# Failure modes and edge cases

# Validation gates

Prefer targeted tests while implementing.

Final mandatory validation:

pnpm pipeline

# Documentation/cronograma updates

# Acceptance criteria

Map every acceptance criterion back to the source specification.

# Blockers / unresolved decisions

If a business or architectural decision is missing, explicitly mark it as a blocker.
Never invent a default to unblock implementation.

# Confidence

High / Medium / Low, with a short reason.

## Final check

Before finishing the PRP verify:

- no future phase was pulled forward
- no unnecessary dependency was introduced
- existing architectural patterns are reused where appropriate
- all source acceptance criteria are covered
- validation commands are executable
- referenced files actually exist
