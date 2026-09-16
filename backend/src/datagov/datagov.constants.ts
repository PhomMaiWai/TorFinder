/**
 * Which portal this integration talks to. Not environment config: CKAN's action
 * API is a shape, not just an address — pointing this somewhere else means a
 * different API, i.e. different code.
 */
export const DATAGOV_ENDPOINTS = {
  api: "https://data.go.th/api/3/action",
  dataset: "https://data.go.th/dataset",
} as const;

/**
 * กรมบัญชีกลาง publishes one package per month, each holding a `*_contract`
 * table of awarded contracts and a `*_project_location` table of where the work
 * is carried out. Only the contract table names the project, the agency and the
 * budget, so it is the only one imported.
 *
 * Other publishers post the same reports as PDFs and spreadsheets that are not
 * loaded into the datastore — unreadable row by row, and deliberately skipped.
 */
export const CGD_DATASETS = {
  organization: "cgd",
  query: "รายงานการจัดซื้อจัดจ้างของหน่วยงานภาครัฐ",
  resourceSuffix: "_contract",
  /**
   * The sibling table, which gives a project a point on the map. Nothing else
   * the portal publishes says where the work is, and this source is national —
   * so without it a Bangkok-only product cannot tell whether a contract is its
   * business. Not every month has one, and the ones that do don't cover every
   * project, which is why a hit here proves Bangkok and a miss proves nothing.
   */
  locationSuffix: "_project_location",
} as const;

/** Client behaviour, not deployment config: how one request is made. */
export const DATAGOV_REQUEST = {
  /** The datastore serves this comfortably; one monthly table runs to ~25k rows. */
  datastorePageSize: 1_000,
  /** Package search is cheap and the monthly packages are few. */
  searchRows: 50,
  timeoutMs: 20_000,
  maxRetries: 3,
} as const;
