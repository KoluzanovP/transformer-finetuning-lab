import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Lesson, Prisma } from "@prisma/client";
import { LessonProgressStatus, type LessonDocument } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourseOwner(courseId: string, authorId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Курс не найден");
    if (course.authorId !== authorId) {
      throw new ForbiddenException("Курс принадлежит другому автору");
    }
  }

  private async ownerOfLesson(lessonId: string): Promise<{ lesson: Lesson; authorId: string }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { authorId: true } } },
    });
    if (!lesson) throw new NotFoundException("Урок не найден");
    return { lesson, authorId: lesson.course.authorId };
  }

  async create(authorId: string, courseId: string, dto: { title: string; content?: LessonDocument; estimatedMinutes?: number }): Promise<Lesson> {
    await this.assertCourseOwner(courseId, authorId);
    const last = await this.prisma.lesson.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
    });
    const order = (last?.order ?? -1) + 1;
    return this.prisma.lesson.create({
      data: {
        courseId,
        title: dto.title,
        order,
        estimatedMinutes: dto.estimatedMinutes,
        content: (dto.content as unknown as Prisma.InputJsonValue) ?? { version: 1, blocks: [] },
      },
    });
  }

  async get(lessonId: string): Promise<Lesson> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { homeworks: true },
    });
    if (!lesson) throw new NotFoundException("Урок не найден");
    return lesson;
  }

  async update(lessonId: string, authorId: string, dto: Partial<{ title: string; content: LessonDocument; estimatedMinutes: number; isPublished: boolean }>): Promise<Lesson> {
    const { authorId: owner } = await this.ownerOfLesson(lessonId);
    if (owner !== authorId) throw new ForbiddenException("Нет доступа к уроку");
    const data: Prisma.LessonUpdateInput = {
      title: dto.title,
      estimatedMinutes: dto.estimatedMinutes,
      isPublished: dto.isPublished,
    };
    if (dto.content !== undefined) {
      data.content = dto.content as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.lesson.update({ where: { id: lessonId }, data });
  }

  /** Переупорядочивание уроков курса. Двухфазно, чтобы не нарушить unique(courseId, order). */
  async reorder(courseId: string, authorId: string, orderedIds: string[]): Promise<Lesson[]> {
    await this.assertCourseOwner(courseId, authorId);
    return this.prisma.$transaction(async (tx) => {
      // Фаза 1: увести значения order в безопасный диапазон.
      await Promise.all(
        orderedIds.map((id, i) =>
          tx.lesson.update({ where: { id }, data: { order: 1000 + i } }),
        ),
      );
      // Фаза 2: проставить финальный порядок.
      await Promise.all(
        orderedIds.map((id, i) => tx.lesson.update({ where: { id }, data: { order: i } })),
      );
      return tx.lesson.findMany({ where: { courseId }, orderBy: { order: "asc" } });
    });
  }

  async remove(lessonId: string, authorId: string): Promise<void> {
    const { authorId: owner } = await this.ownerOfLesson(lessonId);
    if (owner !== authorId) throw new ForbiddenException("Нет доступа к уроку");
    await this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  /** Ученик отмечает прогресс по уроку. */
  async setProgress(studentId: string, lessonId: string, status: LessonProgressStatus) {
    await this.get(lessonId);
    return this.prisma.lessonProgress.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      create: {
        lessonId,
        studentId,
        status,
        completedAt: status === LessonProgressStatus.COMPLETED ? new Date() : null,
      },
      update: {
        status,
        completedAt: status === LessonProgressStatus.COMPLETED ? new Date() : null,
      },
    });
  }
}
