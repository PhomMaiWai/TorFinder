import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { mapWithLimit } from "../common/concurrency";
import { SOFTWARE_SEARCH_KEYWORDS, isSoftwareProject } from "../common/software-filter";
import { ImportRecord, SyncResult, TorImportService } from "../tor/tor-import.service";
import { isPointInBangkok, namesBangkok } from "../tor/thai-locality";
import {
  UNKNOWN,
  cleanText,
  extractProjectNumber,
  formatBaht,
  parseDate,
} from "../tor/tor-normalize";
import { DataGovClient } from "./datagov.client";
import { CGD_DATASETS } from "./datagov.constants";
import { CgdContractRow, CkanPackage, CkanResource } from "./datagov.types";

/**
 * How many monthly packages one sync reads. The catalogue goes back to 2015 and
 * never changes retroactively, so there is nothing to gain from walking all of
 * it every time — and a first run still reaches the whole archive by being run
 * more than once.
 */
const PACKAGES_PER_SYNC = 6;

/** Searches in flight against the portal — lower it if it starts rate-limiting. */
const SEARCH_CONCURRENCY = 5;

/** Stable identity of one contract, which is what keeps imports idempotent. */
const sourceRefFor = (row: CgdContractRow) => `datagov:${row.proj_no}`;

@Injectable()
export class DataGovService {
  private readonly logger = new Logger(DataGovService.name);

  private inFlight: Promise<SyncResult> | null = null;

  constructor(
    private readonly client: DataGovClient,
    private readonly importer: TorImportService,
  ) {}

