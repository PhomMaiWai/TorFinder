import { forwardCertificates } from "@/lib/certificates-proxy";

export async function GET() {
  return forwardCertificates({ method: "GET" });
}

export async function POST(request: Request) {
  return forwardCertificates({ method: "POST", request });
}
