import { z } from 'zod'

const ConfigSchema = z.object({
  INGEST_URL: z.string().url(),
  SESSION_PATH: z.string().default('.wwebjs_auth'),
  DEDUP_TTL_MS: z.coerce.number().int().positive().default(300_000),
  DEDUP_MAX_SIZE: z.coerce.number().int().positive().default(1000),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Si se define, los endpoints /qr y /logout exigen X-API-Key: <valor> */
  API_KEY: z.string().min(1).optional(),
})

export type Config = z.infer<typeof ConfigSchema>

const parsed = ConfigSchema.safeParse(process.env)

if (!parsed.success) {
  process.stderr.write(`[whatsapp-rag] Invalid configuration:\n${parsed.error.toString()}\n`)
  process.exit(1)
}

export const config: Config = parsed.data
