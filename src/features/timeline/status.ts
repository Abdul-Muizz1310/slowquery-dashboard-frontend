/**
 * Spec 03 — small reducer for the SSE connection state.
 * connecting → live on first event; live → reconnecting on fail;
 * three consecutive fails → fallback (polling).
 */

export type StreamStatus = "connecting" | "live" | "reconnecting" | "fallback";

type StatusAction = { kind: "first-event" } | { kind: "fail" } | { kind: "reset" };

const FAIL_THRESHOLD = 3;
let failCount = 0;

export function statusReducer(state: StreamStatus, action: StatusAction): StreamStatus {
  switch (action.kind) {
    case "first-event":
      failCount = 0;
      return "live";
    case "fail":
      failCount += 1;
      if (failCount >= FAIL_THRESHOLD) return "fallback";
      return "reconnecting";
    case "reset":
      failCount = 0;
      return "connecting";
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

export function shouldDisconnectOnVisibility(state: DocumentVisibilityState): boolean {
  return state === "hidden";
}
