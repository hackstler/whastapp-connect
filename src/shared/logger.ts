type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function serializeMeta(meta: unknown): unknown {
  if (meta instanceof Error) {
    return {
      message: meta.message,
      stack: meta.stack,
      name: meta.name,
      ...(meta.cause !== undefined ? { cause: serializeMeta(meta.cause) } : {}),
    }
  }
  if (meta !== null && typeof meta === 'object') {
    return Object.fromEntries(
      Object.entries(meta as Record<string, unknown>).map(([k, v]) => [k, serializeMeta(v)])
    )
  }
  return meta
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel = (process.env['LOG_LEVEL'] ?? 'info') as LogLevel

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta: serializeMeta(meta) } : {}),
  }

  const line = JSON.stringify(entry) + '\n'

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
}

export const logger = {
  debug: (message: string, meta?: unknown): void => log('debug', message, meta),
  info: (message: string, meta?: unknown): void => log('info', message, meta),
  warn: (message: string, meta?: unknown): void => log('warn', message, meta),
  error: (message: string, meta?: unknown): void => log('error', message, meta),
}
