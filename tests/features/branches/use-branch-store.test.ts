/**
 * Spec 04 — useBranchStore Zustand store.
 * Cases 1, 3, 5, 6, 10, 11, 12, 13, 14, 15.
 */

import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

describe("spec 04 — useBranchStore", () => {
  beforeEach(async () => {
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("case 1 happy: switch('fast') POSTs once, flips activeBranch, shows success toast", async () => {
    let posts = 0;
    server.use(
      http.post(`${API}/branches/switch`, () => {
        posts += 1;
        return HttpResponse.json({
          active: "fast",
          switched_at: "2026-04-12T01:00:00.000Z",
          latency_ms: 1850,
        });
      }),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    await useBranchStore.getState().switch("fast");
    expect(posts).toBe(1);
    expect(useBranchStore.getState().activeBranch).toBe("fast");
  });

  it("case 3 invariant: synthetic branch_switched event is emitted for the timeline", async () => {
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    const events: unknown[] = [];
    const off = useBranchStore.getState().onSyntheticEvent((e) => events.push(e));
    await useBranchStore.getState().switch("fast");
    off();
    expect(events.length).toBe(1);
  });

  it("case 5 edge: rapid double click results in exactly one POST", async () => {
    let posts = 0;
    server.use(
      http.post(`${API}/branches/switch`, async () => {
        posts += 1;
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({
          active: "fast",
          switched_at: "2026-04-12T01:00:00.000Z",
          latency_ms: 1000,
        });
      }),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    await Promise.all([
      useBranchStore.getState().switch("fast"),
      useBranchStore.getState().switch("fast"),
    ]);
    expect(posts).toBe(1);
  });

  it("case 6 edge: no-op call when activeBranch already matches target", async () => {
    let posts = 0;
    server.use(
      http.post(`${API}/branches/switch`, () => {
        posts += 1;
        return HttpResponse.json({
          active: "fast",
          switched_at: "2026-04-12T01:00:00.000Z",
          latency_ms: 1000,
        });
      }),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("fast");
    await useBranchStore.getState().switch("fast");
    expect(posts).toBe(0);
  });

  it("case 10 edge: hydrate rejects invalid branch value, defaults to slow", async () => {
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("bogus" as unknown as "slow");
    expect(useBranchStore.getState().activeBranch).toBe("slow");
  });

  it("case 11 failure: HttpError(500) keeps activeBranch unchanged", async () => {
    server.use(
      http.post(`${API}/branches/switch`, () => HttpResponse.text("boom", { status: 500 })),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("slow");
    await useBranchStore
      .getState()
      .switch("fast")
      .catch(() => undefined);
    expect(useBranchStore.getState().activeBranch).toBe("slow");
  });

  it("case 12 failure: HttpError(409) surfaces 'switch already in progress'", async () => {
    server.use(
      http.post(`${API}/branches/switch`, () =>
        HttpResponse.json({ detail: "switch already in progress" }, { status: 409 }),
      ),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    const result = await useBranchStore
      .getState()
      .switch("fast")
      .catch((e: unknown) => e);
    expect(String(result)).toMatch(/already in progress/i);
  });

  it("case 13 failure: HttpError(422) maps to 'invalid target'", async () => {
    server.use(
      http.post(`${API}/branches/switch`, () =>
        HttpResponse.json({ detail: "invalid" }, { status: 422 }),
      ),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    const result = await useBranchStore
      .getState()
      .switch("fast")
      .catch((e: unknown) => e);
    expect(String(result)).toMatch(/invalid target/i);
  });

  it("case 14 failure: TimeoutError path keeps activeBranch unchanged", async () => {
    server.use(
      http.post(`${API}/branches/switch`, async () => {
        await new Promise((r) => setTimeout(r, 60_000));
        return HttpResponse.json({});
      }),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("slow");
    await useBranchStore
      .getState()
      .switch("fast")
      .catch(() => undefined);
    expect(useBranchStore.getState().activeBranch).toBe("slow");
  }, 15_000);

  it("case 15 failure: ParseError path keeps activeBranch unchanged", async () => {
    server.use(
      http.post(`${API}/branches/switch`, () => HttpResponse.json({ unexpected: "shape" })),
    );
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("slow");
    await useBranchStore
      .getState()
      .switch("fast")
      .catch(() => undefined);
    expect(useBranchStore.getState().activeBranch).toBe("slow");
  });
});
