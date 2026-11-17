import { forwardCertificates } from "@/lib/certificates-proxy";

/** The answer "we hold no certificates" — an answer, unlike a blank. */
export async function POST() {
  return forwardCertificates({ method: "POST", path: "/none" });
}
