import { forwardToBackend } from "@/lib/backend-proxy";

/** Disconnects LINE. */
export function DELETE() {
  return forwardToBackend({ method: "DELETE", path: "/notifications/channels/line" });
}
