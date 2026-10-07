import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { BiddingBadge } from "@/components/public/bidding-badge";
import { biddingOf } from "@/lib/tor-ui";
import type { TorRecord } from "@/types/tor";

const DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function thaiDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE.format(date);
}

const IS_PDF = /\.pdf(\?|$)/i;

/**
 * A PDF the reader can open: the one the model read, else the first file on
 * record. process5 renders its documents on demand, so a record read from
 * there has a page to open (the "ดูต้นฉบับ" button), not a file.
 */
function sourcePdf(tor: TorRecord): string | undefined {
  const read = tor.extraction?.documentUrl;
  if (read && IS_PDF.test(read)) return read;
  return tor.documents?.find((doc) => IS_PDF.test(doc.url))?.url;
}

type Row = { label: string; value: React.ReactNode; hint?: string };

/**
 * Everything on record about the project, one fact per row, in the order a
 * bidder asks: who is buying, can I still bid, who won, for how much and when.
 * A row only appears when its fact is known — an empty "—" table reads as
 * missing data, a shorter one reads as complete.
 */
export function TorRecordFacts({ tor }: { tor: TorRecord }) {
  const t = useTranslations("TorDetailPage");
  const bidding = biddingOf(tor);
  const [agency, ...units] = tor.agency.split(" · ");
  const contract = tor.contracts?.[0];
  const durationDays = Number(contract?.durationDays) || null;
  const budget = tor.budgetAmount ?? null;
  const saving =
    contract?.amount && budget && budget > contract.amount ? budget - contract.amount : null;
  const updatedAt = [tor.enrichedAt, tor.extraction?.extractedAt]
    .filter((value): value is string => !!value)
    .sort()
    .at(-1);
  const pdf = sourcePdf(tor);

  const rows: (Row | null)[] = [
    { label: t("agencyLabel"), value: agency },
    units.length ? { label: t("subAgencyLabel"), value: units.join(" · ") } : null,
    tor.projectNumber ? { label: t("projectNumberLabel"), value: tor.projectNumber } : null,
    tor.procurementMethod ? { label: t("procurementMethodLabel"), value: tor.procurementMethod } : null,
    tor.procurementType ? { label: t("procurementTypeLabel"), value: tor.procurementType } : null,
    tor.goodsCategory ? { label: t("goodsCategoryLabel"), value: tor.goodsCategory } : null,
    { label: t("biddingStatusLabel"), value: <BiddingBadge bidding={bidding} /> },
    tor.procurementStep?.name
      ? {
          label: t("procurementStepLabel"),
          value: tor.procurementStep.name,
          hint: t("checkedOn", { date: thaiDate(tor.procurementStep.checkedAt) ?? "" }),
        }
      : null,
    bidding.opensAt ? { label: t("opensAtLabel"), value: thaiDate(bidding.opensAt) } : null,
    bidding.closesAt
      ? {
          label: t("closesAtLabel"),
          value: bidding.submissionTime
            ? `${thaiDate(bidding.closesAt)} · ${t("submissionTime", { time: bidding.submissionTime })}`
            : thaiDate(bidding.closesAt),
          hint: bidding.closesAtSource === "document" ? t("closesFromDocument") : undefined,
        }
      : null,
    tor.contractStatus ? { label: t("contractStatusLabel"), value: tor.contractStatus } : null,
    contract
      ? {
          label: t("vendorLabel"),
          value: tor.contracts!.map((c) => c.vendor).join(", "),
          hint: contract.number ? t("contractNumberHint", { number: contract.number }) : undefined,
        }
      : null,
    contract?.amount
      ? {
          label: t("contractAmountLabel"),
          value: BAHT.format(contract.amount),
          hint: saving
            ? t("savingHint", {
                amount: BAHT.format(saving),
                percent: ((saving / budget!) * 100).toFixed(1),
              })
            : undefined,
        }
      : null,
    contract?.signedAt ? { label: t("contractSignedLabel"), value: thaiDate(contract.signedAt) } : null,
    contract?.startsAt ? { label: t("contractStartLabel"), value: thaiDate(contract.startsAt) } : null,
    contract?.endsAt ? { label: t("contractEndLabel"), value: thaiDate(contract.endsAt) } : null,
    durationDays
      ? { label: t("contractDurationLabel"), value: t("durationDays", { days: durationDays }) }
      : tor.extraction?.contractPeriod
        ? { label: t("contractDurationLabel"), value: tor.extraction.contractPeriod }
        : null,
    tor.importedAt ? { label: t("importedAtLabel"), value: thaiDate(tor.importedAt) } : null,
    updatedAt ? { label: t("updatedAtLabel"), value: thaiDate(updatedAt) } : null,
    pdf
      ? {
          label: t("sourcePdfLabel"),
          value: (
            <a
              href={pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent-dark"
            >
              {t("openPdf")}
              <ExternalLink size={13} />
            </a>
          ),
        }
      : null,
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-2 text-base font-bold text-ink">{t("recordHeading")}</h2>
      <dl className="divide-y divide-border">
        {rows
          .filter((row): row is Row => row !== null && row.value !== null && row.value !== "")
          .map((row) => (
            <div key={row.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5">
              <dt className="text-xs leading-5 text-ink-muted">{row.label}</dt>
              <dd className="break-words text-sm font-medium leading-5 text-ink">
                {row.value}
                {row.hint && <p className="mt-0.5 text-xs font-normal text-ink-subtle">{row.hint}</p>}
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
