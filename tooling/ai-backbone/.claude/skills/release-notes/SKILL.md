---
name: release-notes
description: Generate structured release notes from git log between two refs. Use when preparing a release, creating a changelog entry, or when /release-notes is invoked.
disable-model-invocation: true
allowed-tools: Bash(git *)
argument-hint: "[from-tag] [to-ref]"
---

# Release Notes

Generate release notes from commits between `$ARGUMENTS[0]` and `$ARGUMENTS[1]` (defaults to `HEAD`).

## Steps

1. Get commits:

```bash
git log $ARGUMENTS[0]..$ARGUMENTS[1] --pretty=format:"%s" --no-merges
```

2. Classify each commit by conventional commit type
3. Group and output in this format:

```markdown
## [version] — YYYY-MM-DD

### Features
- <description> (<short-sha>)

### Bug Fixes
- <description> (<short-sha>)

### Performance
- <description> (<short-sha>)

### Breaking Changes
- <description> (<short-sha>)

### Internal
- <description> (<short-sha>)
```

## Rules

- Omit `chore`, `docs`, `ci` commits from user-facing sections — group them under Internal
- Keep descriptions concise — rewrite if the original commit message is unclear
- Breaking changes section only if `!` commits exist
- Short SHA = first 7 characters
