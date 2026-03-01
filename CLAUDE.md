# whatsapp-worker

Worker de WhatsApp que captura mensajes y los envía al backbone RAG via HTTP. No tiene servidor público, ni dashboard, ni auth propia.

## Stack & Architecture

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js >= 18
- **Architecture**: Clean Architecture — Domain / Application / Infrastructure
- **WhatsApp**: whatsapp-web.js + Puppeteer (Chromium headless)
- **HTTP client**: native fetch (Node.js 18+)
- **Dedup cache**: lru-cache (in-memory LRU)
- **Config validation**: Zod

## Flujo principal

```
WhatsApp message → WhatsAppClient → BackboneClient → respuesta al chat
```

El worker NO conoce RAG, embeddings ni LLM. Solo habla con el backbone.

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
│   └── ports/          # BackbonePort, DedupPort (interfaces)
├── application/
│   └── use-cases/      # ProcessMessageUseCase
├── infrastructure/
│   ├── cache/          # LruDedupCache (implementa DedupPort)
│   ├── http/           # BackboneClient (implementa BackbonePort)
│   └── whatsapp/       # WhatsAppListenerClient (escucha eventos)
└── shared/
    ├── config.ts       # Config tipado desde env con Zod
    ├── logger.ts       # Logger estructurado JSON (stdout/stderr)
    └── errors/         # AppError base class
```

## Key Env Vars

| Variable | Default | Descripción |
|----------|---------|-------------|
| `BACKBONE_URL` | — | URL base del backbone API (**requerido**) |
| `JWT_SECRET` | — | Secret compartido con el backbone para JWT (**requerido**) |
| `SESSION_BASE_PATH` | `.wwebjs_auth` | Directorio base para sesiones WhatsApp por usuario |
| `SESSION_POLL_INTERVAL_MS` | `60000` | Intervalo de polling al backbone para nuevas sesiones |
| `DEDUP_TTL_MS` | `300000` | TTL dedup cache en ms |
| `DEDUP_MAX_SIZE` | `1000` | Tamaño máximo del cache LRU |
| `LOG_LEVEL` | `info` | debug / info / warn / error |

## Session Persistence

Cada usuario tiene su propia sesión en `SESSION_BASE_PATH/<userId>/session/` (ignorada por git).
En producción: usar un volumen Docker persistente o EBS mount.
Sin sesión previa: el worker genera un QR y lo reporta al backbone → el frontend lo muestra.
El worker descubre sesiones activas haciendo polling a `GET /internal/whatsapp/sessions`.

## Key Constraints

- NEVER commit `.env`, `SESSION_PATH`, o cualquier credencial
- NEVER usar `console.log` — usar `logger` de `src/shared/logger.ts`
- Domain layer tiene CERO dependencias externas
- El cache dedup es in-memory: se resetea al reiniciar
- No `any` — usar `unknown` con type guards
- Sin servidor HTTP público — el worker es un proceso headless
- Sin dashboard — el estado se consulta via backbone API
- Sin auth propia — el backbone autentica las requests del worker via JWT
