---
name: commit
description: Generate a conventional commit message from staged changes and create the commit. Use when ready to commit, when asking for a commit message, or when running /commit.
disable-model-invocation: true
allowed-tools: Bash(git *)
---

# Commit

Generate and create a conventional commit from staged changes.

## Steps

1. Run `git diff --staged` to analyze what is staged
2. If nothing is staged, run `git status` and ask the user what to stage
3. Determine the type based on the diff:
   - `feat` — new functionality
   - `fix` — bug fix
   - `refactor` — restructure without behavior change
   - `chore` — tooling, deps, config
   - `docs` — documentation only
   - `perf` — performance improvement
   - `ci` — CI/CD changes
4. Determine scope from the main directory/module changed (e.g., `auth`, `users`, `payments`)
5. Write the subject line: imperative mood, max 72 chars, no period
6. If there are breaking changes, append `!` after type: `feat(api)!:`
7. Create the commit:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<optional body — what and why, not how>
EOF
)"
```

## Rules

- Subject line: imperative mood ("add" not "added"), max 72 chars
- No emojis in commit messages
- Body only if the change needs context beyond the subject
- NEVER include stack traces, debug output, or file lists in the message
