import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/**
 * Пишет лог действий. Автор платформы может просматривать эти записи
 * по каждому пользователю (см. AnalyticsController / AuditController).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: (entry.metadata as object) ?? undefined,
          ip: entry.ip,
        },
      });
    } catch (err) {
      // Аудит не должен ломать основной сценарий.
      this.logger.error(`Не удалось записать аудит: ${String(err)}`);
    }
  }
}
