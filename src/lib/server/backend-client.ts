import "server-only";
import { type ApiClient, type ApiTransport, createApiClient } from "@/lib/api/client";
import { ConfigError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { loadSigningKey, mintPlatformToken, SIGNING_KEY_ENV } from "./platform-token";

/**
 * The RSC pages' client (spec 07 §3): calls `${NEXT_PUBLIC_API_URL}` directly
 * with a freshly minted platform token, never through the site's own proxy.
 * A missing or malformed key throws `ConfigError` before anything is sent, so
 * no unsigned request leaves the server; the pages render their error state.
 */

const serverTransport: ApiTransport = {
  resolve(path) {
    return new URL(path, env.apiUrl);
  },
  headers() {
    const signingKey = loadSigningKey(process.env[SIGNING_KEY_ENV]);
    if (!signingKey.ok) {
      throw new ConfigError(`${SIGNING_KEY_ENV} is ${signingKey.reason}`);
    }
    return { "x-platform-token": mintPlatformToken(signingKey.key) };
  },
};

export const serverApiClient: ApiClient = createApiClient(serverTransport);
