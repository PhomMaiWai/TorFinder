import { downloadFromBackend, forwardToBackend } from "@/lib/backend-proxy";

type Context = { params: Promise<{ id: string }> };

const pathOf = (id: string) => `/certificates/${encodeURIComponent(id)}/file`;

export async function GET(request: Request, { params }: Context) {
  return downloadFromBackend(pathOf((await params).id), request);
}

/** A multipart upload with one `file` part, streamed through to the backend. */
export async function PUT(request: Request, { params }: Context) {
  return forwardToBackend({ method: "PUT", path: pathOf((await params).id), request });
}

export async function DELETE(_request: Request, { params }: Context) {
  return forwardToBackend({ method: "DELETE", path: pathOf((await params).id) });
}
