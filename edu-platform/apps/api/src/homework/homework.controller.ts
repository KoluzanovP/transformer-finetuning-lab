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
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { Role, type LessonDocument } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { HomeworkService } from "./homework.service";
import { AuditService } from "../common/audit/audit.service";

class CreateHomeworkDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsOptional() @IsInt() @Min(1) maxScore?: number;
  @IsOptional() @IsObject() content?: LessonDocument;
}

class UpdateHomeworkDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) maxScore?: number;
  @IsOptional() @IsObject() content?: LessonDocument;
}

@Controller()
export class HomeworkController {
  constructor(
    private readonly homework: HomeworkService,
    private readonly audit: AuditService,
  ) {}

  @Post("courses/:courseId/homework")
  @Roles(Role.AUTHOR)
  async create(@Param("courseId") courseId: string, @Body() dto: CreateHomeworkDto, @CurrentUser() user: AuthUser) {
    const hw = await this.homework.create(user.id, courseId, dto);
    await this.audit.log({ actorId: user.id, action: "homework.create", entityType: "Homework", entityId: hw.id });
    return hw;
  }

  @Get("courses/:courseId/homework")
  list(@Param("courseId") courseId: string) {
    return this.homework.listForCourse(courseId);
  }

  @Get("homework/:id")
  get(@Param("id") id: string) {
    return this.homework.get(id);
  }

  @Patch("homework/:id")
  @Roles(Role.AUTHOR)
  update(@Param("id") id: string, @Body() dto: UpdateHomeworkDto, @CurrentUser() user: AuthUser) {
    return this.homework.update(id, user.id, dto);
  }

  @Delete("homework/:id")
  @Roles(Role.AUTHOR)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.homework.remove(id, user.id);
    return { success: true };
  }
}
