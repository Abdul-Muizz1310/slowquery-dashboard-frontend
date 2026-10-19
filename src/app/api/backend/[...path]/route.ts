import { env } from "@/lib/env";
import { proxyToBackend } from "@/lib/server/backend-proxy";

/**
 * Same-origin proxy to slowquery-demo-backend (spec 07). The browser calls
 * `/api/backend/<path>`; this signs a fresh platform token and forwards the
 * allowlisted call to `${NEXT_PUBLIC_API_URL}/<path>`, streaming the answer
 * back (the live timeline's SSE included).
 */

// node:crypto signs the token.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The timeline stream stays open; its own reconnect covers a cut.
export const maxDuration = 300;

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, { params }: Context): Promise<Response> {
  const { path } = await params;
  return proxyToBackend(request, path, env.apiUrl.href);
}

export const GET = forward;
export const POST = forward;
