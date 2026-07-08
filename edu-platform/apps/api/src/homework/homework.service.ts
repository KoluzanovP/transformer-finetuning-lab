import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Homework, Prisma } from "@prisma/client";
import type { LessonDocument } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourseOwner(courseId: string, authorId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Курс не найден");
    if (course.authorId !== authorId) throw new ForbiddenException("Курс принадлежит другому автору");
  }

  async create(authorId: string, courseId: string, dto: { title: string; description?: string; lessonId?: string; maxScore?: number; content?: LessonDocument }): Promise<Homework> {
    await this.assertCourseOwner(courseId, authorId);
    const last = await this.prisma.homework.findFirst({ where: { courseId }, orderBy: { order: "desc" } });
    return this.prisma.homework.create({
      data: {
        courseId,
        lessonId: dto.lessonId,
        title: dto.title,
        description: dto.description,
        maxScore: dto.maxScore ?? 100,
        order: (last?.order ?? -1) + 1,
        content: (dto.content as unknown as Prisma.InputJsonValue) ?? { version: 1, blocks: [] },
      },
    });
  }

  async get(id: string): Promise<Homework> {
    const hw = await this.prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundException("Домашнее задание не найдено");
    return hw;
  }

  listForCourse(courseId: string): Promise<Homework[]> {
    return this.prisma.homework.findMany({ where: { courseId }, orderBy: { order: "asc" } });
  }

  private async ownerOf(id: string): Promise<string> {
    const hw = await this.prisma.homework.findUnique({ where: { id }, include: { course: { select: { authorId: true } } } });
    if (!hw) throw new NotFoundException("Домашнее задание не найдено");
    return hw.course.authorId;
  }

  async update(id: string, authorId: string, dto: Partial<{ title: string; description: string; maxScore: number; content: LessonDocument }>): Promise<Homework> {
    if ((await this.ownerOf(id)) !== authorId) throw new ForbiddenException("Нет доступа");
    const data: Prisma.HomeworkUpdateInput = {
      title: dto.title,
      description: dto.description,
      maxScore: dto.maxScore,
    };
    if (dto.content !== undefined) data.content = dto.content as unknown as Prisma.InputJsonValue;
    return this.prisma.homework.update({ where: { id }, data });
  }

  async remove(id: string, authorId: string): Promise<void> {
    if ((await this.ownerOf(id)) !== authorId) throw new ForbiddenException("Нет доступа");
    await this.prisma.homework.delete({ where: { id } });
  }
}
