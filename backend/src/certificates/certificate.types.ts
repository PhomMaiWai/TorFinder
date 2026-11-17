import { CERTIFICATIONS, Certification } from "../matching/requirements";

/** The file a company attached to a certificate, kept in GridFS. */
export type CertificateFile = {
  /** GridFS file id. */
  id: string;
  /** The name it was uploaded under, for the download. */
  name: string;
  contentType: CertificateFileType;
  size: number;
  uploadedAt: Date;
};

/**
 * One certificate as a record rather than a yes/no tick: who issued it, when,
 * until when, where it can be checked, and what it covers. What matters to an
 * agency reading a bid (#260) — and to us, because an expired certificate
 * doesn't meet a TOR's requirement however long ago it was ticked.
 */
export type CertificateRecord = {
  /** Stable within the company's list; a fresh ObjectId hex. */
  id: string;
  /** As printed on the certificate. */
  name: string;
  /** Which TOR requirement it meets, if it is one we can match on. */
  standard?: Certification;
  issuer?: string;
  /** YYYY-MM-DD. */
  issuedAt?: string;
  /** YYYY-MM-DD; absent for certificates that don't expire. */
  expiresAt?: string;
  /** The issuer's own verification page (or what the QR code opens). */
  verifyUrl?: string;
  /** What it certifies — e.g. the scope statement of an ISO certificate. */
  scope?: string;
  file?: CertificateFile;
  createdAt: Date;
  updatedAt: Date;
};

/** What we accept as a certificate scan. Checked against the file's own bytes, not its name. */
export const CERTIFICATE_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type CertificateFileType = (typeof CERTIFICATE_FILE_TYPES)[number];

export const CERTIFICATE_LIMITS = {
  /** A scanned certificate is a page or two; 5 MB is generous. */
  fileBytes: 5 * 1024 * 1024,
  /** Per company — a ceiling against abuse, far above what a real profile holds. */
  records: 100,
} as const;

/** Today as YYYY-MM-DD in Bangkok, the timezone every date on a certificate is written in. */
export function bangkokToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isExpired(record: Pick<CertificateRecord, "expiresAt">, today: string): boolean {
  return record.expiresAt !== undefined && record.expiresAt < today;
}

export type HeldCertifications = {
  /** Undefined until the company has answered; an empty list means "none". */
  held: Certification[] | undefined;
  /** Standards the company has a record for, but only an expired one. */
  expired: Certification[];
};

/**
 * Which of the matchable certifications a company holds today. Records decide
 * once there are any (an empty list is the answer "none"); before that the
 * old yes/no list still counts, so a profile filled in before #260 keeps
 * matching until it is migrated.
 */
export function heldCertifications(
  company: { certificates?: CertificateRecord[]; certifications?: Certification[] },
  today: string = bangkokToday(),
): HeldCertifications {
  if (company.certificates === undefined) {
    return { held: company.certifications, expired: [] };
  }

  const held = new Set<Certification>();
  const lapsed = new Set<Certification>();
  for (const record of company.certificates) {
    if (!record.standard || !(record.standard in CERTIFICATIONS)) continue;
    (isExpired(record, today) ? lapsed : held).add(record.standard);
  }
  return { held: [...held], expired: [...lapsed].filter((key) => !held.has(key)) };
}
