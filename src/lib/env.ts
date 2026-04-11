/**
 * Spec 00 — env parsing at module load.
 *
 * Reads NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SITE_URL exactly once when
 * this module is imported. Any missing or malformed value throws a
 * ConfigError so a misconfigured build crashes loudly at startup
 * rather than producing a half-broken dashboard at request time.
 *
 * In production (NODE_ENV === "production"), apiUrl is required to be
 * https://. Local dev allows http:// for ergonomics.
 */

import { z } from "zod";
import { ConfigError } from "./api/errors";

const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string({ message: "missing NEXT_PUBLIC_API_URL" })
    .min(1, "missing NEXT_PUBLIC_API_URL")
    .url("NEXT_PUBLIC_API_URL must be a valid URL"),
  NEXT_PUBLIC_SITE_URL: z
    .string({ message: "missing NEXT_PUBLIC_SITE_URL" })
    .min(1, "missing NEXT_PUBLIC_SITE_URL")
    .url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
});

function parseEnv(): { apiUrl: URL; siteUrl: URL } {
  const result = EnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => i.message).join("; "));
  }
  const apiUrl = new URL(result.data.NEXT_PUBLIC_API_URL);
  const siteUrl = new URL(result.data.NEXT_PUBLIC_SITE_URL);
  if (process.env.NODE_ENV === "production" && apiUrl.protocol !== "https:") {
    throw new ConfigError("NEXT_PUBLIC_API_URL must be https in production");
  }
  return { apiUrl, siteUrl };
}

export const env = Object.freeze(parseEnv());
