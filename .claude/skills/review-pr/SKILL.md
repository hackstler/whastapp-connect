---
name: review-pr
description: Review a pull request for correctness, architecture adherence, security, and code quality following project standards. Use when asked to review a PR or code changes.
context: fork
agent: Explore
allowed-tools: Bash(gh *), Read, Grep, Glob
---

# Review PR $ARGUMENTS

## Context

- PR diff: !`gh pr diff $ARGUMENTS`
- PR description: !`gh pr view $ARGUMENTS`
- Changed files: !`gh pr diff $ARGUMENTS --name-only`

## Review Checklist

Analyze the diff and provide structured feedback under these categories:

### Architecture

- Layer boundaries respected (domain has no infra imports)
- Use cases are single-responsibility
- No business logic leaking into infrastructure

### Code Quality

- No `any` types
- Functions under 30 lines
- Named exports only
- Error handling is typed and explicit

### Security

- No hardcoded secrets
- All external input validated at infrastructure boundary
- SQL parameterized — no string concatenation
- No PII in logs

### Correctness

- Edge cases and null paths handled
- Async errors caught
- No race conditions in concurrent logic

## Output Format

```
## PR Review: <title>

### Summary
[1-2 sentence overview of what this PR does]

### 🔴 Critical (must fix before merge)
- [issue] — [file:line] — [suggestion]

### 🟡 Suggestions (consider improving)
- [issue] — [file:line] — [suggestion]

### 🟢 Nice to have (optional)
- [observation]

### Overall
[Approve / Request Changes] — [brief rationale]
```
