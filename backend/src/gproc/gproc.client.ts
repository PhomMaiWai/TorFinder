import { Injectable, Logger } from "@nestjs/common";

import { HttpClient } from "../common/http-client";
import { readZip } from "../common/zip";
import { ProcurementStage, STAGE } from "../tor/tor.constants";
import {
  GPROC_ANNOUNCE_TYPES,
  GPROC_CANCELLED,
  GPROC_ENDPOINTS,
  GPROC_IGNORED_TYPES,
  GPROC_REQUEST,
  stageFromFlow,
} from "./gproc.constants";
import {
  GprocAnnouncement,
  GprocAnnouncementList,
  GprocDocument,
  GprocDocumentInfo,
  GprocEnvelope,
  GprocProjectDetail,
} from "./gproc.types";

const PDF_MAGIC = "%PDF-";
const { draft: DRAFT_STAGE, invitation: INVITATION_STAGE } = STAGE;

/** The bidding document e-GP generates: conditions, qualifications, payment, penalties. */
const BIDDING_DOCUMENT = /^doc_.*\.pdf$/i;
/**
 * The standard forms every bundle carries — bonds, price sheets, definitions,
 * the contract template — which say nothing about this project in particular.
 * What is left after them is the agency's own TOR.
 */
const STANDARD_FORM = /quotation|bond|definition|document part|notice|noltice|domestic|performance|contract|annoudoc|payment|action_plan/i;

const isPdf = (bytes: Buffer) => bytes.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;

/**
 * Read-only access to one project at a time on the national e-GP. Every call
 * here is one the portal's own project page makes; none is behind its bot
 * check, and nothing here tries to get past it.
 */
@Injectable()
export class GprocClient {
  private readonly http = new HttpClient(
    GPROC_ENDPOINTS.base,
    { timeoutMs: GPROC_REQUEST.timeoutMs, maxRetries: GPROC_REQUEST.maxRetries },
    new Logger(GprocClient.name),
  );

  /** Null when process5 has no such project. */
  async projectDetail(projectNumber: string): Promise<GprocProjectDetail | null> {
    const body = await this.http.get<GprocEnvelope<Partial<GprocProjectDetail>>>(
      `${GPROC_ENDPOINTS.announcement}/getProjectDetail`,
      { projectId: projectNumber },
    );
    const detail = body.data;
    if (!detail?.projectId) return null;
    return {
      projectId: String(detail.projectId),
      projectName: detail.projectName?.trim() || null,
      projectStatus: detail.projectStatus ?? null,
      announceType: detail.announceType ?? null,
      methodId: detail.methodId ?? null,
      deptName: detail.deptName?.trim() || null,
      deptSubName: detail.deptSubName?.trim() || null,
    };
  }

  /**
   * Where the project stands in e-GP's own procurement flow. A cancelled
   * project keeps the name of the step it stopped at, so its status code
   * decides that case, not the name.
   */
  async procurementStep(
    projectNumber: string,
  ): Promise<{ name: string | null; stage: ProcurementStage | null } | null> {
    const [flow, detail] = await Promise.all([
      this.http.get<GprocEnvelope<{ flowName?: string | null }>>(
        `${GPROC_ENDPOINTS.announcement}/getProcurementDetail`,
        { projectId: projectNumber },
      ),
      this.projectDetail(projectNumber),
    ]);
    if (!flow.data && !detail) return null;
    const name = flow.data?.flowName?.trim() || null;
    if (detail?.projectStatus === GPROC_CANCELLED) return { name, stage: "cancelled" };

    // The step group "หนังสือเชิญชวน/ประกาศเชิญชวน" starts with the draft put out
    // for comment, so on its own it doesn't mean the invitation is out. Read as
    // "invitation", a draft still taking comments would be shown superseded.
    // `announceType` is the project's first announcement, not its latest, so
    // a project that opened with a draft is settled by its announcement list.
    const stage = stageFromFlow(name);
    if (stage === "invitation" && detail && GPROC_ANNOUNCE_TYPES[detail.announceType ?? ""]?.stage === DRAFT_STAGE) {
      const announced = await this.announcements(detail);
      const invited = announced.some((a) => GPROC_ANNOUNCE_TYPES[a.announceType]?.stage === INVITATION_STAGE);
      if (!invited) return { name, stage: "tor" };
    }
    return { name, stage };
  }

