/** An error the route can turn into a structured HTTP failure. */
export class RouteError extends Error {
  readonly status: number
  readonly code: string
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'RouteError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Merge extra diagnostics into the error without losing the originating failure. */
  withDetails(details: Record<string, unknown>): this {
    this.details = { ...this.details, ...details }
    return this
  }
}
