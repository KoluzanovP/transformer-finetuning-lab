import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../common/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Проверка готовности сервиса и БД (для балансировщика/оркестратора). */
  @Public()
  @Get()
  async health() {
    let db = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    return { status: db === "ok" ? "ok" : "degraded", db, time: new Date().toISOString() };
  }
}
