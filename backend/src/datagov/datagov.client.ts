import { Injectable, Logger } from "@nestjs/common";

import { HttpClient } from "../common/http-client";
import { CGD_DATASETS, DATAGOV_ENDPOINTS, DATAGOV_REQUEST } from "./datagov.constants";
import {
  CgdContractRow,
  CgdLocationRow,
  CkanDatastoreSearch,
  CkanEnvelope,
  CkanPackage,
  CkanPackageSearch,
  CkanResource,
} from "./datagov.types";

/** CKAN reports its own failures inside a 200 response, so unwrap explicitly. */
function unwrap<T>(envelope: CkanEnvelope<T>, action: string): T {
  if (!envelope.success || envelope.result === undefined) {
    throw new Error(`data.go.th ${action}: ${envelope.error?.message ?? "unknown error"}`);
  }
  return envelope.result;
}

@Injectable()
export class DataGovClient {
  private readonly http = new HttpClient(
    DATAGOV_ENDPOINTS.api,
    { timeoutMs: DATAGOV_REQUEST.timeoutMs, maxRetries: DATAGOV_REQUEST.maxRetries },
    new Logger(DataGovClient.name),
  );

  /**
   * The monthly procurement packages, newest first. Sorting on the portal
   * rather than here is what lets a caller that only wants recent months stop
   * after one page instead of walking the whole catalogue.
   */
  async procurementPackages(start = 0, rows: number = DATAGOV_REQUEST.searchRows): Promise<CkanPackage[]> {
    const body = await this.http.get<CkanEnvelope<CkanPackageSearch>>("/package_search", {
      q: CGD_DATASETS.query,
      fq: `organization:${CGD_DATASETS.organization}`,
      sort: "metadata_modified desc",
      rows: String(rows),
      start: String(start),
    });
    return unwrap(body, "package_search").results;
  }

  /**
   * The awarded-contract table of one package, or null when it has none — a
   * package can hold only the location table, or files never loaded into the
   * datastore, and neither can be read row by row.
   */
  contractResource(pkg: CkanPackage): CkanResource | null {
    return (
      pkg.resources.find(
        (resource) =>
          resource.datastore_active && resource.name.endsWith(CGD_DATASETS.resourceSuffix),
      ) ?? null
    );
  }

  /**
   * Every row of one contract table, a page at a time, so a caller filters and
   * discards as it goes instead of holding 25,000 rows in memory.
   *
   * `query` is handed to the datastore's own full-text index, which stems and
   * matches loosely: it exists to cut what crosses the wire, and never to
   * decide what counts as software work — isSoftwareProject does that.
   */
  async *contractRows(resourceId: string, query?: string): AsyncGenerator<CgdContractRow[]> {
    const pageSize = DATAGOV_REQUEST.datastorePageSize;

    for (let offset = 0; ; offset += pageSize) {
      const params: Record<string, string> = {
        resource_id: resourceId,
        limit: String(pageSize),
        offset: String(offset),
      };
      if (query) params.q = query;

      const body = await this.http.get<CkanEnvelope<CkanDatastoreSearch<CgdContractRow>>>(
        "/datastore_search",
        params,
      );
      const { records, total } = unwrap(body, "datastore_search");

      if (records.length === 0) return;
      yield records;
      // `total` is the size of the whole result, not of this page — trusting it
      // alone would spend one extra request per table on an exact multiple.
      if (offset + records.length >= total) return;
    }
  }

  /**
   * The table that places one month's projects on the map, when the month has
   * one. Kept separate from the contract table because it is optional: a
   * package that never got one still imports.
   */
  locationResource(pkg: CkanPackage): CkanResource | null {
    return (
      pkg.resources.find(
        (resource) =>
          resource.datastore_active && resource.name.endsWith(CGD_DATASETS.locationSuffix),
      ) ?? null
    );
  }

  /**
   * Where one project is, or null when the table doesn't have it. Asked per
   * project rather than by reading the whole table: only a handful of contracts
   * per month are software work, and the table runs to tens of thousands of rows.
   */
  async projectLocation(resourceId: string, projectNo: string): Promise<CgdLocationRow | null> {
    const body = await this.http.get<CkanEnvelope<CkanDatastoreSearch<CgdLocationRow>>>(
      "/datastore_search",
      { resource_id: resourceId, filters: JSON.stringify({ proj_no: Number(projectNo) }), limit: "1" },
    );
    return unwrap(body, "datastore_search").records[0] ?? null;
  }

  /** The dataset's public page — the citable link for a row imported from it. */
  datasetUrl(pkg: CkanPackage): string {
    return `${DATAGOV_ENDPOINTS.dataset}/${pkg.name}`;
  }
}
