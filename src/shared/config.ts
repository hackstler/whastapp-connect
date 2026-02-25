import { z } from 'zod'

const BoolFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false
  return value
}, z.boolean())

const ConfigSchema = z.object({
  INGEST_URL: z.string().url(),
  SESSION_PATH: z.string().default('.wwebjs_auth'),
  DEDUP_TTL_MS: z.coerce.number().int().positive().default(300_000),
  DEDUP_MAX_SIZE: z.coerce.number().int().positive().default(1000),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Si se define, los endpoints /qr y /logout exigen X-API-Key: <valor> */
  API_KEY: z.string().min(1).optional(),
  /** API key del backend RAG — fallback legacy, se envía como X-API-Key */
  RAG_API_KEY: z.string().min(1).optional(),
  /** Usuario admin del backend RAG para autenticación JWT (preferido sobre RAG_API_KEY) */
  RAG_USERNAME: z.string().min(1).optional(),
  /** Contraseña del usuario admin del backend RAG */
  RAG_PASSWORD: z.string().min(8).optional(),
  // ── Auth & dashboard ──────────────────────────────────────
  /** Secret para firmar/verificar JWT. Mínimo 16 caracteres. */
  JWT_SECRET: z.string().min(16),
  /** Usuario administrador por defecto */
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  /** Contraseña del admin por defecto (se hashea al arrancar) */
  ADMIN_PASSWORD: z.string().min(8),
  /** URL del endpoint /ingest del backend RAG */
  RAG_INGEST_URL: z.string().url(),
  /** Si está activo, /api/ingest/{url,file} responden mock sin llamar al backbone */
  RAG_INGEST_MOCK_ENABLED: BoolFromEnv.default(false),
  /** Latencia artificial del mock de ingest (ms) */
  RAG_INGEST_MOCK_DELAY_MS: z.coerce.number().int().min(0).default(400),
})

export type Config = z.infer<typeof ConfigSchema>

const parsed = ConfigSchema.safeParse(process.env)

if (!parsed.success) {
  process.stderr.write(`[whatsapp-rag] Invalid configuration:\n${parsed.error.toString()}\n`)
  process.exit(1)
}

export const config: Config = parsed.data
