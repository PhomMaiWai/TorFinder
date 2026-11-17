import { downloadFromBackend } from "@/lib/backend-proxy";

/** The ZIP, streamed through as a download. */
export async function GET(request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  return downloadFromBackend(`/library/starter-pack/${encodeURIComponent(torId)}`, request);
}
