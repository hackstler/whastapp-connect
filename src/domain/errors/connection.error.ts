import { DomainError } from './domain-error'

/** Thrown when a WhatsApp connection fails (auth failure, initialization error). */
export class ConnectionError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}
