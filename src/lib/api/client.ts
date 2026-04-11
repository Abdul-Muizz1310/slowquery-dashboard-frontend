/**
 * Spec 00 — typed API client.
 *
 * Every public method goes through the `request()` helper which:
 *   1. constructs the URL from env.apiUrl (no string concat from user
 *      input)
 *   2. applies an AbortSignal.timeout (default 10s, overridable per
 *      call)
 *   3. parses the response body as JSON
 *   4. validates against the response Zod schema
 *   5. maps every failure into the typed error union from ./errors
 *
 * Callers see typed domain objects, never raw Response or unknown.
 */

import { env } from "../env";
import { HttpError, NetworkError, ParseError, TimeoutError } from "./errors";
import {
  type BranchName,
  type Fingerprint,
  FingerprintDetailSchema,
  FingerprintsListSchema,
  type FingerprintDetail,
  type StreamEvent,
  StreamEventSchema,
  type SwitchBranchResponse,
  SwitchBranchResponseSchema,
} from "./schemas";

const DEFAULT_TIMEOUT_MS = 10_000;
const SWITCH_BRANCH_TIMEOUT_MS = 45_000;

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

async function request<T>(
  path: string,
  schema: { parse: (input: unknown) => T },
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = new URL(path, env.apiUrl);
  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
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
        ? // biome-ignore lint/suspicious/noExplicitAny: zod error issues are well-typed but reach across versions
          (err as { issues: Array<{ path: Array<string | number> }> }).issues[0]
        : null;
    const path = issue ? issue.path.join(".") : "$";
    throw new ParseError(`response did not match schema at ${path}`, path);
  }
}

async function* streamFingerprints(signal: AbortSignal): AsyncIterable<StreamEvent> {
  if (signal.aborted) return;
  const url = new URL("/_slowquery/api/stream", env.apiUrl);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/event-stream" },
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
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let frameEnd = buffer.indexOf("\n\n");
      while (frameEnd !== -1) {
        if (signal.aborted) return;
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        const trimmed = frame.trim();
        if (trimmed.startsWith("data:")) {
          const payload = trimmed.slice("data:".length).trim();
          try {
            const json: unknown = JSON.parse(payload);
            const parsed = StreamEventSchema.safeParse(json);
            if (parsed.success) {
              yield parsed.data;
              if (signal.aborted) return;
            }
            // malformed frames are silently skipped per spec 00 case 21
          } catch {
            // ignore
          }
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

export const apiClient = {
  listFingerprints(): Promise<Fingerprint[]> {
    return request("/_slowquery/queries", FingerprintsListSchema);
  },
  getFingerprint(id: string): Promise<FingerprintDetail> {
    return request(`/_slowquery/queries/${id}`, FingerprintDetailSchema);
  },
  switchBranch(target: BranchName): Promise<SwitchBranchResponse> {
    return request("/branches/switch", SwitchBranchResponseSchema, {
      method: "POST",
      body: { target },
      timeoutMs: SWITCH_BRANCH_TIMEOUT_MS,
    });
  },
  streamFingerprints,
};
