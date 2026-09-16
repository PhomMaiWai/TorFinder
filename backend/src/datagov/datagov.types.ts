/** Every CKAN action answers HTTP 200 in this envelope, failures included. */
export type CkanEnvelope<T> = {
  success: boolean;
  result?: T;
  error?: { message?: string; __type?: string };
};

export type CkanResource = {
  id: string;
  name: string;
  format: string;
  /** Only a resource loaded into the datastore can be read row by row. */
  datastore_active?: boolean;
};

export type CkanPackage = {
  id: string;
  /** The slug in the dataset's public URL, not its Thai title. */
  name: string;
  title: string;
  metadata_modified?: string;
  organization?: { name: string; title: string } | null;
  resources: CkanResource[];
};

export type CkanPackageSearch = { count: number; results: CkanPackage[] };

export type CkanDatastoreSearch<T> = { total: number; records: T[] };

/** One point of one project, from the monthly `*_project_location` table. */
export type CgdLocationRow = {
  proj_no: number | string | null;
  lat: number | null;
  long: number | null;
};

/**
 * One row of a กรมบัญชีกลาง monthly `*_contract` table. Every column is
 * nullable in practice: the portal republishes whatever each agency filed,
 * blanks included, so nothing here can be assumed present.
 */
export type CgdContractRow = {
  /** The project number printed on the agency's own announcement. */
  proj_no: number | string | null;
  proj_name: string | null;
  /** The buying agency — a department or one of its offices. */
  subdep_name: string | null;
  annce_date: string | null;
  /** Budget in baht, as opposed to `contrct_price`, what it was awarded for. */
  proj_mny: number | null;
  /** Procurement method, e.g. "เฉพาะเจาะจง", "e-bidding". */
  mthd_name: string | null;
  /** The portal's own classification of the work, e.g. "จ้างก่อสร้าง". */
  typ_name: string | null;
  corp_name: string | null;
  contrct_price: number | null;
  contrct_date: string | null;
};
