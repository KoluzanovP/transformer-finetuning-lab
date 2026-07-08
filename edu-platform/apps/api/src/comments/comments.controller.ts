import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { CommentsService } from "./comments.service";

class CreateCommentDto {
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsOptional() @IsString() homeworkId?: string;
  @IsOptional() @IsString() submissionId?: string;
  @IsOptional() @IsString() parentId?: string;
}

@Controller("comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Создаёт комментарий от имени текущего пользователя. */
  @Post()
  create(@Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.create(user.id, dto);
  }

  /** Список комментариев для урока/домашки/сдачи. */
  @Get()
  list(
    @Query("lessonId") lessonId?: string,
    @Query("homeworkId") homeworkId?: string,
    @Query("submissionId") submissionId?: string,
  ) {
    return this.comments.listFor({ lessonId, homeworkId, submissionId });
  }

  /** Удаляет комментарий (автор комментария или автор платформы). */
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.comments.remove(id, user);
  }
}
