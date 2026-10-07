import { useTranslations } from "next-intl";

import type { Bidding } from "@/types/tor";

const STYLE: Record<Bidding["status"], string> = {
  open: "bg-success-soft text-success",
  closed: "bg-surface-alt text-ink-muted ring-1 ring-border",
  unknown: "bg-surface-alt text-ink-subtle",
};

const DOT: Record<Bidding["status"], string> = {
  open: "bg-success",
  closed: "bg-ink-subtle",
  unknown: "bg-border",
};

/**
 * Open / closed / unknown, with the reason a record is closed as its tooltip —
 * "closed" alone doesn't say whether the date passed or a winner was named.
 * No hooks beyond translation, so it renders on the server and the client alike.
 */
export function BiddingBadge({ bidding }: { bidding: Bidding }) {
  const t = useTranslations("Bidding");
  const reason = bidding.reason ? t(`reason_${bidding.reason}`) : undefined;

  return (
    <span
      title={reason}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold ${STYLE[bidding.status]}`}
    >
      <span className={`size-1.5 rounded-full ${DOT[bidding.status]}`} />
      {t(bidding.status)}
      {bidding.status === "closed" && reason && (
        <span className="font-normal text-ink-subtle">· {reason}</span>
      )}
    </span>
  );
}
