import { idPath, isObjectId } from "@/lib/backend-path";
import { downloadFromBackend, notFound } from "@/lib/backend-proxy";

/** The ZIP, streamed through as a download. */
export async function GET(request: Request, { params }: { params: Promise<{ torId: string }> }) {
  const { torId } = await params;
  if (!isObjectId(torId)) return notFound();
  return downloadFromBackend(`/library/starter-pack/${idPath(torId)}`, request);
}
