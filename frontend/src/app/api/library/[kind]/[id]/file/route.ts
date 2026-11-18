import { idPath, isObjectId } from "@/lib/backend-path";
import { downloadFromBackend, forwardToBackend, isLibraryKind, notFound } from "@/lib/backend-proxy";

type Context = { params: Promise<{ kind: string; id: string }> };

/** Only a known kind and a real ObjectId reach the backend path. */
const pathOf = async (params: Context["params"]) => {
  const { kind, id } = await params;
  return isLibraryKind(kind) && isObjectId(id) ? `/library/${kind}/${idPath(id)}/file` : null;
};

export async function GET(request: Request, { params }: Context) {
  const path = await pathOf(params);
  return path ? downloadFromBackend(path, request) : notFound();
}

/** A multipart upload with one `file` part, streamed through to the backend. */
export async function PUT(request: Request, { params }: Context) {
  const path = await pathOf(params);
  return path ? forwardToBackend({ method: "PUT", path, request }) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const path = await pathOf(params);
  return path ? forwardToBackend({ method: "DELETE", path }) : notFound();
}
