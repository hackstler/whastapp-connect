---
disable-model-invocation: true
---

Scan the entire codebase for TODO, FIXME, HACK, and XXX comments.

Group them by:
1. **Critical** (FIXME, HACK, XXX) — needs immediate attention
2. **Backlog** (TODO) — planned work

For each item output: `file:line — comment text`

At the end, show a count per category.
