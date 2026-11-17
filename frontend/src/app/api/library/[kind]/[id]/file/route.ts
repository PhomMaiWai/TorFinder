import { downloadFromBackend, forwardToBackend } from "@/lib/backend-proxy";

type Context = { params: Promise<{ kind: string; id: string }> };

const pathOf = async (params: Context["params"]) => {
  const { kind, id } = await params;
  return `/library/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/file`;
};

export async function GET(request: Request, { params }: Context) {
  return downloadFromBackend(await pathOf(params), request);
}

/** A multipart upload with one `file` part, streamed through to the backend. */
export async function PUT(request: Request, { params }: Context) {
  return forwardToBackend({ method: "PUT", path: await pathOf(params), request });
}

export async function DELETE(_request: Request, { params }: Context) {
  return forwardToBackend({ method: "DELETE", path: await pathOf(params) });
}
