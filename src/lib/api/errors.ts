/**
 * Spec 00 — typed error union for the api client surface.
 *
 * Every public method on apiClient maps any failure into one of these
 * five subclasses so callers can use exhaustive switch-case routing
 * without ever inspecting raw fetch / network primitives.
 */

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

export class NetworkError extends Error {
  override readonly name = "NetworkError";
}

export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
}

export class HttpError extends Error {
  override readonly name = "HttpError";
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export class ParseError extends Error {
  override readonly name = "ParseError";
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.path = path;
  }
}

export type ApiError = ConfigError | NetworkError | TimeoutError | HttpError | ParseError;
