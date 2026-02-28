# Worker Architecture — Clean Architecture

## Capas (dependencia estricta: inward only)

```
Domain (entities, ports)
  ↑
Application (use cases)
  ↑
Infrastructure (WhatsApp client, BackboneClient, config)
```

- Domain **NO** importa de Application ni Infrastructure
- Application **NO** importa de Infrastructure
- Infrastructure implementa los ports de Domain

## Rol del Worker

El worker es un **cliente WhatsApp puro**. NO conoce RAG, embeddings, ni LLM.
Solo captura mensajes de WhatsApp y los envía al backbone vía HTTP.

## BackboneClient

Reemplaza al antiguo `RagIngestAdapter`. Archivo: `src/infrastructure/http/backbone.client.ts`

```typescript
class BackboneClient {
  constructor(
    private baseUrl: string,  // BACKBONE_URL
    private token: string,    // JWT worker pre-generado
  ) {}

  async reportQr(qrData: string): Promise<void>
  // POST /internal/whatsapp/qr { qrData }

  async reportStatus(status: "connected" | "disconnected", phone?: string): Promise<void>
  // POST /internal/whatsapp/status { status, phone }

  async sendMessage(messageId: string, body: string, chatId: string): Promise<string>
  // POST /internal/whatsapp/message { messageId, body, chatId }
  // Returns: reply text from RAG agent
}
```

- Todas las requests llevan `Authorization: Bearer <worker-jwt>`
- Retry: NO reintentar automáticamente. Si falla, loggear y continuar.
- Timeout: 30s para `sendMessage` (el RAG puede tardar), 5s para qr/status.

## JWT de servicio

```typescript
const token = jwt.sign(
  { role: "worker", orgId: config.ORG_ID },
  config.JWT_SECRET,
)
```

- Se genera una vez al arrancar y se reutiliza
- Sin expiración (el backbone valida el secret, no la expiración)
- Si el backbone rechaza (401/403), loggear error fatal y parar

## Composition Root

Archivo: `src/index.ts` — simplificado:

```typescript
// 1. Validar config (Zod)
// 2. Crear BackboneClient
// 3. Crear WhatsAppClient (recibe BackboneClient)
// 4. Registrar graceful shutdown (SIGTERM, SIGINT)
// 5. Iniciar WhatsAppClient
```

No hay servidor HTTP. No hay dashboard. No hay auth propia.

## Archivos a eliminar

- `src/infrastructure/http/server.ts` — ya no hay HTTP server
- `src/infrastructure/http/views/` — ya no hay dashboard HTML
- `src/infrastructure/auth/` — ya no hay auth propia (el backbone autentica)
- Cualquier referencia a `INGEST_URL` — reemplazar por `BACKBONE_URL`
