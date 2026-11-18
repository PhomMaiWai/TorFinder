import "reflect-metadata";

import { ConsoleLogger, Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import compression from "compression";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap() {
  // Production logs are one JSON object per line, no colour codes, so a log
  // collector can parse and search them (ASVS 16.2.3); dev keeps the readable form.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.isProduction ? new ConsoleLogger({ json: true }) : undefined,
    // Keeps the exact request bytes beside the parsed body: LINE's webhook
    // signature is over those bytes, not over a re-serialised object.
    rawBody: true,
  });

  // Throttled calls arrive from the Next.js server, which names the browser in
  // X-Forwarded-For (frontend/src/lib/client-ip.ts). The header is believed only
  // from those hops, so a client reaching this port directly can't pick its own
  // rate-limit bucket (ASVS 6.3.1).
  app.set("trust proxy", env.trustProxy);
  app.use(helmet());
  // ASVS 14.3.2: API answers carry account data, so no browser or proxy keeps
  // a copy. Routes that serve public documents set their own caching after this.
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(compression());
  app.enableCors({ origin: env.frontendOrigin });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.enableShutdownHooks();

  await app.listen(env.port);
  Logger.log(`torr-backend listening on :${env.port}`, "Bootstrap");
}

bootstrap();
