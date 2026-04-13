/**
 * Spec 03 — small reducer for the SSE connection state.
 * connecting → live on first event; live → reconnecting on fail;
 * three consecutive fails → fallback (polling).
 */

export type StreamStatus = "connecting" | "live" | "reconnecting" | "fallback";

export type StreamState = {
  status: StreamStatus;
  failCount: number;
};

type StatusAction = { kind: "first-event" } | { kind: "fail" } | { kind: "reset" };

const FAIL_THRESHOLD = 3;

export const initialStreamState: StreamState = { status: "connecting", failCount: 0 };

export function statusReducer(state: StreamState, action: StatusAction): StreamState {
  switch (action.kind) {
    case "first-event":
      return { status: "live", failCount: 0 };
    case "fail": {
      const failCount = state.failCount + 1;
      return {
        status: failCount >= FAIL_THRESHOLD ? "fallback" : "reconnecting",
        failCount,
      };
    }
    case "reset":
      return { status: "connecting", failCount: 0 };
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

export function shouldDisconnectOnVisibility(state: DocumentVisibilityState): boolean {
  return state === "hidden";
}