  /** The project's paper trail, oldest first. Needs the detail's method and type. */
  async announcements(detail: GprocProjectDetail): Promise<GprocAnnouncement[]> {
    if (!detail.methodId || !detail.announceType) return [];
    const body = await this.http.get<GprocEnvelope<GprocAnnouncementList>>(
      `${GPROC_ENDPOINTS.announcement}/greenBook`,
      {
        mode: "LINK",
        methodId: detail.methodId,
        tempProjectId: detail.projectId,
        pageAnnounceType: detail.announceType,
      },
    );

    return (body.data?.greenBookAnnouncementTypeLinkDto ?? [])
      .filter(
        (row): row is Partial<GprocAnnouncement> & { announceType: string } =>
          typeof row?.announceType === "string" && !GPROC_IGNORED_TYPES.has(row.announceType),
      )
      .map((row) => ({
        announceType: row.announceType,
        announceDate: row.announceDate ?? null,
        priceBuild: typeof row.priceBuild === "number" && row.priceBuild > 0 ? row.priceBuild : null,
      }))
      .sort((a, b) => (a.announceDate ?? "").localeCompare(b.announceDate ?? ""));
  }

  /**
   * The signed invitation as a PDF, or null before there is one. Unlike the
   * file a city portal attaches — sometimes the unfilled template — this is
   * rendered from what the agency actually published, bid date included.
   */
  async invitationPdf(projectNumber: string): Promise<Buffer | null> {
    const info = await this.http.get<GprocEnvelope<GprocDocumentInfo>>(GPROC_ENDPOINTS.documentInfo, {
      projectId: projectNumber,
    });
    const templateId = info.data?.buildName2;
    if (!templateId) return null;

    const rendered = await this.http.post<GprocEnvelope<string>>(GPROC_ENDPOINTS.renderPdf, { templateId });
    if (!rendered.data) return null;
    const pdf = Buffer.from(rendered.data, "base64");
    return isPdf(pdf) ? pdf : null;
  }

  /**
   * The documents that say what the work is and who may bid: the bidding
   * document and the agency's TOR, out of the project's published bundle — or
   * the draft bundle before there is one. Within `maxBytes` together, the
   * bidding document first since it carries the qualifications.
   */
  async tenderDocuments(projectNumber: string, maxBytes: number): Promise<GprocDocument[]> {
    for (const path of [GPROC_ENDPOINTS.documentInfo, GPROC_ENDPOINTS.draftDocumentInfo]) {
      const info = await this.http.get<GprocEnvelope<GprocDocumentInfo>>(path, { projectId: projectNumber });
      const zipId = info.data?.zipId;
      if (!zipId) continue;

      const zip = await this.http.getBytes(GPROC_ENDPOINTS.download, { fileId: zipId }, GPROC_REQUEST.maxBundleBytes);
      const pdfs = readZip(zip).filter((entry) => /\.pdf$/i.test(entry.name) && entry.size > 0);
      const bidding = pdfs.find((entry) => BIDDING_DOCUMENT.test(entry.name));
      const tor = pdfs
        .filter((entry) => entry !== bidding && !STANDARD_FORM.test(entry.name))
        .sort((a, b) => b.size - a.size)[0];

      const picked: GprocDocument[] = [];
      let room = maxBytes;
      for (const [entry, label] of [
        [bidding, "เอกสารประกวดราคา (e-GP กรมบัญชีกลาง)"],
        [tor, "ขอบเขตของงาน TOR (e-GP กรมบัญชีกลาง)"],
      ] as const) {
        if (!entry || entry.size > room) continue;
        const pdf = entry.read();
        if (!isPdf(pdf)) continue;
        picked.push({ label, pdf });
        room -= pdf.byteLength;
      }
      if (picked.length) return picked;
    }
    return [];
  }
}
