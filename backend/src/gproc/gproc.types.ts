/** Shapes returned by the national e-GP (process5) per-project API — only the fields read. */

export type GprocEnvelope<T> = { data?: T | null };

export type GprocProjectDetail = {
  projectId: string;
  projectName: string | null;
  /** "A" active, "R" cancelled. */
  projectStatus: string | null;
  /** The project's current announcement, e.g. "B0", "D0", "W0". */
  announceType: string | null;
  methodId: string | null;
  deptName: string | null;
  deptSubName: string | null;
};

export type GprocAnnouncement = {
  announceType: string;
  /** ISO instant; Bangkok midnight arrives as 17:00Z the day before. */
  announceDate: string | null;
  /** The reference price (ราคากลาง) printed on the row, in baht. */
  priceBuild: number | null;
};

export type GprocAnnouncementList = {
  greenBookAnnouncementTypeLinkDto?: Partial<GprocAnnouncement>[] | null;
};

export type GprocDocumentInfo = { buildName2?: string | null; zipId?: string | null };

/** A PDF taken out of a project's document bundle. */
export type GprocDocument = { label: string; pdf: Buffer };

/** What one captured project came to. */
export type GprocOutcome = "created" | "updated" | "known" | "skipped" | "failed";

export type GprocRun = {
  id: string;
  status: "running" | "done" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  total: number;
  counts: Record<GprocOutcome, number>;
  /** One line per project that wasn't simply imported, for the admin to read. */
  notes: string[];
};
