// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { ConfigError } from "@/lib/api/errors";

/** Spec 07 F12: the browser client is for browsers; on a server it refuses. */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient outside a browser", () => {
  it("F12 throws ConfigError and calls nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiClient.switchBranch("fast")).rejects.toBeInstanceOf(ConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
