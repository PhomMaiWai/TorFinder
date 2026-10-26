import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { ArchiveFile, ArchiveFileData, readShowableFile, showableFiles } from "../common/archive-files";
import { TtlCache } from "../common/ttl-cache";
import { readZip, ZipEntry } from "../common/zip";
import { DatabaseService } from "../database/database.service";
import { GprocClient } from "./gproc.client";
import { PROJECT_NUMBER } from "./gproc.constants";

/** A single PDF the portal renders. */
export const EGP_FILE_KINDS = ["invitation"] as const;
/** A zipped bundle, shown file by file. */
export const EGP_BUNDLE_KINDS = ["bundle", "draft-bundle"] as const;
export type EgpFileKind = (typeof EGP_FILE_KINDS)[number];
export type EgpBundleKind = (typeof EGP_BUNDLE_KINDS)[number];

export type EgpDocument = {
  kind: EgpFileKind | EgpBundleKind;
  label: string;
  archive: boolean;
  /**
   * Which of the record's own announcement labels this stands in for, as a
   * pattern — so the page can show this file in place of a row that only
   * links out, instead of listing the same announcement twice.
   */
  covers: string;
};

const DOCUMENTS: Record<EgpFileKind | EgpBundleKind, Omit<EgpDocument, "kind">> = {
  invitation: { label: "ประกาศเชิญชวน (e-GP กรมบัญชีกลาง)", archive: false, covers: "ประกาศเชิญชวน" },
  bundle: { label: "ชุดเอกสารประกวดราคา (e-GP กรมบัญชีกลาง)", archive: true, covers: "^เอกสารประกวดราคา" },
  "draft-bundle": { label: "ชุดร่างเอกสารประกวดราคา (e-GP กรมบัญชีกลาง)", archive: true, covers: "^ร่าง" },
};

type Sources = { invitationTemplate: string | null; bundle: string | null; draftBundle: string | null };

/** What a project has published changes over days, not minutes. */
const SOURCES_TTL_MS = 60 * 60 * 1000;
const FILE_TTL_MS = 30 * 60 * 1000;
/** A signed invitation is ~100 KB, so plenty fit. */
const INVITATIONS_KEPT = 30;
/**
 * A bundle can reach tens of MB (one TOR inside was 19 MB), so only a few are
 * kept: enough for people reading the same popular TOR, bounded at roughly
 * 3 × 40 MB of memory rather than growing with traffic.
 */
const BUNDLES_KEPT = 3;

/**
 * The national e-GP's own copies of a project's documents: the signed
 * invitation, and the published and draft bundles with every file in them.
 * Fetched on demand, by project number, through the same public calls the
 * portal's project page makes. process5 rate-limits hard and serves bundles
 * slowly, so every answer is cached and concurrent readers of one project
 * share a single request.
 */
@Injectable()
export class EgpDocumentsService {
  private readonly sources = new TtlCache<string, Promise<Sources>>(SOURCES_TTL_MS, 500);
  private readonly invitations = new TtlCache<string, Promise<Buffer | null>>(FILE_TTL_MS, INVITATIONS_KEPT);
  private readonly bundles = new TtlCache<string, Promise<ZipEntry[]>>(FILE_TTL_MS, BUNDLES_KEPT);

  constructor(
    private readonly db: DatabaseService,
    private readonly gproc: GprocClient,
  ) {}

  async list(torId: string): Promise<EgpDocument[]> {
    const projectNumber = await this.projectNumberOf(torId);
    if (!projectNumber) return [];
    const sources = await this.sourcesOf(projectNumber);

    const available: Record<EgpDocument["kind"], boolean> = {
      invitation: Boolean(sources.invitationTemplate),
      bundle: Boolean(sources.bundle),
      // Kept after the invitation: the draft is what was put out for comment, and it can differ.
      "draft-bundle": Boolean(sources.draftBundle),
    };
    return (Object.keys(DOCUMENTS) as EgpDocument["kind"][])
      .filter((kind) => available[kind])
      .map((kind) => ({ kind, ...DOCUMENTS[kind] }));
  }

  async file(torId: string, kind: EgpFileKind): Promise<{ pdf: Buffer; filename: string }> {
    const projectNumber = await this.requireProjectNumber(torId);
    const { invitationTemplate } = await this.sourcesOf(projectNumber);
    if (!invitationTemplate) throw new NotFoundException("ไม่พบเอกสารนี้บน e-GP");

    const pdf = await this.invitations.getOrLoad(invitationTemplate, () =>
      this.gproc.renderTemplate(invitationTemplate),
    );
    if (!pdf) throw new NotFoundException("ไม่พบเอกสารนี้บน e-GP");
    return { pdf, filename: `${projectNumber}-${kind}.pdf` };
  }

  async bundleFiles(torId: string, kind: EgpBundleKind): Promise<ArchiveFile[]> {
    return showableFiles(await this.bundle(torId, kind));
  }

  async bundleFile(torId: string, kind: EgpBundleKind, position: number): Promise<ArchiveFileData> {
    return readShowableFile(await this.bundle(torId, kind), position);
  }

  private async bundle(torId: string, kind: EgpBundleKind): Promise<ZipEntry[]> {
    const projectNumber = await this.requireProjectNumber(torId);
    const sources = await this.sourcesOf(projectNumber);
    const zipId = kind === "bundle" ? sources.bundle : sources.draftBundle;
    if (!zipId) throw new NotFoundException("ไม่พบชุดเอกสารนี้บน e-GP");

    return this.bundles.getOrLoad(zipId, async () => {
      const zip = await this.gproc.downloadBundle(zipId);
      try {
        return readZip(zip);
      } catch {
        throw new NotFoundException("เปิดชุดเอกสารนี้ไม่ได้");
      }
    });
  }

  private sourcesOf(projectNumber: string): Promise<Sources> {
    return this.sources.getOrLoad(projectNumber, () => this.gproc.documentSources(projectNumber));
  }

  private async requireProjectNumber(torId: string): Promise<string> {
    const projectNumber = await this.projectNumberOf(torId);
    if (!projectNumber) throw new NotFoundException("ประกาศนี้ไม่มีเลขโครงการ e-GP");
    return projectNumber;
  }

  private async projectNumberOf(torId: string): Promise<string | null> {
    if (!ObjectId.isValid(torId)) throw new NotFoundException("ไม่พบรายการ TOR");
    const tor = await this.db.tors.findOne({ _id: new ObjectId(torId) }, { projection: { projectNumber: 1 } });
    if (!tor) throw new NotFoundException("ไม่พบรายการ TOR");
    return tor.projectNumber && PROJECT_NUMBER.test(tor.projectNumber) ? tor.projectNumber : null;
  }
}
