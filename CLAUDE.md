# whatsapp-rag

WhatsApp listener que captura mensajes del chat "Message Yourself" y los envía a un backend RAG via HTTP.

## Stack & Architecture

- Language: TypeScript (strict mode)
- Runtime: Node.js >= 18
- Architecture: Clean Architecture — Domain / Application / Infrastructure
- WhatsApp: whatsapp-web.js + Puppeteer (Chromium headless)
- HTTP server: Hono + @hono/node-server (health check)
- HTTP client: native fetch (Node.js 18+)
- Dedup cache: lru-cache (in-memory LRU)
- Config validation: Zod

## Common Commands

```bash
pnpm install        # instalar dependencias
pnpm dev            # desarrollo con hot-reload (tsx watch)
pnpm build          # build producción (tsc)
pnpm start          # ejecutar build producción
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
```

## Source Layout

```
src/
├── domain/
│   ├── entities/       # WhatsAppMessage (tipo inmutable)
│   └── ports/          # IngestPort, DedupPort (interfaces)
├── application/
│   └── use-cases/      # ProcessMessageUseCase
├── infrastructure/
│   ├── cache/          # LruDedupCache (implementa DedupPort)
│   ├── http/           # RagIngestAdapter (implementa IngestPort) + Hono health server
│   └── whatsapp/       # WhatsAppListenerClient (escucha eventos)
└── shared/
    ├── config.ts       # Config tipado desde env con Zod
    ├── logger.ts       # Logger estructurado JSON (stdout/stderr)
    └── errors/         # AppError base class
```

## Key Env Vars

| Variable | Default | Descripción |
|----------|---------|-------------|
| `INGEST_URL` | — | URL del endpoint RAG (**requerido**) |
| `SESSION_PATH` | `.wwebjs_auth` | Directorio de sesión WhatsApp |
| `DEDUP_TTL_MS` | `300000` | TTL dedup cache en ms |
| `DEDUP_MAX_SIZE` | `1000` | Tamaño máximo del cache LRU |
| `PORT` | `3000` | Puerto del servidor health |
| `LOG_LEVEL` | `info` | debug / info / warn / error |

## Session Persistence

La sesión de WhatsApp se persiste en `SESSION_PATH` (ignorada por git).
En producción: usar un volumen Docker persistente o EBS mount.
Sin sesión previa: el proceso imprime un QR en terminal → escanearlo con WhatsApp móvil.

## Key Constraints

- NEVER commit `.env`, `SESSION_PATH`, o cualquier credencial
- NEVER usar `console.log` — usar `logger` de `src/shared/logger.ts`
- Domain layer tiene CERO dependencias externas
- El cache dedup es in-memory: se resetea al reiniciar. **El backend también debe deduplicar por `id`.**
- No `any` — usar `unknown` con type guards
