---
paths:
  - "src/**/*.ts"
---

# Architecture Rules

## Layer Boundaries (enforce strictly)

```
domain ← application ← infrastructure
   ↑                          ↓
   └──────── ports (interfaces) ────────┘
```

- `domain/` has ZERO imports from `application/` or `infrastructure/`
- `application/` imports only `domain/` — never `infrastructure/`
- `infrastructure/` implements ports defined in `domain/`
- Cross-layer communication only through interfaces (ports)

## Domain Layer

```
src/domain/
├── entities/         # Aggregate roots and entities
├── value-objects/    # Immutable typed values
├── errors/           # Typed domain errors
├── events/           # Domain events
└── ports/            # Repository and service interfaces
```

- Entities contain business logic — no anemic models
- Value Objects are immutable and validated at construction
- Domain errors extend `DomainError` base class
- No framework imports — pure TypeScript

## Application Layer

```
src/application/
├── use-cases/        # One class per use case
├── dtos/             # Input/Output DTOs (plain objects)
└── services/         # Application orchestration services
```

- Use cases are single-method classes: `execute(dto): Promise<Result>`
- DTOs are plain `type` declarations — no methods, no classes
- No HTTP/DB concerns here

## Infrastructure Layer

```
src/infrastructure/
├── repositories/     # DB implementations of domain ports
├── adapters/         # External service adapters
├── http/             # Controllers, middlewares, routes
└── config/           # App wiring and DI container
```

## CQRS

- Commands mutate state — return `void` or a typed result ID
- Queries read state — return DTOs, never entities directly
- Separate command/query handlers in `application/`
