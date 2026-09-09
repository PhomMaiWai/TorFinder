import { Suspense } from "react";

import { SavedContent } from "@/components/saved/saved-list";
import { getAllTors } from "@/lib/tor-source";

export default async function SavedPage() {
  const tors = await getAllTors();

  return (
    <Suspense>
      <SavedContent tors={tors} />
    </Suspense>
  );
}
