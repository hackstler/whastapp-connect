import { DomainError } from './domain-error'

/** Thrown when the backbone API is unreachable or returns an unexpected HTTP error. */
export class BackboneUnavailableError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}
