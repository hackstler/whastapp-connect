---
paths:
  - "src/infrastructure/**/*.ts"
  - "src/application/**/*.ts"
---

# Security Requirements

## Secrets & Credentials

- NEVER hardcode secrets, API keys, tokens, or passwords
- NEVER commit `.env` files — only `.env.example` with dummy values
- Access secrets via typed config service, never `process.env` directly in business logic

## Input Validation

- Validate ALL external input at the infrastructure boundary before it reaches the domain
- Use a schema validation library (Zod, Valibot) on all HTTP request bodies, query params, and path params
- Reject unknown fields — do not pass-through unvalidated data

## Auth & Authorization

- Check authorization inside use cases — not only at the HTTP layer
- Never trust client-provided IDs for ownership checks without verification
- Tokens must be validated for signature, expiry, and issuer

## SQL / DB

- NEVER concatenate user input into raw SQL — use parameterized queries or query builders
- All DB writes must go through repository ports — no raw queries in use cases

## Logging

- NEVER log passwords, tokens, PII, or full request bodies in production
- Sanitize errors before returning to clients — no stack traces in API responses
