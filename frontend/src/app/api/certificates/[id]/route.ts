import { forwardCertificates } from "@/lib/certificates-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return forwardCertificates({ method: "PUT", path: `/${encodeURIComponent(id)}`, request });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return forwardCertificates({ method: "DELETE", path: `/${encodeURIComponent(id)}` });
}
