import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { env } from "../config/env";
import { DatabaseService, TorDoc } from "../database/database.service";
import { EGP_ANNOUNCE_TYPES, EGP_ANNOUNCE_TYPE_LIST, EgpAnnounceType } from "./egp.constants";

type FeedItem = {
  title: string;
  projectId: string;
  method: string;
  announcement: string;
  pubDate: string;
  link: string;
};

type ImportedTor = TorDoc & { sourceRef: string };

// The feed is served as Windows-874 (Thai), not UTF-8.
const decoder = new TextDecoder("windows-874");

const ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const TAG_RE = new Map<string, RegExp>();

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};

function tagText(block: string, tag: string): string {
  let re = TAG_RE.get(tag);
  if (!re) {
    re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
    TAG_RE.set(tag, re);
  }
  const match = block.match(re);
  if (!match) return "";
  return match[1].trim().replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (e) => ENTITIES[e]);
}

@Injectable()
export class EgpService {
  private readonly logger = new Logger(EgpService.name);

  constructor(private readonly db: DatabaseService) {}

  async sync() {
    const departments = env.egp.departments.length
      ? env.egp.departments
      : [{ deptId: "", agency: "หน่วยงานภาครัฐ" }];

    const requests = departments.flatMap((dept) =>
      EGP_ANNOUNCE_TYPE_LIST.map((type) => ({ dept, type })),
    );

    // Keyed by sourceRef: a project can repeat across feeds, and two upserts
    // racing for the same unique key in one bulkWrite would conflict.
    const byRef = new Map<string, ImportedTor>();
    const failed: string[] = [];

    // e-GP drops connections when several feeds are pulled at once, so requests go
    // one at a time and a failed feed only costs its own records, not the whole run.
    for (const { dept, type } of requests) {
      try {
        const items = await this.fetchFeed(dept.deptId, type);
        for (const item of items) {
          const doc = this.toTorDoc(item, type, dept.agency);
          byRef.set(doc.sourceRef, doc);
        }
      } catch (error) {
        failed.push(`${dept.deptId || "all"}/${type}`);
        this.logger.warn(`e-GP feed ${dept.deptId || "all"}/${type}: ${String(error)}`);
      }
    }

    if (failed.length === requests.length) {
      throw new ServiceUnavailableException("ดึงข้อมูลจากระบบ e-GP ไม่สำเร็จ");
    }

    const docs = [...byRef.values()];
    if (docs.length === 0) return { fetched: 0, imported: 0, updated: 0, failed };

    const result = await this.db.tors.bulkWrite(
      docs.map(({ createdAt, ...changeable }) => ({
        updateOne: {
          filter: { sourceRef: changeable.sourceRef },
          update: { $set: changeable, $setOnInsert: { createdAt } },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    this.logger.log(`e-GP sync: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    return {
      fetched: docs.length,
      imported: result.upsertedCount,
      updated: result.modifiedCount,
      failed,
    };
  }

  private async fetchFeed(deptId: string, type: EgpAnnounceType): Promise<FeedItem[]> {
    const url = new URL(env.egp.feedUrl);
    // Upstream really does spell it "anounceType"; the correct spelling is ignored.
    url.searchParams.set("anounceType", type);
    if (deptId) url.searchParams.set("deptId", deptId);

    const res = await fetch(url, { signal: AbortSignal.timeout(env.egp.timeoutMs) });
    if (!res.ok) throw new Error(`e-GP responded ${res.status}`);
    const xml = decoder.decode(await res.arrayBuffer());

    return [...xml.matchAll(ITEM_RE)].flatMap(([, block]) => {
      const title = tagText(block, "title");
      // description is "<เลขที่โครงการ>, <วิธีจัดหา>, <ประเภทประกาศ>"
      const [projectId = "", method = "", announcement = ""] = tagText(block, "description")
        .split(",")
        .map((part) => part.trim());

      if (!title || !projectId) return [];
      return [
        {
          title,
          projectId,
          method,
          announcement,
          pubDate: tagText(block, "pubDate"),
          link: tagText(block, "link"),
        },
      ];
    });
  }

  private toTorDoc(item: FeedItem, type: EgpAnnounceType, agency: string): ImportedTor {
    const announcedAt = new Date(item.pubDate);

    return {
      title: item.title,
      agency,
      // Budget and closing date live inside the linked document, not the feed.
      budget: "ไม่ระบุ",
      deadline: "ไม่ระบุ",
      daysLeft: 0,
      match: 0,
      tags: item.method ? [item.method] : [],
      stage: EGP_ANNOUNCE_TYPES[type],
      summary: `เลขที่โครงการ ${item.projectId}${item.announcement ? ` · ${item.announcement}` : ""}`,
      // Announcement date, so listings sort by when it was published, not imported.
      createdAt: Number.isNaN(announcedAt.getTime()) ? new Date() : announcedAt,
      sourceRef: `egp:${item.projectId}:${type}`,
      sourceUrl: item.link,
    };
  }
}
