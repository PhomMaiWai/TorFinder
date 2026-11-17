import { forwardToBackend } from "@/lib/backend-proxy";

type Context = { params: Promise<{ kind: string }> };

/** "projects" or "team"; the backend refuses any other kind. */
export async function POST(request: Request, { params }: Context) {
  const { kind } = await params;
  return forwardToBackend({ method: "POST", path: `/library/${encodeURIComponent(kind)}`, request });
}
