/**
 * Spec 00 — typed API client; spec 07 — where its calls go.
 *
 * `createApiClient(transport)` builds the client over a transport that says
 * where a backend path lives and which headers to add. Every method goes
 * through the `request()` helper which:
 *   1. constructs the URL from the transport (no string concat from user
 *      input)
 *   2. applies an AbortSignal.timeout (default 10s, overridable per
 *      call)
 *   3. parses the response body as JSON
 *   4. validates against the response Zod schema
 *   5. maps every failure into the typed error union from ./errors
 *
 * Two clients exist. `apiClient` (here) is the browser's: every call goes to
 * the page's own origin under `/api/backend`, where the server-side proxy
 * signs and forwards it. `serverApiClient` (`lib/server/backend-client.ts`)
 * is the RSC pages': it calls the backend directly with a fresh token.
 *
 * Callers see typed domain objects, never raw Response or unknown.
 */

import { ConfigError, HttpError, NetworkError, ParseError, TimeoutError } from "./errors";
import {
  type BranchName,
  type Fingerprint,
  type FingerprintDetail,
  FingerprintDetailSchema,
  FingerprintsListSchema,
  type StreamEvent,
  type SwitchBranchResponse,
  SwitchBranchResponseSchema,
} from "./schemas";
import { parseSseFrame } from "./sse";

const DEFAULT_TIMEOUT_MS = 10_000;
// Render free tier cold-starts can take 30-60s. Server-side fetches
// (RSC / page load) use a longer timeout so the page waits for the
// backend to wake instead of showing an empty state immediately.
const SERVER_FETCH_TIMEOUT_MS = 45_000;
const SWITCH_BRANCH_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
// Backoff before a single cold-start retry (see withColdStartRetry).
const COLD_START_RETRY_BACKOFF_MS = 800;

/**
 * Cold-start retry policy (owned by the api layer, not the page — the
 * former inlined this in app/page.tsx). One retry on the signals that mean
 * "backend is waking / transiently 5xx": a NetworkError or a 5xx HttpError.
 *
 * A TimeoutError is NOT retried — the request already waited the full
 * SERVER_FETCH_TIMEOUT_MS window, so retrying would just double the wall
 * time. A successful-but-empty 200 also returns immediately, so a dashboard
 * with genuinely zero fingerprints never pays a retry penalty.
 */
export function isColdStartError(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (err instanceof HttpError) return err.status >= 500;
  return false;
}

export async function withColdStartRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isColdStartError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_BACKOFF_MS));
    return op();
  }
}

/**
 * Where a backend path goes and what each call adds. `resolve` and `headers`
 * run per call (a token is minted fresh every time) and may throw
 * `ConfigError`, which aborts the call before anything is sent.
 */
export interface ApiTransport {
  resolve(path: string): URL;
  headers(): Record<string, string>;
}

/** The browser's proxy prefix on the page's own origin (spec 07 §3). */
export const BROWSER_PROXY_PREFIX = "/api/backend";

export const browserTransport: ApiTransport = {
  resolve(path) {
    if (typeof window === "undefined") {
      throw new ConfigError("the browser api client was used outside a browser");
    }
    return new URL(`${BROWSER_PROXY_PREFIX}${path}`, window.location.origin);
  },
  headers() {
    return {};
  },
};

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

async function request<T>(
  transport: ApiTransport,
  path: string,
  schema: { parse: (input: unknown) => T },
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = transport.resolve(path);
  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...transport.headers(),
    },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    // The fetch threw — first ask the abort signal whether it was a
    // timeout (Node wraps the underlying DOMException as `cause`, jsdom
    // surfaces it directly, and either way the signal's `reason`
    // remembers what caused the abort).
    const signal = init.signal as AbortSignal | undefined;
    if (signal?.aborted) {
      const reason = signal.reason as { name?: string } | undefined;
      if (reason?.name === "TimeoutError") {
        throw new TimeoutError(`request to ${path} timed out after ${timeoutMs}ms`);
      }
      throw new TimeoutError(`request to ${path} aborted`);
    }
    const causeName = (err as { cause?: { name?: string } }).cause?.name;
    if (causeName === "TimeoutError") {
      throw new TimeoutError(`request to ${path} timed out after ${timeoutMs}ms`);
    }
    throw new NetworkError(`network error fetching ${path}: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HttpError(response.status, text);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new ParseError(`response was not valid JSON: ${(err as Error).message}`, "$");
  }

  try {
    return schema.parse(json);
  } catch (err) {
    const issue =
      typeof err === "object" && err !== null && "issues" in err
        ? (err as { issues: Array<{ path: Array<string | number> }> }).issues[0]
        : null;
    const path = issue ? issue.path.join(".") : "$";
    throw new ParseError(`response did not match schema at ${path}`, path);
  }
}

async function* streamFingerprints(
  transport: ApiTransport,
  signal: AbortSignal,
): AsyncIterable<StreamEvent> {
  if (signal.aborted) return;
  const url = transport.resolve("/_slowquery/api/stream");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/event-stream", ...transport.headers() },
      signal,
    });
  } catch (err) {
    if ((err as DOMException).name === "AbortError") return;
    throw new NetworkError(`sse fetch failed: ${(err as Error).message}`);
  }
  const body = response.body;
  if (!body) {
    throw new NetworkError("sse response had no body");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      if (signal.aborted) return;
      const { value, done } = await reader.read();
      if (done) {
        // Server closed cleanly. If the caller hasn't aborted, surface as
        // a network error so the caller can reconnect.
        if (!signal.aborted) {
          throw new NetworkError("sse stream closed by server");
        }
        /* v8 ignore next -- only reachable if abort races with done; tested via case 22 */
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let frameEnd = buffer.indexOf("\n\n");
      while (frameEnd !== -1) {
        if (signal.aborted) return;
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        // Single owner of the SSE wire format: parseSseFrame strips the
        // `data:` prefix, JSON-parses, and Zod-validates. Malformed frames
        // return null and are silently skipped (spec 00 case 21).
        const event = parseSseFrame(frame);
        if (event) {
          yield event;
          if (signal.aborted) return;
        }
        frameEnd = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    if ((err as DOMException).name === "AbortError") return;
    if (err instanceof NetworkError) throw err;
    throw new NetworkError(`sse read failed: ${(err as Error).message}`);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export interface ApiClient {
  listFingerprints(): Promise<Fingerprint[]>;
  getFingerprint(id: string): Promise<FingerprintDetail>;
  switchBranch(target: BranchName): Promise<SwitchBranchResponse>;
  streamFingerprints(signal: AbortSignal): AsyncIterable<StreamEvent>;
}

export function createApiClient(transport: ApiTransport): ApiClient {
  return {
    listFingerprints() {
      return withColdStartRetry(() =>
        request(transport, "/_slowquery/queries", FingerprintsListSchema, {
          timeoutMs: SERVER_FETCH_TIMEOUT_MS,
        }),
      );
    },
    getFingerprint(id) {
      return withColdStartRetry(() =>
        request(transport, `/_slowquery/queries/${id}`, FingerprintDetailSchema, {
          timeoutMs: SERVER_FETCH_TIMEOUT_MS,
        }),
      );
    },
    switchBranch(target) {
      return request(transport, "/branches/switch", SwitchBranchResponseSchema, {
        method: "POST",
        body: { target },
        timeoutMs: SWITCH_BRANCH_TIMEOUT_MS,
      });
    },
    streamFingerprints(signal) {
      return streamFingerprints(transport, signal);
    },
  };
}

/** The browser's client: same-origin `/api/backend`, signed by the proxy. */
export const apiClient: ApiClient = createApiClient(browserTransport);
