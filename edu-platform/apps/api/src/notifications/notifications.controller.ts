import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("unread") unread?: string) {
    return this.notifications.list(user.id, unread === "true");
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.notifications.markRead(user.id, id);
    return { success: true };
  }

  @Post("read-all")
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
    return { success: true };
  }
}
