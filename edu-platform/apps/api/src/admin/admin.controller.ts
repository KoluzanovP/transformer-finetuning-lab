import { Controller, Post } from "@nestjs/common";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { AdminService } from "./admin.service";
import { AuditService } from "../common/audit/audit.service";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  /** Загрузить готовые курсы «Математика» и «ЕГЭ» одной кнопкой (автор). */
  @Post("seed-math")
  @Roles(Role.AUTHOR)
  async seedMath(@CurrentUser() user: AuthUser) {
    const res = await this.admin.seedMathCourses(user.id);
    await this.audit.log({ actorId: user.id, action: "admin.seedMath", metadata: { courses: res.courses.length } });
    return res;
  }
}
