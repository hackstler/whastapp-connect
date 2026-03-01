# WhatsApp Technical Constraints

## whatsapp-web.js

### Eventos principales
```typescript
client.on('qr', (qr: string) => { ... })          // QR para escanear
client.on('ready', () => { ... })                   // Sesión activa
client.on('disconnected', (reason) => { ... })      // Desconexión
client.on('message_create', (msg: Message) => { ... }) // Mensaje nuevo (enviado O recibido)
```

- `message_create` se dispara para TODOS los mensajes (enviados y recibidos)
- Filtrar `msg.fromMe` para distinguir dirección
- `message` event solo captura mensajes entrantes — usar `message_create` para dedup completa

## Body-based Dedup (OBLIGATORIO)

Android multi-device **no preserva IDs consistentes** en el evento `message_create`.
La dedup debe ser por **contenido del body**, no por message ID.

### Patrón correcto
```typescript
// ANTES de enviar respuesta
sentBodies.set(replyText, true)  // registrar body ANTES de sendMessage

// Al recibir message_create
if (sentBodies.has(msg.body)) return  // ignorar eco de nuestra respuesta
```

### Race condition crítica
```
❌ INCORRECTO:
  1. sendMessage(reply)
  2. sentBodies.set(reply)  ← message_create puede llegar antes

✅ CORRECTO:
  1. sentBodies.set(reply)  ← registrar PRIMERO
  2. sendMessage(reply)
```

## LRU Dedup (mensajes entrantes)

```typescript
const dedup = new LRUCache<string, true>({
  max: config.DEDUP_MAX_SIZE,    // default: 1000
  ttl: config.DEDUP_TTL_MS,     // default: 300_000 (5min)
})
```

- Key: message ID (para entrantes, el ID sí es confiable)
- Si `dedup.has(msg.id._serialized)` → ignorar
- El TTL de 5min cubre retransmisiones normales de WhatsApp

## Session Persistence

- Directorio base: `.wwebjs_auth/` (configurable via `SESSION_BASE_PATH`)
- Cada usuario tiene su subdirectorio: `SESSION_BASE_PATH/<userId>/session/`
- **Volumen persistente** en producción (Docker volume o EBS mount)
- Si se pierde la sesión: el worker genera nuevo QR → lo reporta al backbone
- `.wwebjs_auth/` está en `.gitignore` — NUNCA commitear

## Graceful Shutdown

```typescript
async function shutdown() {
  logger.info("Shutting down...")
  await client.destroy()  // cerrar sesión limpiamente
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

- `client.destroy()` cierra Puppeteer y la conexión WebSocket
- Sin destroy: la sesión queda "activa" y el próximo arranque puede fallar
- Timeout de seguridad: si destroy tarda >10s, forzar `process.exit(1)`

## Logging

- **No** `console.log` — usar logger estructurado JSON (`src/shared/logger.ts`)
- Campos mínimos por log: `timestamp`, `level`, `message`, `orgId`
- Loggear: QR generado, conexión, desconexión, mensaje recibido, respuesta enviada, errores
- **No** loggear contenido de mensajes en producción (PII)
