# Project Memory

See @README.md for project overview.
See @package.json for available commands (if present).

## Stack & Architecture

- Language: TypeScript (strict mode)
- Architecture: Clean Architecture — Domain / Application / Infrastructure / DTOs
- Patterns: Factory, Strategy, CQRS, Repository
- Runtime: Node.js (check `package.json` `engines` field for version)

## Conventions

- Naming: `PascalCase` for classes/types, `camelCase` for functions/vars, `kebab-case` for files
- No default exports — named exports only
- Barrel files (`index.ts`) per layer
- Imports ordered: external → internal → relative
- No `any` — use `unknown` with type narrowing
- Errors via custom typed error classes extending a base `AppError`

## Common Commands

```bash
pnpm install        # install deps
pnpm dev            # development server
pnpm build          # production build
pnpm lint           # run ESLint
pnpm typecheck      # run tsc --noEmit
```

## Architecture Layout

```
src/
├── domain/         # entities, value objects, domain errors, ports (interfaces)
├── application/    # use cases, DTOs, application services
├── infrastructure/ # adapters, repositories impl, external services
└── shared/         # utils, base classes, type helpers
```

## Rules

See @.claude/rules/code-style.md for coding standards.
See @.claude/rules/architecture.md for architectural constraints.
See @.claude/rules/git-workflow.md for branch and commit conventions.
See @.claude/rules/security.md for security requirements.

## Key Constraints

- NEVER commit secrets, API keys, or `.env` files
- NEVER use `console.log` — use the project logger instead
- ALWAYS run `pnpm typecheck && pnpm lint` before committing
- Domain layer has ZERO external dependencies
