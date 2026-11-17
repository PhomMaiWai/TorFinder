import { downloadCertificateFile, forwardCertificates } from "@/lib/certificates-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return downloadCertificateFile(id, request);
}

/** A multipart upload with one `file` part, streamed through to the backend. */
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return forwardCertificates({ method: "PUT", path: `/${encodeURIComponent(id)}/file`, request });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return forwardCertificates({ method: "DELETE", path: `/${encodeURIComponent(id)}/file` });
}
