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

/** GetProjectDetail — the procurement facts the portal has on file for a project. */
export type EgpProjectDetail = {
  masterMethodIdName: string | null;
  masterTypeIdName: string | null;
  masterGoodsIdName: string | null;
  masterContractAvailableName: string | null;
};
