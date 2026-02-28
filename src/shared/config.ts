import { z } from 'zod'

const ConfigSchema = z.object({
  /** ID de la organización que sirve este worker */
  ORG_ID: z.string().min(1),
  /** URL base del backbone API, sin slash final. Ej: https://backbone.railway.app */
  BACKBONE_URL: z.string().url().transform((v) => v.replace(/\/$/, '')),
  /** Secret compartido con el backbone para firmar JWT de servicio */
  JWT_SECRET: z.string().min(16),
  SESSION_PATH: z.string().default('.wwebjs_auth'),
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
