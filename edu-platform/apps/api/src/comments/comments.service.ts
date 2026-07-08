import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import { type AuthUser } from "../common/decorators/current-user.decorator";

/** Данные для создания комментария. */
export interface CreateCommentInput {
  body: string;
  lessonId?: string;
  homeworkId?: string;
  submissionId?: string;
  parentId?: string;
}

/** Цель, к которой привязаны комментарии (ровно одно поле). */
export interface CommentTarget {
  lessonId?: string;
  homeworkId?: string;
  submissionId?: string;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Создаёт комментарий; ровно одна цель (урок/домашка/сдача) обязательна. */
  async create(authorId: string, dto: CreateCommentInput) {
    const targets = [dto.lessonId, dto.homeworkId, dto.submissionId].filter(
      (value) => value != null,
    );
    if (targets.length !== 1) {
      throw new BadRequestException(
        "Нужно указать ровно одну цель: урок, домашнее задание или сдачу.",
      );
    }

    return this.prisma.comment.create({
      data: {
        authorId,
        body: dto.body,
        lessonId: dto.lessonId ?? null,
        homeworkId: dto.homeworkId ?? null,
        submissionId: dto.submissionId ?? null,
        parentId: dto.parentId ?? null,
      },
      include: { author: true },
    });
  }

  /** Верхнеуровневые комментарии цели с ответами (тредами). */
  listFor(target: CommentTarget) {
    return this.prisma.comment.findMany({
      where: {
        parentId: null,
        lessonId: target.lessonId ?? undefined,
        homeworkId: target.homeworkId ?? undefined,
        submissionId: target.submissionId ?? undefined,
      },
      orderBy: { createdAt: "asc" },
      include: {
        author: true,
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: true },
        },
      },
    });
  }

  /** Удаляет комментарий: разрешено автору комментария или роли AUTHOR. */
  async remove(id: string, user: AuthUser) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException("Комментарий не найден.");
    }

    const isAuthor = comment.authorId === user.id;
    const isPlatformAuthor = user.roles.includes(Role.AUTHOR);
    if (!isAuthor && !isPlatformAuthor) {
      throw new ForbiddenException("Недостаточно прав для удаления комментария.");
    }

    return this.prisma.comment.delete({ where: { id } });
  }
}
