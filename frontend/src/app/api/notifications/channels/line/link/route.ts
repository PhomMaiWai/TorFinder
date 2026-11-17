import { forwardToBackend } from "@/lib/backend-proxy";

/** A one-time code for connecting LINE. */
export function POST() {
  return forwardToBackend({ method: "POST", path: "/notifications/channels/line/link" });
}
