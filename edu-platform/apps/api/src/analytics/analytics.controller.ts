import { Controller, Get, Param, Query } from "@nestjs/common";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  @Roles(Role.AUTHOR)
  overview() {
    return this.analytics.overview();
  }

  @Get("teacher/:id")
  @Roles(Role.AUTHOR, Role.TEACHER)
  teacher(@Param("id") id: string) {
    return this.analytics.teacherStats(id);
  }

  /** Учитель смотрит свою статистику. */
  @Get("me/teacher")
  @Roles(Role.TEACHER)
  meTeacher(@CurrentUser() user: AuthUser) {
    return this.analytics.teacherStats(user.id);
  }

  @Get("student/:id")
  @Roles(Role.AUTHOR, Role.TEACHER)
  student(@Param("id") id: string) {
    return this.analytics.studentProgress(id);
  }

  /** Ученик — свой прогресс. */
  @Get("me/student")
  @Roles(Role.STUDENT)
  meStudent(@CurrentUser() user: AuthUser) {
    return this.analytics.studentProgress(user.id);
  }

  /** Родитель — прогресс ребёнка. */
  @Get("child/:studentId")
  @Roles(Role.PARENT)
  child(@Param("studentId") studentId: string, @CurrentUser() user: AuthUser) {
    return this.analytics.childProgressForParent(user.id, studentId);
  }

  /** Лог действий (автор). */
  @Get("audit")
  @Roles(Role.AUTHOR)
  audit(@Query() pagination: PaginationDto, @Query("actorId") actorId?: string, @Query("action") action?: string) {
    return this.analytics.auditLog({ actorId, action, page: pagination.page, pageSize: pagination.pageSize });
  }
}
