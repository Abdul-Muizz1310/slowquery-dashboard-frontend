import { createPublicKey, type KeyObject, verify } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { detailsById } from "../../mocks/fixtures/fingerprint-detail";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { tickOrdersCreatedAt } from "../../mocks/fixtures/stream-events";

/**
 * A stand-in for slowquery-demo-backend behind the real proxy (spec 07 §5).
 *
 * Like the real backend under platform contract v2 with DEMO_MODE=false,
 * every route but /health demands an X-Platform-Token, checked the way the
 * backend checks a frontend-key token: EdDSA, the signature against the
 * throwaway public key, iss "slowquery-frontend", aud the string "slowquery",
 * role "frontend", exp/iat with 10 s leeway and a lifetime of at most 300 s.
 * Anything else gets 401. It records what it received, and holds the SSE
 * stream open after its first event until the test releases it.
 *
 * Control routes, on this server's own origin (the browser never sees it):
 *   GET  /__control/requests        → every recorded request
 *   POST /__control/stream/release  → let open streams finish
 */

export type TokenCheck =
  | { valid: true; header: Record<string, unknown>; claims: Record<string, unknown> }
  | { valid: false; reason: string };

export type ReceivedRequest = {
  method: string;
  path: string;
  check: TokenCheck;
  headers: Record<string, string | null>;
};

const RECORDED_HEADERS = [
  "cookie",
  "authorization",
  "origin",
  "referer",
  "x-forwarded-for",
  "content-type",
  "accept",
] as const;

const HOLD_MS = 60_000;
const LEEWAY_S = 10;

function decodeJsonPart(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** The backend's contract-v2 check, for a frontend-key token. */
export function checkToken(token: string | null, key: KeyObject, nowS: number): TokenCheck {
  if (!token) return { valid: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed" };
  const [h, c, s] = parts;
  const header = decodeJsonPart(h);
  const claims = decodeJsonPart(c);
  if (header === null || claims === null) return { valid: false, reason: "malformed" };
  if (header.alg !== "EdDSA") return { valid: false, reason: "alg" };
  if (!verify(null, Buffer.from(`${h}.${c}`, "ascii"), key, Buffer.from(s, "base64url"))) {
    return { valid: false, reason: "signature" };
  }
  if (claims.iss !== "slowquery-frontend") return { valid: false, reason: "iss" };
  if (claims.role !== "frontend") return { valid: false, reason: "role" };
  if (claims.aud !== "slowquery") return { valid: false, reason: "aud" };
  const { exp, iat } = claims;
  if (!isInt(exp) || !(exp + LEEWAY_S > nowS)) return { valid: false, reason: "exp" };
  if (!isInt(iat) || !(iat - LEEWAY_S <= nowS)) return { valid: false, reason: "iat" };
  if (!(exp - iat > 0 && exp - iat <= 300)) return { valid: false, reason: "lifetime" };
  return { valid: true, header, claims };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "x-powered-by": "mock" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export type MockBackend = { url: string; close: () => Promise<void> };

export async function startMockBackend(opts: {
  port: number;
  publicKeyB64: string;
}): Promise<MockBackend> {
  const key = createPublicKey({
    key: Buffer.from(opts.publicKeyB64, "base64"),
    format: "der",
    type: "spki",
  });
  const received: ReceivedRequest[] = [];
  let active: "slow" | "fast" = "slow";
  let release: () => void = () => {};
  let released = new Promise<void>((resolve) => {
    release = resolve;
  });

  async function stream(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    });
    res.flushHeaders();
    res.write(
      `data: ${JSON.stringify({ ...tickOrdersCreatedAt, sampled_at: new Date().toISOString() })}\n\n`,
    );
    let closed = false;
    req.on("close", () => {
      closed = true;
    });
    await Promise.race([released, new Promise((r) => setTimeout(r, HOLD_MS))]);
    if (closed) return;
    res.write(`data: ${JSON.stringify({ kind: "heartbeat", now: new Date().toISOString() })}\n\n`);
    res.end();
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://mock.invalid");
    const method = req.method ?? "GET";

    if (url.pathname === "/__control/requests") return json(res, 200, received);
    if (url.pathname === "/__control/stream/release" && method === "POST") {
      release();
      released = new Promise<void>((resolve) => {
        release = resolve;
      });
      res.writeHead(204).end();
      return;
    }

    const token = req.headers["x-platform-token"];
    const headers: Record<string, string | null> = {};
    for (const name of RECORDED_HEADERS) {
      const v = req.headers[name];
      headers[name] = typeof v === "string" ? v : null;
    }
    const record: ReceivedRequest = {
      method,
      path: `${url.pathname}${url.search}`,
      check: checkToken(
        typeof token === "string" ? token : null,
        key,
        Math.floor(Date.now() / 1000),
      ),
      headers,
    };
    received.push(record);

    if (url.pathname === "/health" && method === "GET") {
      return json(res, 200, { status: "ok", service: "slowquery_demo", db: "ok" });
    }
    if (!record.check.valid) {
      const detail =
        record.check.reason === "missing" ? "missing_platform_token" : "invalid_platform_token";
      return json(res, 401, { detail });
    }

    if (url.pathname === "/_slowquery/queries" && method === "GET") {
      return json(res, 200, fingerprintsList);
    }
    const detail = url.pathname.match(/^\/_slowquery\/queries\/([a-f0-9]{1,16})$/);
    if (detail && method === "GET") {
      const body = detailsById[detail[1]];
      return body ? json(res, 200, body) : json(res, 404, { detail: "not found" });
    }
    if (url.pathname === "/_slowquery/api/stream" && method === "GET") return stream(req, res);
    if (url.pathname === "/branches/current" && method === "GET") return json(res, 200, { active });
    if (url.pathname === "/branches/switch" && method === "POST") {
      const body: unknown = JSON.parse((await readBody(req)) || "{}");
      const target =
        typeof body === "object" && body !== null && "target" in body ? body.target : null;
      if (target !== "slow" && target !== "fast")
        return json(res, 422, { detail: "invalid target" });
      if (target === active) return json(res, 409, { detail: `already on ${target}` });
      active = target;
      return json(res, 200, { active, switched_at: new Date().toISOString(), latency_ms: 12 });
    }
    return json(res, 404, { detail: "not found" });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (!res.headersSent) json(res, 500, { detail: String(err) });
      else res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "127.0.0.1", () => resolve());
  });

  return {
    url: `http://127.0.0.1:${opts.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        release();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
