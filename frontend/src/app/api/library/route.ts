import { forwardToBackend } from "@/lib/backend-proxy";

export async function GET() {
  return forwardToBackend({ method: "GET", path: "/library" });
}
