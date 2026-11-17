import { forwardToBackend } from "@/lib/backend-proxy";

/** The answer "we hold no certificates" — an answer, unlike a blank. */
export async function POST() {
  return forwardToBackend({ method: "POST", path: "/certificates/none" });
}
