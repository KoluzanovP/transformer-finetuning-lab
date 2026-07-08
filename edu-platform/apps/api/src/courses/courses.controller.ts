import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { CourseStatus } from "@prisma/client";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { CoursesService } from "./courses.service";
import { AuditService } from "../common/audit/audit.service";

class CreateCourseDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) callsPerStudent?: number;
  @IsOptional() @IsInt() @Min(5) callDurationMinutes?: number;
}

class UpdateCourseDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsInt() @Min(0) callsPerStudent?: number;
  @IsOptional() @IsInt() @Min(5) callDurationMinutes?: number;
}

class StatusDto {
  @IsIn(Object.values(CourseStatus)) status!: CourseStatus;
}

@Controller("courses")
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly audit: AuditService,
  ) {}

  /** Витрина опубликованных курсов — доступна всем авторизованным. */
  @Get()
  list(@Query("status") status?: CourseStatus, @Query("mine") mine?: string, @CurrentUser() user?: AuthUser) {
    if (mine === "true" && user) return this.courses.list({ authorId: user.id });
    if (status) return this.courses.list({ status });
    return this.courses.published();
  }

  @Public()
  @Get("slug/:slug")
  async bySlug(@Param("slug") slug: string) {
    return this.courses.list().then((all) => all.find((c) => c.slug === slug) ?? null);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.courses.getById(id);
  }

  @Post()
  @Roles(Role.AUTHOR)
  async create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    const course = await this.courses.create(user.id, dto);
    await this.audit.log({ actorId: user.id, action: "course.create", entityType: "Course", entityId: course.id });
    return course;
  }

  @Patch(":id")
  @Roles(Role.AUTHOR)
  async update(@Param("id") id: string, @Body() dto: UpdateCourseDto, @CurrentUser() user: AuthUser) {
    const course = await this.courses.update(id, user.id, dto);
    await this.audit.log({ actorId: user.id, action: "course.update", entityType: "Course", entityId: id });
    return course;
  }

  @Patch(":id/status")
  @Roles(Role.AUTHOR)
  async setStatus(@Param("id") id: string, @Body() dto: StatusDto, @CurrentUser() user: AuthUser) {
    const course = await this.courses.setStatus(id, user.id, dto.status);
    await this.audit.log({ actorId: user.id, action: `course.status.${dto.status}`, entityType: "Course", entityId: id });
    return course;
  }

  @Delete(":id")
  @Roles(Role.AUTHOR)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.courses.remove(id, user.id);
    await this.audit.log({ actorId: user.id, action: "course.delete", entityType: "Course", entityId: id });
    return { success: true };
  }
}
