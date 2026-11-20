import type { AnchorHTMLAttributes } from "react";

import { leavingHref } from "@/lib/external-link";

/**
 * An <a> for links that may leave TorFinder (ASVS 3.7.3): an absolute URL is
 * sent through the /leaving notice; anything relative is linked as is. Takes
 * the same props as <a>.
 */
export function OffsiteLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={leavingHref(href)} {...props} />;
}
