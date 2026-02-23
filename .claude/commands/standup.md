---
disable-model-invocation: true
allowed-tools: Bash(git *)
---

Generate a standup summary from today's git activity.

Run: `git log --since="yesterday 6pm" --until="now" --author="$(git config user.name)" --oneline`

Format the output as:

**Yesterday / This morning:**
- [bullet per commit, grouped by scope if using conventional commits]

**In progress:**
- [infer from the last commit and any uncommitted changes in `git status`]

Keep it concise — standup format, not a changelog.
