import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { UPLOADS_DIR } from "./media/media.service";

/** В production критично не запускаться с дефолтными секретами. */
function assertProductionSecrets(config: ConfigService): void {
  if (process.env.NODE_ENV !== "production") return;
  const access = config.get<string>("jwt.accessSecret");
  const refresh = config.get<string>("jwt.refreshSecret");
  const weak = [access, refresh].some((s) => !s || s.length < 24 || s.startsWith("dev-") || s.startsWith("change-"));
  if (weak) {
    throw new Error(
      "Отказ запуска: JWT_ACCESS_SECRET/JWT_REFRESH_SECRET не заданы или слишком слабые для production.",
    );
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // В проде не раскрываем стек/детали ошибок клиенту (по умолчанию Nest и так их скрывает).
    bufferLogs: false,
  });
  const config = app.get(ConfigService);
  assertProductionSecrets(config);

  // Диагностика: логируем каждый входящий запрос (метод + путь).
  const httpLogger = new Logger("HTTP");
  app.use((req: { method: string; originalUrl: string }, _res: unknown, next: () => void) => {
    httpLogger.log(`${req.method} ${req.originalUrl}`);
    next();
  });

  // Безопасные заголовки. crossOriginResourcePolicy=cross-origin — чтобы фронт
  // мог загружать медиа из /uploads.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false, // API отдаёт JSON; CSP настраивается на фронте.
    }),
  );

  // Ограничение размера JSON/urlencoded тел (загрузка файлов идёт через multipart).
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));

  app.setGlobalPrefix("api");

  // CORS только для доверенных origin'ов фронтенда.
  const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Раздача локально загруженных медиа (dev, driver=LOCAL).
  app.useStaticAssets(UPLOADS_DIR, { prefix: "/uploads/", index: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true, // отвергаем неизвестные поля (mass-assignment)
    }),
  );

  const port = config.get<number>("port") ?? 4000;
  await app.listen(port);
  Logger.log(`API запущен на http://localhost:${port}/api`, "Bootstrap");
}

void bootstrap();
