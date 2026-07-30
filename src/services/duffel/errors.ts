/**
 * Error taxonomy for the Duffel boundary.
 *
 * The distinction that matters is whether the traveller can do anything about
 * it. `DuffelUnavailableError` means try again; `DuffelRequestError` means the
 * search itself is wrong; `DuffelConfigError` means we broke it, not them.
 * The results page branches on these to write an honest message.
 */
export class DuffelConfigError extends Error {
  override readonly name = 'DuffelConfigError';
}

export class DuffelUnavailableError extends Error {
  override readonly name = 'DuffelUnavailableError';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class DuffelRequestError extends Error {
  override readonly name = 'DuffelRequestError';
  constructor(
    message: string,
    readonly status: number,
    readonly errors: DuffelApiError[] = [],
  ) {
    super(message);
  }
}

export interface DuffelApiError {
  code: string;
  title: string;
  message: string;
  type: string;
}
