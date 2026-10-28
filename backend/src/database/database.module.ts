import { Global, Module } from "@nestjs/common";

import { SessionRevocationService } from "../common/session-revocation.service";
import { DatabaseService } from "./database.service";

// Global: SessionRevocationService has to be reachable from every guard that
// checks a session token (SessionGuard, RoleGuard and its role-specific
// subclasses), which between them span almost every feature module. Making
// every one of those modules import DatabaseModule just to get a guard
// dependency would be pure plumbing; Global says once, here, that this
// module's providers are infrastructure the whole app shares.
@Global()
@Module({
  providers: [DatabaseService, SessionRevocationService],
  exports: [DatabaseService, SessionRevocationService],
})
export class DatabaseModule {}
