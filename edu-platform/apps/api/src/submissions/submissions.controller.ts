import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { IsIn, IsInt, IsObject, IsOptional, Min } from "class-validator";
import { Role, SubmissionStatus, type LessonDocument } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { SubmissionsService } from "./submissions.service";
import { AuditService } from "../common/audit/audit.service";

class SaveSubmissionDto {
  @IsObject() content!: LessonDocument;
}

class ReviewDto {
  @IsIn([SubmissionStatus.GRADED, SubmissionStatus.RETURNED]) status!: "GRADED" | "RETURNED";
  @IsOptional() @IsInt() @Min(0) score?: number;
}

class AutoCheckDto {
  /** Ответы: { [id блока-теста]: [id выбранных вариантов] }. */
  @IsObject() answers!: Record<string, string[]>;
}

@Controller("submissions")
export class SubmissionsController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly audit: AuditService,
  ) {}

  /** Сохранить черновик. */
  @Post("homework/:homeworkId/draft")
  @Roles(Role.STUDENT)
  saveDraft(@Param("homeworkId") homeworkId: string, @Body() dto: SaveSubmissionDto, @CurrentUser() user: AuthUser) {
    return this.submissions.upsertForStudent(user.id, homeworkId, dto.content, false);
  }

  /** Отправить на проверку. */
  @Post("homework/:homeworkId/submit")
  @Roles(Role.STUDENT)
  async submit(@Param("homeworkId") homeworkId: string, @Body() dto: SaveSubmissionDto, @CurrentUser() user: AuthUser) {
    const s = await this.submissions.upsertForStudent(user.id, homeworkId, dto.content, true);
    await this.audit.log({ actorId: user.id, action: "submission.submit", entityType: "Submission", entityId: s.id });
    return s;
  }

  /** Авто-проверяемый тест: сверка ответов и выставление балла. */
  @Post("homework/:homeworkId/autocheck")
  @Roles(Role.STUDENT)
  async autoCheck(@Param("homeworkId") homeworkId: string, @Body() dto: AutoCheckDto, @CurrentUser() user: AuthUser) {
    const res = await this.submissions.autoCheck(user.id, homeworkId, dto.answers);
    await this.audit.log({ actorId: user.id, action: "submission.autocheck", entityType: "Homework", entityId: homeworkId, metadata: { score: res.scorePercent } });
    return res;
  }

  @Get("mine")
  @Roles(Role.STUDENT)
  mine(@CurrentUser() user: AuthUser) {
    return this.submissions.listForStudent(user.id);
  }

  @Get("queue")
  @Roles(Role.TEACHER)
  queue(@CurrentUser() user: AuthUser) {
    return this.submissions.queueForTeacher(user.id);
  }

  @Get(":id")
  @Roles(Role.STUDENT, Role.TEACHER, Role.AUTHOR)
  get(@Param("id") id: string) {
    return this.submissions.get(id);
  }

  @Put(":id/review")
  @Roles(Role.TEACHER)
  async review(@Param("id") id: string, @Body() dto: ReviewDto, @CurrentUser() user: AuthUser) {
    const s = await this.submissions.review(user.id, id, dto);
    await this.audit.log({ actorId: user.id, action: `submission.${dto.status}`, entityType: "Submission", entityId: id, metadata: { score: dto.score } });
    return s;
  }
}
