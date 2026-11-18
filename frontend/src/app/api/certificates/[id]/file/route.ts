import { idPath, isObjectId } from "@/lib/backend-path";
import { downloadFromBackend, forwardToBackend, notFound } from "@/lib/backend-proxy";

type Context = { params: Promise<{ id: string }> };

/** Only a real ObjectId reaches the backend path (see `idPath`). */
const pathOf = (id: string) => (isObjectId(id) ? `/certificates/${idPath(id)}/file` : null);

export async function GET(request: Request, { params }: Context) {
  const path = pathOf((await params).id);
  return path ? downloadFromBackend(path, request) : notFound();
}

/** A multipart upload with one `file` part, streamed through to the backend. */
export async function PUT(request: Request, { params }: Context) {
  const path = pathOf((await params).id);
  return path ? forwardToBackend({ method: "PUT", path, request }) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const path = pathOf((await params).id);
  return path ? forwardToBackend({ method: "DELETE", path }) : notFound();
}
