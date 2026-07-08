import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { EnrollmentsService } from "./enrollments.service";
import { AuditService } from "../common/audit/audit.service";

class EnrollDto {
  @IsString() courseId!: string;
  @IsString() studentId!: string;
  @IsOptional() @IsString() teacherId?: string;
}

class AssignTeacherDto {
  @IsString() teacherId!: string;
}

@Controller("enrollments")
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly audit: AuditService,
  ) {}

  /** Автор зачисляет ученика и (опц.) назначает учителя. */
  @Post()
  @Roles(Role.AUTHOR)
  async enroll(@Body() dto: EnrollDto, @CurrentUser() user: AuthUser) {
    const e = await this.enrollments.enroll(dto.courseId, dto.studentId, dto.teacherId);
    await this.audit.log({ actorId: user.id, action: "enrollment.create", entityType: "Enrollment", entityId: e.id, metadata: { ...dto } });
    return e;
  }

  @Put(":id/teacher")
  @Roles(Role.AUTHOR)
  async assignTeacher(@Param("id") id: string, @Body() dto: AssignTeacherDto, @CurrentUser() user: AuthUser) {
    const e = await this.enrollments.assignTeacher(id, dto.teacherId);
    await this.audit.log({ actorId: user.id, action: "enrollment.assignTeacher", entityType: "Enrollment", entityId: id });
    return e;
  }

  /** Ученик — свои курсы. */
  @Get("mine")
  @Roles(Role.STUDENT)
  mine(@CurrentUser() user: AuthUser) {
    return this.enrollments.myEnrollments(user.id);
  }

  /** Учитель — закреплённые ученики. */
  @Get("teaching")
  @Roles(Role.TEACHER)
  teaching(@CurrentUser() user: AuthUser) {
    return this.enrollments.forTeacher(user.id);
  }

  /** Автор — все зачисления курса. */
  @Get("course/:courseId")
  @Roles(Role.AUTHOR, Role.TEACHER)
  forCourse(@Param("courseId") courseId: string) {
    return this.enrollments.forCourse(courseId);
  }
}
