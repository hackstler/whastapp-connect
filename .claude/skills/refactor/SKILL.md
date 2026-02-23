---
name: refactor
description: Refactor code to improve design without changing behavior — extract patterns, apply SOLID, reduce duplication. Use when asked to refactor, clean up, or improve code structure.
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Grep, Bash(pnpm typecheck), Bash(pnpm lint)
argument-hint: "[file-or-directory]"
---

# Refactor $ARGUMENTS

## Approach

1. Read the target file(s) — understand the full context before touching anything
2. Identify the primary issue: duplication / large function / wrong abstraction / missing pattern / layer violation
3. State what will change and why in 1-2 sentences — confirm before proceeding
4. Apply one focused change at a time:
   - Extract function → verify behavior is preserved
   - Move to correct layer → update imports
   - Apply pattern → replace all call sites
5. After each change: `pnpm typecheck && pnpm lint`
6. If TypeScript errors appear, fix them before continuing

## Patterns to Apply

- **Strategy**: replace `if/switch` on type → inject behavior via interface
- **Factory**: replace `new ConcreteClass()` in application → factory function/class
- **Repository**: raw DB calls in use cases → extract to port + implementation
- **Value Object**: primitive obsession in domain → typed value object with validation

## Rules

- Behavior MUST remain identical — this is not a feature
- No new dependencies introduced without discussion
- Domain layer stays pure — no framework imports
- One concern per extraction
