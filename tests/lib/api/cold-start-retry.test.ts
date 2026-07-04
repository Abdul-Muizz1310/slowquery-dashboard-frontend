/**
 * Spec 00 — cold-start retry policy (finding "02 rsc-adhoc-retry").
 *
 * These tests are the behavioral guard the audit flagged as missing: the
 * previous coverage-driven suite (client.test.ts case 15) used a *persistent*
 * 500 handler, so it passed whether or not a retry actually occurred. Nothing
 * pinned the policy itself. Reintroducing any of the original bugs — retrying
 * on TimeoutError, dropping the single retry, or hoisting the loop back into a
 * page component so the api methods no longer wrap it — must fail here.
 *
 * Part A drives the exported `withColdStartRetry` / `isColdStartError`
 * directly so the retry *decision* is pinned in isolation (fake timers, no
 * real backoff wait). Part B drives the real `apiClient` methods through MSW
 * so the *wiring* — that both listFingerprints and getFingerprint go through
 * the retry and switchBranch does not — is pinned end-to-end.
 */

import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isColdStartError, withColdStartRetry } from "@/lib/api/client";
import { HttpError, NetworkError, ParseError, TimeoutError } from "@/lib/api/errors";
import { detailOrdersByCreatedAt } from "../../mocks/fixtures/fingerprint-detail";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";
const DETAIL_ID = "c168fc78a2e7d01c";
const BACKOFF_MS = 800;

// --- Part A: the retry decision, in isolation ------------------------------

describe("cold-start retry — isColdStartError predicate", () => {
  it("treats NetworkError as a cold-start signal (retryable)", () => {
    expect(isColdStartError(new NetworkError("down"))).toBe(true);
  });

  it("treats 5xx HttpError as a cold-start signal (retryable)", () => {
    expect(isColdStartError(new HttpError(500, "boom"))).toBe(true);
    expect(isColdStartError(new HttpError(503, "unavailable"))).toBe(true);
  });

  it("does NOT treat TimeoutError as a cold-start signal", () => {
    // The request already waited the full window; retrying only doubles it.
    expect(isColdStartError(new TimeoutError("slow"))).toBe(false);
  });

  it("does NOT treat 4xx HttpError as a cold-start signal", () => {
    expect(isColdStartError(new HttpError(404, "missing"))).toBe(false);
    expect(isColdStartError(new HttpError(422, "invalid"))).toBe(false);
  });

  it("does NOT treat ParseError as a cold-start signal", () => {
    expect(isColdStartError(new ParseError("bad shape", "$"))).toBe(false);
  });
});

describe("cold-start retry — withColdStartRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on success without a retry (empty result pays no penalty)", async () => {
    let calls = 0;
    const op = async (): Promise<string[]> => {
      calls += 1;
      return [];
    };
    await expect(withColdStartRetry(op)).resolves.toEqual([]);
    expect(calls).toBe(1);
  });

  it("retries exactly once on NetworkError then resolves", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      if (calls === 1) throw new NetworkError("cold start");
      return "ok";
    };
    const promise = withColdStartRetry(op);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  it("retries exactly once on 5xx HttpError then resolves", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      if (calls === 1) throw new HttpError(503, "waking up");
      return "ok";
    };
    const promise = withColdStartRetry(op);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  it("retries only once — a persistent cold-start error still throws after 2 attempts", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      throw new HttpError(500, "still down");
    };
    const promise = withColdStartRetry(op);
    // Attach a rejection handler before advancing so the unhandled-rejection
    // guard stays quiet, then assert it rejects.
    const settled = promise.then(
      () => "resolved",
      (e) => e,
    );
    await vi.runAllTimersAsync();
    await expect(settled).resolves.toBeInstanceOf(HttpError);
    expect(calls).toBe(2);
  });

  it("does NOT retry on TimeoutError — throws after a single attempt", async () => {
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      throw new TimeoutError("timed out");
    };
    await expect(withColdStartRetry(op)).rejects.toBeInstanceOf(TimeoutError);
    expect(calls).toBe(1);
  });

  it("does NOT retry on 4xx HttpError — throws after a single attempt", async () => {
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      throw new HttpError(404, "not found");
    };
    await expect(withColdStartRetry(op)).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });

  it("does NOT retry on ParseError — throws after a single attempt", async () => {
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      throw new ParseError("bad shape", "$");
    };
    await expect(withColdStartRetry(op)).rejects.toBeInstanceOf(ParseError);
    expect(calls).toBe(1);
  });

  it("waits the backoff window before the retry", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const op = async (): Promise<string> => {
      calls += 1;
      if (calls === 1) throw new NetworkError("cold start");
      return "ok";
    };
    const promise = withColdStartRetry(op);
    // Flush the failing first attempt; the retry is still parked behind the timer.
    await vi.advanceTimersByTimeAsync(BACKOFF_MS - 1);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
    expect(calls).toBe(2);
  });
});

// --- Part B: the wiring, through the real apiClient path -------------------

describe("cold-start retry — apiClient wiring", () => {
  it("listFingerprints retries a transient network failure then returns data", async () => {
    let hits = 0;
    server.use(
      http.get(`${API}/_slowquery/queries`, () => {
        hits += 1;
        if (hits === 1) return HttpResponse.error();
        return HttpResponse.json(fingerprintsList);
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.listFingerprints();
    expect(hits).toBe(2);
    expect(result.length).toBe(fingerprintsList.length);
  });

  it("getFingerprint retries a transient 5xx then returns detail", async () => {
    let hits = 0;
    server.use(
      http.get(`${API}/_slowquery/queries/:id`, () => {
        hits += 1;
        if (hits === 1) return HttpResponse.text("cold", { status: 503 });
        return HttpResponse.json(detailOrdersByCreatedAt);
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.getFingerprint(DETAIL_ID);
    expect(hits).toBe(2);
    expect(result.suggestions[0]?.kind).toBe("index");
  });

  it("listFingerprints does not retry a valid empty 200 (single request)", async () => {
    let hits = 0;
    server.use(
      http.get(`${API}/_slowquery/queries`, () => {
        hits += 1;
        return HttpResponse.json([]);
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.listFingerprints();
    expect(hits).toBe(1);
    expect(result).toEqual([]);
  });

  it("listFingerprints retries at most once — a persistent 5xx makes exactly 2 requests then throws", async () => {
    let hits = 0;
    server.use(
      http.get(`${API}/_slowquery/queries`, () => {
        hits += 1;
        return HttpResponse.text("still down", { status: 500 });
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(HttpError);
    expect(hits).toBe(2);
  });

  it("switchBranch does NOT retry — a 5xx makes exactly one request then throws", async () => {
    let hits = 0;
    server.use(
      http.post(`${API}/branches/switch`, () => {
        hits += 1;
        return HttpResponse.text("boom", { status: 500 });
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    await expect(apiClient.switchBranch("fast")).rejects.toBeInstanceOf(HttpError);
    expect(hits).toBe(1);
  });
});
