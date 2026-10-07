/** Shapes returned by the Bangkok e-GP public API (egp2.bangkok.go.th). */

export type EgpProject = {
  projectId: string;
  projectNumber: string;
  projectName: string;
  masterOrgGroupName: string | null;
  masterOrgDepartmentName: string | null;
  projectBudget: number | null;
};

export type EgpSearchResponse = {
  data: EgpProject[] | null;
  totalCount: number;
  hasNextPage: boolean;
};

export type EgpAnnouncement = {
  id: string;
  masterAnnounceTypeName: string | null;
  projectAnnouncementPublishDate: string | null;
  projectAnnouncementPath: string | null;
};

export type EgpAnnouncementResponse = {
  data: EgpAnnouncement[] | null;
};

/** GetProjectContractInProject — one signed contract of the project. */
export type EgpContract = {
  projectContractBidderName: string | null;
  projectContractContractNumberEgp: string | null;
  projectContractContractDate: string | null;
  projectContractContractBudget: number | string | null;
  projectContractContractStartDate: string | null;
  projectContractContractEndDate: string | null;
  /** Days; the portal sends it as a string. */
  projectContractContractDeadline: number | string | null;
};

/** GetProjectDetail — the procurement facts the portal has on file for a project. */
export type EgpProjectDetail = {
  masterMethodIdName: string | null;
  masterTypeIdName: string | null;
  masterGoodsIdName: string | null;
  masterContractAvailableName: string | null;
};
