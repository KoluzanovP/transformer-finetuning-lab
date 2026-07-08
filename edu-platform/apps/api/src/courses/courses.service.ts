import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CourseStatus, type Course } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9а-я\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return base || "course";
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: {
    title: string;
    description?: string;
    callsPerStudent?: number;
    callDurationMinutes?: number;
  }): Promise<Course> {
    let slug = slugify(dto.title);
    // Гарантируем уникальность slug.
    const exists = await this.prisma.course.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;

    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        slug,
        authorId,
        callsPerStudent: dto.callsPerStudent ?? 8,
        callDurationMinutes: dto.callDurationMinutes ?? 30,
      },
    });
  }

  async list(filter?: { status?: CourseStatus; authorId?: string }): Promise<Course[]> {
    return this.prisma.course.findMany({
      where: { status: filter?.status, authorId: filter?.authorId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lessons: true, enrollments: true } } },
    });
  }

  /** Опубликованные курсы (для витрины/ученика). */
  async published(): Promise<Course[]> {
    return this.list({ status: CourseStatus.PUBLISHED });
  }

  async getById(id: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { order: "asc" } },
        homeworks: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw new NotFoundException("Курс не найден");
    return course;
  }

  private async assertAuthorOwns(courseId: string, authorId: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Курс не найден");
    if (course.authorId !== authorId) {
      throw new ForbiddenException("Курс принадлежит другому автору");
    }
    return course;
  }

  async update(courseId: string, authorId: string, dto: Partial<{
    title: string;
    description: string;
    coverUrl: string;
    callsPerStudent: number;
    callDurationMinutes: number;
  }>): Promise<Course> {
    await this.assertAuthorOwns(courseId, authorId);
    return this.prisma.course.update({ where: { id: courseId }, data: dto });
  }

  async setStatus(courseId: string, authorId: string, status: CourseStatus): Promise<Course> {
    await this.assertAuthorOwns(courseId, authorId);
    return this.prisma.course.update({ where: { id: courseId }, data: { status } });
  }

  async remove(courseId: string, authorId: string): Promise<void> {
    await this.assertAuthorOwns(courseId, authorId);
    await this.prisma.course.delete({ where: { id: courseId } });
  }
}
