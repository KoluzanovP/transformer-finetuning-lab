import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { UPLOADS_DIR } from "./media/media.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  // Раздача локально загруженных медиа (dev, driver=LOCAL).
  app.useStaticAssets(UPLOADS_DIR, { prefix: "/uploads/" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = config.get<number>("port") ?? 4000;
  await app.listen(port);
  Logger.log(`API запущен на http://localhost:${port}/api`, "Bootstrap");
}

void bootstrap();
