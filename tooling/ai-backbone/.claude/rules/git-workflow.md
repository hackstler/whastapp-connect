# Git Workflow

## Branch Naming

```
feat/<ticket-id>-short-description
fix/<ticket-id>-short-description
chore/<short-description>
docs/<short-description>
refactor/<short-description>
```

## Conventional Commits

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `ci`

```
feat(auth): add JWT refresh token rotation
fix(users): correct null check on email validation
chore(deps): bump typescript to 5.4
refactor(payments): extract charge strategy pattern
```

- Subject line max 72 chars
- Use imperative mood: "add" not "added"
- Breaking changes: add `!` after type → `feat(api)!: remove v1 endpoints`
- No period at end

## PR Rules

- One PR per feature/fix
- Squash commits before merge (keep history clean)
- PR title must follow conventional commit format
- Link ticket in PR description
- No self-approvals

## Protected Branches

- `main` — production, merge only via PR with approval
- `develop` — staging, merge via PR
- Direct push to `main` or `develop` is forbidden
