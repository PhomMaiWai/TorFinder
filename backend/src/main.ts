import "reflect-metadata";

import { ConsoleLogger, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import compression from "compression";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { LoggingValidationPipe } from "./common/logging-validation.pipe";
import { env } from "./config/env";
import { checkSecretAges } from "./common/session-keys";
import { internalHttpsOptions, requireInternalClient } from "./common/internal-tls";
import { logSecurityEvent } from "./common/security-log";

/**
 * ASVS 16.5.4, the last resort. Request errors already end in
 * AllExceptionsFilter; these catch what escapes everything else, mostly the
 * schedulers' background work. A rejected promise is logged and the server
 * keeps serving. An uncaught exception leaves the process in an unknown state,
 * so it is logged and the process exits for the container to restart
 * (`restart: unless-stopped` in docker-compose.yml), as Node advises.
 */
function installLastResortHandlers(): void {
  const logger = new Logger("Process");
  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`);
  });
  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught exception, exiting: ${error.stack ?? error.message}`);
    process.exit(1);
  });
}

async function bootstrap() {
  installLastResortHandlers();
  // Production logs are one JSON object per line, no colour codes, so a log
  // collector can parse and search them (ASVS 16.2.3); dev keeps the readable form.
  const httpsOptions = internalHttpsOptions();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.isProduction ? new ConsoleLogger({ json: true }) : undefined,
    // ASVS 12.3.5: HTTPS with a required client certificate when internal TLS is on.
    ...(httpsOptions && { httpsOptions }),
    // Keeps the exact request bytes beside the parsed body: LINE's webhook
    // signature is over those bytes, not over a re-serialised object.
    rawBody: true,
  });

  // Throttled calls arrive from the Next.js server, which names the browser in
  // X-Forwarded-For (frontend/src/lib/client-ip.ts). The header is believed only
  // from those hops, so a client reaching this port directly can't pick its own
  // rate-limit bucket (ASVS 6.3.1).
  app.set("trust proxy", env.trustProxy);
  // ASVS 13.4.6: no framework banner on any answer. helmet() removes it later
  // in the chain, but the certificate check below answers 403 before that.
  app.disable("x-powered-by");
  // Before anything else: only the frontend's certificate may use the API.
  if (httpsOptions) app.use(requireInternalClient);
  app.use(helmet());
  // ASVS 14.3.2: API answers carry account data, so no browser or proxy keeps
  // a copy. Routes that serve public documents set their own caching after this.
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(compression());
  app.enableCors({ origin: env.frontendOrigin });
  // Same options as before; failures are also logged as `input.rejected` (ASVS 16.3.3).
  app.useGlobalPipes(new LoggingValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.enableShutdownHooks();

  await app.listen(env.port);
  // ASVS 13.3.4: a session secret past its rotation date is reported now and daily.
  checkSecretAges();
  setInterval(() => checkSecretAges(), 24 * 60 * 60 * 1000).unref();
  Logger.log(`torr-backend listening on :${env.port} (${httpsOptions ? "HTTPS, client certificates required" : "HTTP"})`, "Bootstrap");
  if (env.isProduction && !httpsOptions) {
    logSecurityEvent("config.internal_tls_off", { outcome: "failure", reason: "backend_serves_plain_http" });
  }
  if (env.isProduction && !env.virusScan.host) {
    logSecurityEvent("config.virus_scan_off", {
      outcome: "failure",
      reason: env.virusScan.required ? "clamav_host_unset_uploads_refused" : "clamav_host_unset_scan_disabled",
    });
  }
}

bootstrap();
