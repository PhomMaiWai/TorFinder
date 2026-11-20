import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Collection, Document, GridFSBucket, MongoBulkWriteError, MongoClient, ObjectId } from "mongodb";

import { StoredExtraction } from "../ai/ai.types";
import { CertificateRecord } from "../certificates/certificate.types";
import { PastProject, TeamMember } from "../library/library.types";
import { CERTIFICATIONS, Certification } from "../matching/requirements";
import { WorkType } from "../matching/work-types";
import { FeedbackStatus } from "../feedback/feedback.constants";
import { ReportReason, ReportStatus } from "../reports/reports.constants";
import { PasswordParams, passwordFields } from "../common/password";
import { Role } from "../common/roles";
import { env } from "../config/env";
import { ProcurementStage, TOR_BUDGET_STATUSES, TOR_STAGES, TorClassification } from "../tor/tor.constants";
import { SEED_USERS } from "./seed-data";

export const ACCOUNT_STATUSES = ["pending", "approved", "rejected"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type CompanyProfile = {
  companyName: string;
  taxId: string;
  contactName: string;
  phone: string;
  address: string;
  specialty: string;
  size: string;
  /** Superseded by workTypes; kept so older profiles still read. */
  techStack?: string[];
  /** Free-text summary of past projects — absent until the company fills it in. */
  pastExperience?: string;
  /** The kinds of public-sector IT contract the company takes on. */
  workTypes?: WorkType[];
  /**
   * The largest single contract completed for a public agency, in baht — what
   * a TOR's "ผลงาน ไม่น้อยกว่า …" is checked against.
   */
  largestPastContract?: number;
  /** Paid-up registered capital, in baht. */
  registeredCapital?: number;
  /**
   * The yes/no list from before certificates were records (#260). Read only
   * while `certificates` is absent; backfillCertificateRecords turns it into
   * records at startup.
   */
  certifications?: Certification[];
  /** Undefined until answered; an empty list means the company holds none. */
  certificates?: CertificateRecord[];
  /** The proposal library (#259): contracts to cite as ผลงาน. */
  pastProjects?: PastProject[];
  /** The proposal library (#259): people to name on a bid, with their CVs. */
  teamMembers?: TeamMember[];
  /** The project size the company wants to bid on, in baht. */
  preferredBudgetMin?: number;
  preferredBudgetMax?: number;
  /** Whether to hear about matching announcements; absent means yes. */
  matchAlerts?: boolean;
  /** The lowest match score worth an alert, 0-100; absent means the deployment's default. */
  matchThreshold?: number;
};

export type NotificationChannels = {
  /** To the account's own sign-in address. */
  email: boolean;
  /** A Slack incoming-webhook URL the company created for its own channel. */
  slackWebhookUrl?: string;
  /** The LINE user id our official account pushes to — only ever set by the link flow. */
  lineUserId?: string;
};

export type UserDoc = {
  email: string;
  name: string;
  role: Role;
  /** Organizations sign themselves up and stay pending until an admin approves. */
  status: AccountStatus;
  /** Absent for accounts created via Google sign-in that never set a password. */
  passwordHash?: string;
  passwordSalt?: string;
  /** The settings the hash was made with; absent on hashes from before they were stored (ASVS 11.2.2). */
  passwordParams?: PasswordParams;
  /** Set once a Google account is created or linked; unique when present. */
  googleId?: string;
  createdAt: Date;
  company?: CompanyProfile;
  /** Where notifications are sent besides the in-app list; absent means in-app only. */
  notificationChannels?: NotificationChannels;
  /**
   * A pending "connect LINE" request: the SHA-256 of the one-time code the
   * user sends to our OA, and when it stops working. Cleared once used.
   */
  lineLink?: { codeHash: string; expiresAt: Date };
  reviewedAt?: Date;
  /**
   * Orthogonal to `status`: an admin can suspend an already-approved account
   * to block it from signing in without reversing the approval decision
   * itself. Absent (not false) means never suspended.
   */
  suspended?: boolean;
  /** Stamped on every successful login/Google sign-in — see AuthService.issueSession. */
  lastLoginAt?: Date;
  /**
   * `false` until the owner of a password sign-up opens the link mailed to
   * them; set true by that link, a password reset (which proves the same
   * inbox) or Google. Absent on accounts made before verification existed,
   * which are treated as verified rather than locked out.
   */
  emailVerified?: boolean;
  /**
   * The floor for a session token's `iat` (issued-at) to still be accepted —
   * see SessionRevocationService. Bumped on logout, password reset, and
   * suspension; absent means no token for this account has ever been revoked.
   */
  sessionMinIssuedAt?: Date;
  /** Staff passkeys (WebAuthn credentials); see auth/passkeys.service.ts. Absent or empty means none. */
  passkeys?: StoredPasskey[];
};

/** One registered passkey. Only the public key is held; the private key never leaves the user's device. */
export type StoredPasskey = {
  /** The credential id, base64url — unique across all accounts. */
  id: string;
  /** COSE public key, base64url. */
  publicKey: string;
  /** The authenticator's signature counter, kept to spot a cloned key. */
  counter: number;
  transports?: string[];
  /** The user's own label, e.g. "Work laptop". */
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
};

/**
 * What a single-use secret in `authTokens` is for: an emailed link, or a
 * WebAuthn challenge (sign-in, adding a passkey, a step-up check).
 */
export type AuthTokenPurpose =
  | "password-reset"
  | "email-verify"
  | "passkey-login"
  | "passkey-register"
  | "passkey-step-up";

/** The purposes that are emailed links (AccountLinksService). */
export type EmailLinkPurpose = Extract<AuthTokenPurpose, "password-reset" | "email-verify">;

/**
 * One emailed link. Only the SHA-256 of the token is kept, so a copy of the
 * database can't be turned into working links; Mongo's TTL index removes the
 * row once it expires.
 */
export type AuthTokenDoc = {
  userId: ObjectId;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  /** For a passkey sign-in challenge: the first factor that already passed. */
  factor?: "pwd" | "google";
};

export type TorContract = {
  vendor: string;
  /** The contract number e-GP itself assigns. */
  number: string | null;
  signedAt: Date | null;
  amount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  durationDays: number | null;
};

export type TorDoc = {
  title: string;
  agency: string;
  budget: string;
  deadline: string;
  daysLeft: number;
  /**
   * The last day of public comment on the draft, as an ISO date in Bangkok —
   * set when the portal publishes the comment window (MEA's drafts). Kept once
   * the project moves on, when `deadline` starts meaning the bid deadline.
   * Without it, what the model read off the draft (`extraction`) is used.
   */
  feedbackDeadline?: string;
  match: number;
  tags: string[];
  stage: (typeof TOR_STAGES)[number];
  summary: string;
  budgetStatus?: (typeof TOR_BUDGET_STATUSES)[number];
  createdAt: Date;
  /**
   * Set when an announcement is hidden from the listings. A soft delete rather
   * than a real one: these records are public procurement notices, so removing
   * one has to be reversible and has to leave a trace.
   */
  deletedAt?: Date;
  /** Set only on records imported from e-GP; absent on admin-entered ones. */
  sourceRef?: string;
  /**
   * The announcement's page on the portal that published it — always a web page
   * a reader can open, never a file. The files themselves are in `documents`.
   */
  sourceUrl?: string;
  /**
   * What a model read out of the announcement document. Kept in its own field,
   * never merged into the ones above: those are what an agency published, this
   * is inferred, and the difference has to survive all the way to the reader.
   */
  extraction?: StoredExtraction;
  /**
   * Why the document couldn't be read, when it couldn't, and how many runs have
   * tried — a dead link stops being retried, a slow day does not.
   */
  extractionFailure?: { reason: string; failedAt: Date; attempts: number };
  /** e-GP's own project number, printed on every announcement of the project. */
  projectNumber?: string;
  /** Raw budget in baht, next to the formatted `budget` string. */
  budgetAmount?: number;
  /**
   * ราคากลาง — the agency's own price estimate, published with the invitation.
   * Not the budget: the national e-GP prints this one and never the other.
   */
  referencePrice?: number;
  /**
   * What the winning bid came to, on the announcements that publish it. Never
   * merged into `budget`: one is what an agency set aside beforehand, the other
   * what the work was awarded for, and a reader comparing announcements has to
   * be able to tell which number they are looking at.
   */
  awardedAmount?: number;
  /** Every announcement e-GP holds for the project, newest first. */
  documents?: { label: string; publishedAt: Date | null; url: string }[];
  /** Structured facts the portal has on file for the project — real, not inferred. */
  procurementMethod?: string;
  procurementType?: string;
  goodsCategory?: string;
  contractStatus?: string;
  /**
   * Set only on a datagov record the agency name alone didn't prove Bangkok —
   * the coordinates that did, kept so a later purge can re-run that same
   * decision instead of re-deriving it without the evidence it was made on.
   */
  location?: { lat: number; long: number };
  /**
   * The contracts e-GP has on file for the project, once one is signed — who
   * won, for how much, and over which dates. Real, published figures.
   */
  contracts?: TorContract[];
  /** When this record first entered the database. */
  importedAt?: Date;
  /**
   * The project's current step on the national e-GP, as its own flow names it
   * ("หนังสือเชิญชวน/ประกาศเชิญชวน"). The authority on whether bidding is over.
   */
  procurementStep?: { name: string | null; stage: ProcurementStage | null; checkedAt: Date };
  /**
   * Set once the e-GP document link and procurement facts have actually been
   * fetched (even if the portal had none to give). Absent means enrichment was
   * skipped — budget ran out, or the request timed out — so it's retried on the
   * next sync instead of being treated as "already have this".
   */
  enrichedAt?: Date;
  /** Which generation of enrichment produced the fields above (see EgpService). */
  enrichVersion?: number;
  /** Absent means software — see TOR_CLASSIFICATIONS. Only an admin sets it. */
  classification?: TorClassification;
  /** The last admin correction: who made it and when. Shown with the record. */
  lastEdited?: { by: string; at: Date };
  /**
   * Fields an admin corrected. A re-import leaves them as the admin left them,
   * and a record with any is never purged or superseded by an import.
   */
  lockedFields?: string[];
  /** The project owner account responsible for this announcement; what /api/owner reads by. */
  ownerId?: ObjectId;
};

/** A public comment on one announcement, shown only once it is approved. */
export type FeedbackDoc = {
  torId: ObjectId;
  /** Whatever the commenter typed; anonymous comments get a fallback name. */
  author: string;
  text: string;
  status: FeedbackStatus;
  createdAt: Date;
  reviewedAt?: Date;
};

/** Someone telling the admins an announcement is wrong (FR-21); never shown publicly. */
export type TorReportDoc = {
  torId: ObjectId;
  reason: ReportReason;
  message: string;
  /** The signed-in account that reported it; absent for a guest. */
  reporter?: { userId: ObjectId; email: string; name: string };
  /** How a guest asked to be reached, if they did. */
  contact?: string;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt?: Date;
  /** The admin who resolved it, by email, as the audit log names actors. */
  resolvedBy?: string;
};

/** One organization's bookmark of one TOR — the logged-in-only "saved" list. */
export type SavedTorDoc = {
  userId: ObjectId;
  torId: ObjectId;
  createdAt: Date;
};

/** The search page's filters, stored as it sent them; see SearchFiltersDto. */
export type SavedSearchFilters = {
  query?: string;
  sort?: string;
  statuses?: string[];
  deadline?: string;
  years?: number[];
  agencies?: string[];
  budgets?: string[];
};

export type SavedSearchDoc = {
  userId: ObjectId;
  name: string;
  filters: SavedSearchFilters;
  createdAt: Date;
};

/**
 * "match" comes from each import (MatchingService.notifyMatches) and
 * "approval" from account review. "feedback" has no producer yet, but the type
 * stays ready for when it does, the same way TorSource anticipates values
 * before every source exists.
 */
export const NOTIFICATION_TYPES = ["match", "approval", "feedback", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationDoc = {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  /** Set when the notification is about a specific announcement. */
  torId?: ObjectId;
  /** A match alert's score, 0-100, so the list can show it apart from the title. */
  score?: number;
  read: boolean;
  createdAt: Date;
};

/**
 * When a project is worth telling a company about: as soon as it appears
 * (plan, draft or reference price — time to prepare), and again when bids open.
 */
export type MatchAlertPhase = "early" | "invitation";

/**
 * One match alert already sent, so a company hears about each project once
 * per phase however many times it is imported or re-scored. Keyed by the
 * e-GP project number where there is one: each stage of a project is its own
 * record, and the draft and the invitation are still one project.
 */
export type MatchAlertDoc = {
  userId: ObjectId;
  projectKey: string;
  phase: MatchAlertPhase;
  createdAt: Date;
};

/**
 * "failed" means the whole run threw (the portal was fully unreachable, or
 * every feed errored) — "partial" is a run that still produced data but had
 * some feeds fail along the way. The admin dashboard's sync history needs to
 * tell those apart, not just pass/fail.
 */
export const SYNC_RUN_STATUSES = ["success", "partial", "failed"] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

/** One e-GP sync attempt — scheduled or triggered from the admin "sync now" button. */
export type SyncRunDoc = {
  startedAt: Date;
  finishedAt: Date;
  status: SyncRunStatus;
  fetched: number;
  imported: number;
  updated: number;
  /** Feed ids ("type/keyword") that errored during this run; empty on a clean success. */
  failedFeeds: string[];
  /** Set only when the run threw outright, i.e. status is "failed". */
  error?: string;
  /**
   * Titles the software filter turned down that still read like IT work — the
   * place a wrongly rejected tender shows up. Capped; see EgpService.
   */
  nearMisses?: { projectNumber: string; title: string }[];
};

/**
 * One attributable admin action (approving an account, moderating a comment,
 * hiding/restoring a TOR). Automatic pipeline events — e-GP syncs — are never
 * duplicated in here; the audit feed reads those straight from `syncRuns` and
 * merges them in at query time (see AuditService.findAll).
 */
export type AuditLogEntryDoc = {
  /** The admin's email, from their session — never a display name someone can spoof. */
  actor: string;
  action: string;
  detail: string;
  createdAt: Date;
};

/**
 * A change to who holds the admin role, waiting for a second admin (ASVS
 * 2.3.5). Granting or removing the role only takes effect once an admin other
 * than the one who asked approves it. MongoDB deletes a request at
 * `expiresAt` (TTL index), and there is at most one open request per account.
 */
export type AdminApprovalDoc = {
  targetId: ObjectId;
  /** Copied at request time, so the list and audit log read without a join. */
  targetEmail: string;
  targetName: string;
  /** The role when asked; approval is refused if it changed in the meantime. */
  fromRole: Role;
  toRole: Role;
  requestedBy: { id: ObjectId; email: string };
  createdAt: Date;
  expiresAt: Date;
};

/**
 * One TOR's embedding for "find similar". Kept out of `tors` on purpose: a
 * vector is ~6 KB of numbers no listing reads, and every listing would carry
 * it. `textHash` is of the text that was embedded, so an edited title or a new
 * extraction makes the vector stale and it is embedded again.
 */
export type TorEmbeddingDoc = {
  torId: ObjectId;
  model: string;
  textHash: string;
  vector: number[];
  updatedAt: Date;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client = new MongoClient(env.mongodbUri, {
    maxPoolSize: env.database.maxPoolSize,
    waitQueueTimeoutMS: env.database.waitQueueTimeoutMs,
    serverSelectionTimeoutMS: env.database.serverSelectionTimeoutMs,
  });

  users!: Collection<UserDoc>;
  tors!: Collection<TorDoc>;
  feedback!: Collection<FeedbackDoc>;
  torReports!: Collection<TorReportDoc>;
  savedTors!: Collection<SavedTorDoc>;
  savedSearches!: Collection<SavedSearchDoc>;
  notifications!: Collection<NotificationDoc>;
  syncRuns!: Collection<SyncRunDoc>;
  auditLogEntries!: Collection<AuditLogEntryDoc>;
  authTokens!: Collection<AuthTokenDoc>;
  matchAlerts!: Collection<MatchAlertDoc>;
  torEmbeddings!: Collection<TorEmbeddingDoc>;
  adminApprovals!: Collection<AdminApprovalDoc>;
  /** Scans companies attach to their certificates; only ever read by their owner. */
  certificateFiles!: GridFSBucket;
  /** Reference letters and CVs from the proposal library; only ever read by their owner. */
  libraryFiles!: GridFSBucket;

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.users = this.client.db().collection<UserDoc>("users");
    this.tors = this.client.db().collection<TorDoc>("tors");
    this.feedback = this.client.db().collection<FeedbackDoc>("feedback");
    this.torReports = this.client.db().collection<TorReportDoc>("torReports");
    this.savedTors = this.client.db().collection<SavedTorDoc>("savedTors");
    this.savedSearches = this.client.db().collection<SavedSearchDoc>("savedSearches");
    this.notifications = this.client.db().collection<NotificationDoc>("notifications");
    this.syncRuns = this.client.db().collection<SyncRunDoc>("syncRuns");
    this.auditLogEntries = this.client.db().collection<AuditLogEntryDoc>("auditLogEntries");
    this.authTokens = this.client.db().collection<AuthTokenDoc>("authTokens");
    this.matchAlerts = this.client.db().collection<MatchAlertDoc>("matchAlerts");
    this.torEmbeddings = this.client.db().collection<TorEmbeddingDoc>("torEmbeddings");
    this.adminApprovals = this.client.db().collection<AdminApprovalDoc>("adminApprovals");
    this.certificateFiles = new GridFSBucket(this.client.db(), { bucketName: "certificateFiles" });
    this.libraryFiles = new GridFSBucket(this.client.db(), { bucketName: "libraryFiles" });
    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.users.createIndex({ status: 1, createdAt: -1 });
    await this.users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
    // A credential belongs to one account. Partial rather than sparse: an
    // empty `passkeys` array must not count as a value two accounts share.
    await this.users.createIndex(
      { "passkeys.id": 1 },
      { unique: true, partialFilterExpression: { "passkeys.id": { $exists: true } } },
    );
    await this.tors.createIndex({ createdAt: -1 });
    // An owner's dashboard lists only their own announcements, newest first.
    await this.tors.createIndex({ ownerId: 1, createdAt: -1 });
    // Makes the e-GP import idempotent: re-running it updates instead of duplicating.
    await this.tors.createIndex({ sourceRef: 1 }, { unique: true, sparse: true });
    // Serves the "which projects already have a winner" lookup every listing makes.
    await this.tors.createIndex({ stage: 1, projectNumber: 1 });
    // The two ways comments are read: under one announcement, and in the
    // moderation queue.
    await this.feedback.createIndex({ torId: 1, createdAt: -1 });
    await this.feedback.createIndex({ status: 1, createdAt: -1 });
    // The admin list reads open reports newest first; a TOR's own reports by TOR.
    await this.torReports.createIndex({ status: 1, createdAt: -1 });
    await this.torReports.createIndex({ torId: 1, createdAt: -1 });
    // Doubles as the natural key: a save is idempotent, never duplicated.
    await this.savedTors.createIndex({ userId: 1, torId: 1 }, { unique: true });
    // findOwn reads one account's saves newest first; this serves it without an in-memory sort.
    await this.savedTors.createIndex({ userId: 1, createdAt: -1 });
    await this.savedSearches.createIndex({ userId: 1, name: 1 }, { unique: true });
    await this.savedSearches.createIndex({ userId: 1, createdAt: -1 });
    await this.notifications.createIndex({ userId: 1, createdAt: -1 });
    // The only query pattern the admin dashboard needs: newest runs first.
    await this.syncRuns.createIndex({ startedAt: -1 });
    await this.auditLogEntries.createIndex({ createdAt: -1 });
    await this.authTokens.createIndex({ tokenHash: 1 }, { unique: true });
    await this.authTokens.createIndex({ userId: 1, purpose: 1 });
    // Mongo deletes each link once it expires; a used one is deleted on use.
    await this.authTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    // Doubles as the guard: two runs racing on one project can't both alert.
    await this.matchAlerts.createIndex({ userId: 1, projectKey: 1, phase: 1 }, { unique: true });
    await this.torEmbeddings.createIndex({ torId: 1, model: 1 }, { unique: true });
    // One open admin-role request per account; a second ask gets a duplicate-key error.
    await this.adminApprovals.createIndex({ targetId: 1 }, { unique: true });
    // An unapproved request lapses on its own (env.adminApproval.expiryHours).
    await this.adminApprovals.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.applyRetention();
    await this.backfillAccountStatus();
    await this.backfillCmmiLevel();
    await this.seed();
    // After seeding, so the demo companies start out with records too.
    await this.backfillCertificateRecords();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  /** Accounts created before approvals existed were already in use, so they count as approved. */
  /**
   * ASVS 14.2.7: data with no further use is deleted on a schedule, by MongoDB
   * itself (TTL indexes, checked about once a minute), so nothing depends on a
   * job remembering to run. The periods are in env.retention and the reasons in
   * docs/operations/limits-and-retention.md. Emailed links already expire the
   * same way (authTokens above).
   */
  private async applyRetention(): Promise<void> {
    const r = env.retention;
    await this.ensureTtlIndex(this.notifications, "createdAt", r.notificationsDays, "retention_notifications");
    await this.ensureTtlIndex(this.syncRuns, "startedAt", r.syncRunsDays, "retention_sync_runs");
    await this.ensureTtlIndex(this.auditLogEntries, "createdAt", r.auditLogDays, "retention_audit_log");
    // A company that signed up but never confirmed its address can't sign in
    // and was never reviewed: after the period it is deleted, freeing the
    // address. An approved or rejected account never matches.
    await this.ensureTtlIndex(this.users, "createdAt", r.unverifiedSignupDays, "retention_unverified_signups", {
      emailVerified: false,
      status: "pending",
    });
  }

  /**
   * Creates the named TTL index, or brings an existing one to the configured
   * period (collMod, so the index isn't rebuilt), or drops it when the period
   * is 0 ("keep forever").
   */
  private async ensureTtlIndex<T extends Document>(
    collection: Collection<T>,
    field: string,
    days: number,
    name: string,
    partialFilterExpression?: Document,
  ): Promise<void> {
    const existing = (await collection.listIndexes().toArray()).find((index) => index.name === name);
    if (days <= 0) {
      if (existing) await collection.dropIndex(name);
      return;
    }
    const expireAfterSeconds = Math.round(days * 24 * 60 * 60);
    if (!existing) {
      await collection.createIndex({ [field]: 1 }, { name, expireAfterSeconds, ...(partialFilterExpression && { partialFilterExpression }) });
    } else if (existing.expireAfterSeconds !== expireAfterSeconds) {
      await this.client.db().command({ collMod: collection.collectionName, index: { name, expireAfterSeconds } });
    }
  }

  private async backfillAccountStatus(): Promise<void> {
    const { modifiedCount } = await this.users.updateMany(
      { status: { $exists: false } },
      { $set: { status: "approved" } },
    );
    if (modifiedCount > 0) this.logger.log(`Backfilled status on ${modifiedCount} accounts`);
  }

  /**
   * "cmmi" was one option before levels were split; level 3 is the floor any
   * CMMI holder meets, so it never claims more than the company told us.
   */
  private async backfillCmmiLevel(): Promise<void> {
    const legacy = "cmmi" as Certification;
    const { modifiedCount } = await this.users.updateMany(
      { "company.certifications": legacy },
      { $set: { "company.certifications.$": "cmmi3" } },
    );
    if (modifiedCount > 0) this.logger.log(`Backfilled CMMI level on ${modifiedCount} accounts`);
  }

  /**
   * Each ticked certification becomes a record with only its name filled in —
   * the company adds the issuer, dates and file later. Nothing is lost: a
   * record without dates counts as held, exactly as the tick did.
   */
  private async backfillCertificateRecords(): Promise<void> {
    const legacy = await this.users
      .find(
        { "company.certifications": { $exists: true }, "company.certificates": { $exists: false } },
        { projection: { "company.certifications": 1 } },
      )
      .toArray();
    if (legacy.length === 0) return;

    const now = new Date();
    await this.users.bulkWrite(
      legacy.map(({ _id, company }) => ({
        updateOne: {
          filter: { _id, "company.certificates": { $exists: false } },
          update: {
            $set: {
              "company.certificates": (company?.certifications ?? [])
                .filter((key) => key in CERTIFICATIONS)
                .map((standard) => ({
                  id: new ObjectId().toHexString(),
                  name: CERTIFICATIONS[standard].label,
                  standard,
                  createdAt: now,
                  updatedAt: now,
                })),
            },
          },
        },
      })),
    );
    this.logger.log(`Turned ticked certifications into records on ${legacy.length} accounts`);
  }

  /**
   * Demo accounts only, and only when the collection is empty. TOR records are
   * never seeded: the public pages show real e-GP announcements, so fake ones
   * would be indistinguishable from the imported data.
   */
  private async seed(): Promise<void> {
    if (!env.seedDemoData) return;
    await this.seedUsers();
  }

  /**
   * Adds whichever demo accounts are missing, by email, so a demo account
   * added later (e.g. the second admin) reaches an existing local database
   * too. One that already exists is left exactly as it is: its password,
   * role and approval may have been changed on purpose.
   */
  private async seedUsers(): Promise<void> {
    const existing = new Set(
      (await this.users.find({ email: { $in: SEED_USERS.map((u) => u.email) } }, { projection: { email: 1 } }).toArray()).map(
        (u) => u.email,
      ),
    );
    const missing = SEED_USERS.filter((u) => !existing.has(u.email));
    if (missing.length === 0) return;

    const docs = await Promise.all(
      missing.map(async ({ password, ...user }) => {
        return { ...user, ...(await passwordFields(password)), createdAt: new Date() };
      }),
    );

    // ordered: false — another backend booting at the same moment may insert
    // the same account first; its duplicate-key error is the expected outcome.
    try {
      await this.users.insertMany(docs, { ordered: false });
    } catch (error) {
      if (!(error instanceof MongoBulkWriteError && error.code === 11000)) throw error;
    }
    this.logger.log(`Seeded ${docs.length} demo users`);
    if (env.isProduction) {
      // Their passwords are in the README, so anyone can sign in as admin here.
      this.logger.warn(
        "SEED_DEMO_DATA=true in production: demo accounts with published passwords now exist — only acceptable on a private local machine (ASVS 6.3.2)",
      );
    }
  }
}
