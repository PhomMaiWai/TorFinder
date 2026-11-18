import { forwardToBackend, isLibraryKind, notFound } from "@/lib/backend-proxy";

type Context = { params: Promise<{ kind: string }> };

/** "projects" or "team"; anything else is a route that doesn't exist. */
export async function POST(request: Request, { params }: Context) {
  const { kind } = await params;
  if (!isLibraryKind(kind)) return notFound();
  return forwardToBackend({ method: "POST", path: `/library/${kind}`, request });
}
