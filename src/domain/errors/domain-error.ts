/**
 * Base class for all domain-level errors in the whatsapp-worker.
 * Provides a typed error hierarchy for structured error handling.
 */
export abstract class DomainError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