  sync(): Promise<SyncResult> {
    this.inFlight ??= this.runSync().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runSync(): Promise<SyncResult> {
    const { records, failed } = await this.collect();

    if (failed.length && records.length === 0) {
      throw new ServiceUnavailableException("ดึงข้อมูลจากระบบข้อมูลเปิดภาครัฐไม่สำเร็จ");
    }
    if (records.length === 0) {
      return { fetched: 0, imported: 0, updated: 0, skipped: 0, superseded: 0, failed };
    }

    const result = await this.importer.import("datagov", records);
    // Records imported before this source was limited to Bangkok are dropped
    // here: the agency name is all a stored record keeps of where the work was.
    await this.importer.purge(
      "datagov",
      (doc) => isSoftwareProject(doc.title, doc.goodsCategory) && namesBangkok(doc.agency, doc.title),
    );

    return { ...result, failed };
  }

  /**
   * Each keyword search runs against the portal's own index, which stems and
   * matches loosely — it is there to keep the transfer down, not to decide what
   * counts. A table holds ~25,000 rows and the keywords narrow that to tens,
   * which is then judged properly by isSoftwareProject.
   */
  private async collect(): Promise<{ records: ImportRecord[]; failed: string[] }> {
    const failed: string[] = [];
    let packages: CkanPackage[] = [];

    try {
      packages = await this.client.procurementPackages(0, PACKAGES_PER_SYNC);
    } catch {
      return { records: [], failed: [CGD_DATASETS.query] };
    }

    // Keyed by contract, so a project matching several keywords is carried once.
    const rows = new Map<string, { row: CgdContractRow; pkg: CkanPackage }>();

    const searches = packages.flatMap((pkg) => {
      const resource = this.client.contractResource(pkg);
      return resource ? SOFTWARE_SEARCH_KEYWORDS.map((keyword) => ({ pkg, resource, keyword })) : [];
    });

    // The month's map table, looked up once per package rather than per row.
    const locations = new Map<string, CkanResource | null>(
      packages.map((pkg) => [pkg.id, this.client.locationResource(pkg)]),
    );

    // Each search is a few sequential page requests; running them in a bounded
    // pool turns minutes of waiting into seconds without bursting.
    await mapWithLimit(searches, SEARCH_CONCURRENCY, () => true, async ({ pkg, resource, keyword }) => {
      try {
        for await (const page of this.client.contractRows(resource.id, keyword)) {
          for (const row of page) {
            if (!row.proj_no || !row.proj_name) continue;
            if (!isSoftwareProject(row.proj_name, row.typ_name)) continue;
            if (!(await this.isInBangkok(row, locations.get(pkg.id) ?? null))) continue;
            rows.set(sourceRefFor(row), { row, pkg });
          }
        }
      } catch {
        failed.push(`${pkg.name}/${keyword}`);
      }
    });

    this.logger.log(
      `data.go.th: ${rows.size} Bangkok contracts from ${packages.length} monthly datasets`,
    );
    return {
      records: [...rows.values()].map(({ row, pkg }) => this.toRecord(row, pkg)),
      failed,
    };
  }

  /**
   * Whether a contract is this product's business. The source is national and
   * publishes no province, so Bangkok has to be proven: the agency or the
   * project says so outright, or the month's map table places the work inside
   * the city. Anything unproven is left alone — an upcountry hospital's order
   * is noise in a listing for Bangkok, and most of this source is upcountry.
   */
  private async isInBangkok(row: CgdContractRow, location: CkanResource | null): Promise<boolean> {
    if (namesBangkok(row.subdep_name, row.proj_name)) return true;
    if (!location) return false;

    const point = await this.client
      .projectLocation(location.id, String(row.proj_no))
      .catch(() => null);
    return point?.lat != null && point.long != null && isPointInBangkok(point.lat, point.long);
  }

  /**
   * A contract, not an open announcement: the bidding closed before the report
   * was published, so there is no deadline to count down to. It is imported for
   * what an awarded contract tells a company — who buys this kind of work, and
   * at what price — which is also why the winner is named in the summary.
   */
  private toRecord(row: CgdContractRow, pkg: CkanPackage): ImportRecord {
    const title = cleanText(row.proj_name ?? "");
    const agency = cleanText(row.subdep_name ?? "") || UNKNOWN;
    const announcedAt = parseDate(row.contrct_date ?? row.annce_date);

    return {
      doc: {
        title,
        agency,
        budget: formatBaht(row.proj_mny),
        deadline: UNKNOWN,
        daysLeft: 0,
        match: 0,
        tags: [row.typ_name ? cleanText(row.typ_name) : "จัดซื้อจัดจ้าง"],
        stage: "ประกาศผู้ชนะ",
        summary: this.buildSummary(row, agency),
        createdAt: announcedAt ?? new Date(),
        sourceRef: sourceRefFor(row),
        sourceUrl: this.client.datasetUrl(pkg),
        projectNumber: extractProjectNumber(row.proj_no),
        budgetAmount: row.proj_mny ?? undefined,
        procurementMethod: row.mthd_name ? cleanText(row.mthd_name) : undefined,
        procurementType: row.typ_name ? cleanText(row.typ_name) : undefined,
        // The portal's own classification of the work, stored under the name
        // every source uses for it — so a later purge re-runs the filter on
        // exactly what the import decided with, not on the title alone.
        goodsCategory: row.typ_name ? cleanText(row.typ_name) : undefined,
      },
    };
  }

  private buildSummary(row: CgdContractRow, agency: string): string {
    return [
      `สัญญาจัดซื้อจัดจ้างของ${agency} (เลขที่โครงการ ${row.proj_no})`,
      row.proj_mny ? `วงเงินงบประมาณ ${formatBaht(row.proj_mny)}` : null,
      row.contrct_price ? `ราคาที่ตกลง ${formatBaht(row.contrct_price)}` : null,
      row.mthd_name ? `วิธี${cleanText(row.mthd_name)}` : null,
      row.corp_name ? `คู่สัญญา: ${cleanText(row.corp_name)}` : null,
      "ข้อมูลจากรายงานการจัดซื้อจัดจ้างของกรมบัญชีกลาง เผยแพร่ผ่าน data.go.th",
    ]
      .filter(Boolean)
      .join(" · ");
  }
}
