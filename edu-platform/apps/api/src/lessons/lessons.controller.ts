import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { LessonProgressStatus, Role, type LessonDocument } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { LessonsService } from "./lessons.service";
import { AuditService } from "../common/audit/audit.service";

class CreateLessonDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsObject() content?: LessonDocument;
  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;
}

class UpdateLessonDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsObject() content?: LessonDocument;
  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class ReorderDto {
  @IsArray() @IsString({ each: true }) orderedIds!: string[];
}

class ProgressDto {
  @IsIn(Object.values(LessonProgressStatus)) status!: LessonProgressStatus;
}

@Controller()
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly audit: AuditService,
  ) {}

  @Post("courses/:courseId/lessons")
  @Roles(Role.AUTHOR)
  async create(@Param("courseId") courseId: string, @Body() dto: CreateLessonDto, @CurrentUser() user: AuthUser) {
    const lesson = await this.lessons.create(user.id, courseId, dto);
    await this.audit.log({ actorId: user.id, action: "lesson.create", entityType: "Lesson", entityId: lesson.id });
    return lesson;
  }

  @Patch("courses/:courseId/lessons/reorder")
  @Roles(Role.AUTHOR)
  reorder(@Param("courseId") courseId: string, @Body() dto: ReorderDto, @CurrentUser() user: AuthUser) {
    return this.lessons.reorder(courseId, user.id, dto.orderedIds);
  }

  @Get("lessons/:id")
  get(@Param("id") id: string) {
    return this.lessons.get(id);
  }

  @Patch("lessons/:id")
  @Roles(Role.AUTHOR)
  async update(@Param("id") id: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: AuthUser) {
    const lesson = await this.lessons.update(id, user.id, dto);
    await this.audit.log({ actorId: user.id, action: "lesson.update", entityType: "Lesson", entityId: id });
    return lesson;
  }

  @Delete("lessons/:id")
  @Roles(Role.AUTHOR)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.lessons.remove(id, user.id);
    return { success: true };
  }

  @Post("lessons/:id/progress")
  @Roles(Role.STUDENT)
  progress(@Param("id") id: string, @Body() dto: ProgressDto, @CurrentUser() user: AuthUser) {
    return this.lessons.setProgress(user.id, id, dto.status);
  }
}
