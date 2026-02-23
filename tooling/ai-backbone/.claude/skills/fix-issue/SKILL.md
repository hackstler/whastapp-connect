---
name: fix-issue
description: Fix a GitHub issue end-to-end — read the issue, plan the fix, implement, and commit. Use when asked to fix an issue by number or when /fix-issue is invoked.
disable-model-invocation: true
allowed-tools: Bash(gh *), Bash(git *), Bash(pnpm *), Read, Write, Glob, Grep
argument-hint: "[issue-number]"
---

# Fix Issue $ARGUMENTS

## Steps

1. Read the issue:

```bash
gh issue view $ARGUMENTS
```

2. Understand scope — identify affected files using Grep and Glob
3. Create a branch:

```bash
git checkout -b fix/$ARGUMENTS-$(gh issue view $ARGUMENTS --json title -q '.title' | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | head -c 40)
```

4. Plan the fix — explain in 2-3 sentences what will change and why
5. Implement the fix following `.claude/rules/` conventions
6. Run checks:

```bash
pnpm typecheck && pnpm lint
```

7. Fix any errors, then commit using `/commit`
8. Open PR:

```bash
gh pr create --title "fix(<scope>): <description>" --body "Closes #$ARGUMENTS"
```

## Constraints

- Only fix what the issue describes — no scope creep
- Follow architecture layer rules strictly
- If the fix requires changes in multiple layers, proceed layer by layer: domain → application → infrastructure
