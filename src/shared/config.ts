import { z } from 'zod'

const ConfigSchema = z.object({
  /** URL base del backbone API, sin slash final. Ej: https://backbone.railway.app */
  BACKBONE_URL: z.string().url().transform((v) => v.replace(/\/$/, '')),
  /** Secret compartido con el backbone para firmar JWT de servicio */
  JWT_SECRET: z.string().min(16),
  /** Base path for per-user session directories. Each user gets a subdirectory. */
  SESSION_BASE_PATH: z.string().default('.wwebjs_auth'),
  /** Interval (ms) to poll backbone for new user sessions */
  SESSION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  DEDUP_TTL_MS: z.coerce.number().int().positive().default(300_000),
  DEDUP_MAX_SIZE: z.coerce.number().int().positive().default(1000),
})

export type Config = z.infer<typeof ConfigSchema>

const parsed = ConfigSchema.safeParse(process.env)

if (!parsed.success) {
  process.stderr.write(`[whatsapp-worker] Invalid configuration:\n${parsed.error.toString()}\n`)
  process.exit(1)
}

export const config: Config = parsed.data
