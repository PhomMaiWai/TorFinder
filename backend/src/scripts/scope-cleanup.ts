import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { DataGovService } from "../datagov/datagov.service";
import { EgpService } from "../egp/egp.service";
import { GprocService } from "../gproc/gproc.service";
import { MeaService } from "../mea/mea.service";

/**
 * One-time sweep of records the current scope rules — the TOR_LISTED_SINCE
 * cutoff every source shares, and each source's own agency/locality check
 * (thai-locality.ts) — would no longer let in. The ongoing purge() every
 * sync already runs keeps the database honest from here on; this is for
 * what it inherited from before those rules existed.
 *
 * Counts first, always: run with no flags to see what would be removed.
 * Nothing is deleted until you pass --apply.
 *
 *   npm run scope-cleanup --prefix backend                 # count only
 *   npm run scope-cleanup --prefix backend -- --apply       # remove
 *
 * (Build first — `npm run build --prefix backend` — this runs the compiled
 * dist/, same as `npm start`.)
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const logger = new Logger("ScopeCleanup");

  const sources: { name: string; service: { previewCleanup(): Promise<number>; cleanup(): Promise<number> } }[] = [
    { name: "e-GP", service: app.get(EgpService) },
    { name: "gproc", service: app.get(GprocService) },
    { name: "MEA", service: app.get(MeaService) },
    { name: "data.go.th", service: app.get(DataGovService) },
  ];

  let total = 0;
  for (const { name, service } of sources) {
    const count = await (apply ? service.cleanup() : service.previewCleanup());
    total += count;
    logger.log(`${name}: ${count} record(s) ${apply ? "removed" : "out of scope"}`);
  }

  logger.log(
    apply
      ? `Done — ${total} record(s) removed.`
      : `${total} record(s) out of scope in total. Re-run with --apply to remove them.`,
  );

  await app.close();
}

main().catch((error) => {
  new Logger("ScopeCleanup").error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
