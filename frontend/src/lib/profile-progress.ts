import type { CertificateRecord, Certification, WorkType } from "@/types/tor";

/**
 * The profile fields matching reads, as the company has them. Contact details
 * are left out: they're useful, but no score or eligibility check uses them.
 */
export type MatchingProfile = {
  workTypes?: WorkType[];
  largestPastContract?: number;
  registeredCapital?: number;
  /** Undefined until answered: "none" is an answer, a blank isn't. */
  certificates?: CertificateRecord[] | null;
  /** The yes/no list from before certificates were records. */
  certifications?: Certification[];
  preferredBudgetMin?: number;
  preferredBudgetMax?: number;
};

export type ProfileItemKey = "workTypes" | "pastContract" | "capital" | "certifications" | "budget";

type ProfileItem = {
  key: ProfileItemKey;
  /** Where the field is, so a nudge can take the company straight to it. */
  href: string;
  done: (profile: MatchingProfile) => boolean;
};

/** In order of how much the match loses without them: work type alone is half the score. */
const ITEMS: ProfileItem[] = [
  { key: "workTypes", href: "/profile#work-types", done: (p) => Boolean(p.workTypes?.length) },
  { key: "pastContract", href: "/profile#qualifications", done: (p) => Boolean(p.largestPastContract) },
  { key: "capital", href: "/profile#qualifications", done: (p) => Boolean(p.registeredCapital) },
  // Certificates are kept in the document library, not on the profile.
  { key: "certifications", href: "/library#certificates", done: (p) => p.certificates != null || p.certifications !== undefined },
  {
    key: "budget",
    href: "/profile#budget-range",
    done: (p) => Boolean(p.preferredBudgetMin || p.preferredBudgetMax),
  },
];

export type ProfileProgressItem = { key: ProfileItemKey; href: string; done: boolean };

export function profileProgress(profile: MatchingProfile | null | undefined) {
  const items: ProfileProgressItem[] = ITEMS.map(({ key, href, done }) => ({
    key,
    href,
    done: profile ? done(profile) : false,
  }));
  const doneCount = items.filter((item) => item.done).length;
  return {
    items,
    missing: items.filter((item) => !item.done),
    percent: Math.round((doneCount / items.length) * 100),
  };
}
