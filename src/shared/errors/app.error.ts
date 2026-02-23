export abstract class AppError extends Error {
  abstract readonly code: string

  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
