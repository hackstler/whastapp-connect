import { z } from 'zod'

const BoolFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false
  return value
}, z.boolean())

const ConfigSchema = z.object({
  /** URL base del rag-agent-backbone, sin path ni slash final. Ej: https://backbone.railway.app */
  RAG_HOST: z.string().url().transform((v) => v.replace(/\/$/, '')),
  SESSION_PATH: z.string().default('.wwebjs_auth'),
  DEDUP_TTL_MS: z.coerce.number().int().positive().default(300_000),
  DEDUP_MAX_SIZE: z.coerce.number().int().positive().default(1000),
  PORT: z.coerce.number().int().positive().default(3001),
  // ── Auth & dashboard ──────────────────────────────────────
  /** Secret para verificar JWTs emitidos por el backbone RAG. Debe coincidir con JWT_SECRET del backbone. */
  JWT_SECRET: z.string().min(16),
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
