/** The DataTables envelope two of the three listings answer with. */
export type MeaDataTableResponse = {
  recordsTotal: number;
  recordsFiltered: number;
  data: MeaAnnouncement[];
  error: string | null;
};

/**
 * One row of a listing. The three listings publish overlapping but different
 * columns — a draft carries its budget and comment window, an award carries
 * the winner — so everything past the first three fields is optional and the
 * caller reads only what its own announcement type provides.
 */
export type MeaAnnouncement = {
  KEY_ID: string;
  /** The announcement's own number; often has the e-GP project number appended. */
  PUBLISH_NO: string | null;
  SUBJECT: string | null;

  /** Draft listing: budget in baht, and the comment window. */
  BUDGET?: number | null;
  POST_DT?: string | null;
  END_DT?: string | null;
  POST_DT_TEXT?: string | null;
  END_DT_TEXT?: string | null;
  /** The e-GP project this announcement belongs to, when the filer entered it. */
  EGP_PROJ_NO?: string | null;

  /** Procurement listing: the bidding window. */
  DETAIL_DT?: string | null;
  DETAIL_DT_TEXT?: string | null;
  DETAIL_END_DT_TEXT?: string | null;
  BID_DT?: string | null;
  BID_DT_TEXT?: string | null;

  /** Award listing: who won, and why they were selected. */
  WIN_NAME?: string | null;
  REASON_TEXT?: string | null;

  METHOD_DESC?: string | null;
};

/**
 * What the detail page adds over its listing row. The listings for the two
 * non-draft types publish no budget and no department, and those are printed
 * as HTML on the announcement's own page only.
 */
export type MeaDetail = {
  /** วงเงินงบประมาณ in baht. */
  budgetAmount?: number;
  /**
   * What the contract was actually awarded for. An award notice has no budget
   * to publish — the bidding is over — so this is the only figure on its page,
   * and it is a different fact from a budget rather than a substitute for one.
   */
  awardedAmount?: number;
  /** The department inside MEA that is buying, e.g. "ฝ่ายจัดหา (ฝจห.)". */
  department?: string;
  /** The announcement's own attachments, newest-first order as published. */
  documents: { label: string; url: string }[];
};
