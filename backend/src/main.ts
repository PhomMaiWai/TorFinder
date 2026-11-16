import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import compression from "compression";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Throttled calls arrive from the Next.js server, which names the browser in
  // X-Forwarded-For (frontend/src/lib/client-ip.ts). The header is believed only
  // from those hops, so a client reaching this port directly can't pick its own
  // rate-limit bucket (ASVS 6.3.1).
  app.set("trust proxy", env.trustProxy);
  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: env.frontendOrigin });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.enableShutdownHooks();

  await app.listen(env.port);
  Logger.log(`torr-backend listening on :${env.port}`, "Bootstrap");
}

bootstrap();
