# Code Style

## TypeScript

- Strict mode always: `strict: true` in `tsconfig.json`
- No `any` — use `unknown` with type guards or `never` for exhaustive checks
- Prefer `type` over `interface` for object shapes; use `interface` only for public API contracts meant to be extended
- Use `infer`, `keyof`, mapped types, and conditional types over manual duplication
- Use `satisfies` operator to validate shapes without widening
- Return types must be explicit on public functions/methods
- Use `readonly` arrays and properties in domain objects
- Enums are forbidden — use `as const` union types instead

```typescript
// ❌
enum Status { Active = 'active', Inactive = 'inactive' }

// ✅
const Status = { Active: 'active', Inactive: 'inactive' } as const;
type Status = typeof Status[keyof typeof Status];
```

## Functions & Classes

- Max function body: 30 lines — extract helpers if exceeded
- Single responsibility: one reason to change per function/class
- Constructor injection only — no service locators or global singletons
- No static mutable state

## Error Handling

- All async paths must handle errors — no fire-and-forget Promises
- Use typed error classes:

```typescript
// ✅
class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
  }
}
```

## Imports

- No default exports
- Named exports only
- Barrel files (`index.ts`) per layer for public surface
- No circular imports across layers
