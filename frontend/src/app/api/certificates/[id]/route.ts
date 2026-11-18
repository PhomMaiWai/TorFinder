import { idPath, isObjectId } from "@/lib/backend-path";
import { forwardToBackend, notFound } from "@/lib/backend-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isObjectId(id)) return notFound();
  return forwardToBackend({ method: "PUT", path: `/certificates/${idPath(id)}`, request });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isObjectId(id)) return notFound();
  return forwardToBackend({ method: "DELETE", path: `/certificates/${idPath(id)}` });
}
