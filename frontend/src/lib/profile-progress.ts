import type { Certification, WorkType } from "@/types/tor";

/**
 * The profile fields matching reads, as the company has them. Contact details
 * are left out: they're useful, but no score or eligibility check uses them.
 */
export type MatchingProfile = {
  workTypes?: WorkType[];
  largestPastContract?: number;
  registeredCapital?: number;
  /** Undefined until answered: "none of these" is an answer, a blank isn't. */
  certifications?: Certification[];
  preferredBudgetMin?: number;
  preferredBudgetMax?: number;
};

export type ProfileItemKey = "workTypes" | "pastContract" | "capital" | "certifications" | "budget";

type ProfileItem = {
  key: ProfileItemKey;
  /** Section id on /profile, so a nudge can take the company straight to the field. */
  section: string;
  done: (profile: MatchingProfile) => boolean;
};

/** In order of how much the match loses without them: work type alone is half the score. */
const ITEMS: ProfileItem[] = [
  { key: "workTypes", section: "work-types", done: (p) => Boolean(p.workTypes?.length) },
  { key: "pastContract", section: "qualifications", done: (p) => Boolean(p.largestPastContract) },
  { key: "capital", section: "qualifications", done: (p) => Boolean(p.registeredCapital) },
  { key: "certifications", section: "standards", done: (p) => p.certifications !== undefined },
  {
    key: "budget",
    section: "budget-range",
    done: (p) => Boolean(p.preferredBudgetMin || p.preferredBudgetMax),
  },
];

export type ProfileProgressItem = { key: ProfileItemKey; href: string; done: boolean };

export function profileProgress(profile: MatchingProfile | null | undefined) {
  const items: ProfileProgressItem[] = ITEMS.map(({ key, section, done }) => ({
    key,
    href: `/profile#${section}`,
    done: profile ? done(profile) : false,
  }));
  const doneCount = items.filter((item) => item.done).length;
  return {
    items,
    missing: items.filter((item) => !item.done),
    percent: Math.round((doneCount / items.length) * 100),
  };
}
