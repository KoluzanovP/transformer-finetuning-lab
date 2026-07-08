import { Injectable } from "@nestjs/common";
import type { Notification } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

export type NotificationType =
  | "submission.submitted"
  | "submission.graded"
  | "submission.returned"
  | "call.booked"
  | "call.cancelled"
  | "ticket.reply"
  | "comment.reply";

/**
 * In-app уведомления. Создаются доменными сервисами при ключевых событиях.
 * Задел под email/пуш — см. ROADMAP (транспорт подключается отдельно).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, type: NotificationType, payload: Record<string, unknown>): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, payload: payload as object },
    });
  }

  /** Уведомить нескольких пользователей одним событием. */
  async notifyMany(userIds: string[], type: NotificationType, payload: Record<string, unknown>): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (!unique.length) return;
    await this.prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, type, payload: payload as object })),
    });
  }

  list(userId: string, onlyUnread = false): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, readAt: onlyUnread ? null : undefined },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
