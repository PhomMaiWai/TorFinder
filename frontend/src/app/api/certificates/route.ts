import { forwardToBackend } from "@/lib/backend-proxy";

export async function GET() {
  return forwardToBackend({ method: "GET", path: "/certificates" });
}

export async function POST(request: Request) {
  return forwardToBackend({ method: "POST", path: "/certificates", request });
}
