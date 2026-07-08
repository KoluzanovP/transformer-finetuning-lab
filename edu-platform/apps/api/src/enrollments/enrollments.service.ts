import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Enrollment } from "@prisma/client";
import { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Зачислить ученика на курс. callsTotal фиксируется из курса на момент зачисления. */
  async enroll(courseId: string, studentId: string, teacherId?: string): Promise<Enrollment> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Курс не найден");

    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student || !student.roles.includes(Role.STUDENT)) {
      throw new BadRequestException("Указанный пользователь не является учеником");
    }
    if (teacherId) await this.assertTeacher(teacherId);

    return this.prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId, studentId } },
      create: {
        courseId,
        studentId,
        teacherId,
        callsTotal: course.callsPerStudent,
      },
      update: { teacherId, isActive: true },
    });
  }

  private async assertTeacher(teacherId: string): Promise<void> {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || !teacher.roles.includes(Role.TEACHER)) {
      throw new BadRequestException("Указанный пользователь не является учителем");
    }
  }

  async assignTeacher(enrollmentId: string, teacherId: string): Promise<Enrollment> {
    await this.assertTeacher(teacherId);
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) throw new NotFoundException("Зачисление не найдено");
    return this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { teacherId } });
  }

  myEnrollments(studentId: string) {
    return this.prisma.enrollment.findMany({
      where: { studentId, isActive: true },
      include: {
        course: { include: { _count: { select: { lessons: true } } } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { enrolledAt: "desc" },
    });
  }

  forCourse(courseId: string) {
    return this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Ученики, закреплённые за учителем. */
  forTeacher(teacherId: string) {
    return this.prisma.enrollment.findMany({
      where: { teacherId, isActive: true },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async get(enrollmentId: string): Promise<Enrollment> {
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!e) throw new NotFoundException("Зачисление не найдено");
    return e;
  }
}
