import { forwardToBackend } from "@/lib/backend-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return forwardToBackend({ method: "PUT", path: `/certificates/${encodeURIComponent(id)}`, request });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return forwardToBackend({ method: "DELETE", path: `/certificates/${encodeURIComponent(id)}` });
}
