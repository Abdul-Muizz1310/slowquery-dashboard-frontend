/**
 * Spec 04 — Zustand store for branch state.
 *
 * Single owner of the apiClient.switchBranch call. Idempotent against
 * the same target. Concurrent switches are short-circuited via the
 * switchInFlight flag. Synthetic branch_switched events are emitted
 * to subscribers (LiveTimeline) so the chart marker renders even if
 * the backend SSE hasn't caught up.
 *
 * No querystring encoding here — the api client owns the wire format
 * (a JSON body of {target}). The store only knows about the typed
 * BranchName enum.
 */

import { create } from "zustand";
import { apiClient } from "@/lib/api/client";
import { HttpError } from "@/lib/api/errors";
import type { BranchName, SwitchBranchResponse } from "@/lib/api/schemas";
import { BranchNameSchema } from "@/lib/api/schemas";

function friendlyError(err: unknown): Error {
  if (err instanceof HttpError) {
    if (err.status === 409) return new Error("switch already in progress");
    if (err.status === 422) return new Error("invalid target");
    return new Error(`backend error — try again (${err.status})`);
  }
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "branch switch failed");
}

interface SyntheticBranchEvent {
  active: BranchName;
  switched_at: Date;
  latency_ms: number;
}

type Listener = (event: SyntheticBranchEvent) => void;

const listeners = new Set<Listener>();

interface BranchStoreState {
  activeBranch: BranchName;
  switchInFlight: boolean;
  lastResponse: SwitchBranchResponse | null;
  hydrate: (branch: unknown) => void;
  reset: () => void;
  switch: (target: BranchName) => Promise<void>;
  onSyntheticEvent: (listener: Listener) => () => void;
}

export const useBranchStore = create<BranchStoreState>((set, get) => ({
  activeBranch: "slow",
  switchInFlight: false,
  lastResponse: null,

  hydrate(branch) {
    const parsed = BranchNameSchema.safeParse(branch);
    set({ activeBranch: parsed.success ? parsed.data : "slow" });
  },

  reset() {
    set({ activeBranch: "slow", switchInFlight: false, lastResponse: null });
  },

  async switch(target) {
    const state = get();
    if (state.switchInFlight) return;
    if (state.activeBranch === target) return;
    set({ switchInFlight: true });
    try {
      const response = await apiClient.switchBranch(target);
      set({
        activeBranch: response.active,
        lastResponse: response,
        switchInFlight: false,
      });
      const event: SyntheticBranchEvent = {
        active: response.active,
        switched_at: response.switched_at,
        latency_ms: response.latency_ms,
      };
      for (const listener of listeners) {
        listener(event);
      }
    } catch (err) {
      set({ switchInFlight: false });
      throw friendlyError(err);
    }
  },

  onSyntheticEvent(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
}));
