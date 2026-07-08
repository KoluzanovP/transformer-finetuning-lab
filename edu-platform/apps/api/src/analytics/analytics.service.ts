import { ForbiddenException, Injectable } from "@nestjs/common";
import { CallStatus, Role, SubmissionStatus } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Сводка для автора платформы. */
  async overview() {
    const [users, courses, enrollments, pendingSubmissions, upcomingCalls] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.course.count(),
      this.prisma.enrollment.count({ where: { isActive: true } }),
      this.prisma.submission.count({ where: { status: SubmissionStatus.SUBMITTED } }),
      this.prisma.call.count({ where: { status: CallStatus.BOOKED, startsAt: { gt: new Date() } } }),
    ]);

    const byRole: Record<string, number> = {};
    for (const role of Object.values(Role)) {
      byRole[role] = await this.prisma.user.count({ where: { roles: { has: role } } });
    }

    return { users, usersByRole: byRole, courses, activeEnrollments: enrollments, pendingSubmissions, upcomingCalls };
  }

  /** Статистика по конкретному учителю. */
  async teacherStats(teacherId: string) {
    const [students, reviewed, pending, completedCalls, upcomingCalls] = await Promise.all([
      this.prisma.enrollment.count({ where: { teacherId, isActive: true } }),
      this.prisma.submission.count({ where: { reviewedById: teacherId, status: SubmissionStatus.GRADED } }),
      this.prisma.submission.count({
        where: { status: SubmissionStatus.SUBMITTED, homework: { course: { enrollments: { some: { teacherId } } } } },
      }),
      this.prisma.call.count({ where: { teacherId, status: CallStatus.COMPLETED } }),
      this.prisma.call.count({ where: { teacherId, status: CallStatus.BOOKED, startsAt: { gt: new Date() } } }),
    ]);
    return { teacherId, students, submissionsGraded: reviewed, submissionsPending: pending, callsCompleted: completedCalls, callsUpcoming: upcomingCalls };
  }

  /** Детальный прогресс ученика (для автора, учителя, родителя). */
  async studentProgress(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        course: { include: { lessons: { select: { id: true } }, _count: { select: { homeworks: true } } } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const result = [];
    for (const e of enrollments) {
      const lessonIds = e.course.lessons.map((l) => l.id);
      const completedLessons = lessonIds.length
        ? await this.prisma.lessonProgress.count({
            where: { studentId, lessonId: { in: lessonIds }, status: "COMPLETED" },
          })
        : 0;
      const gradedSubmissions = await this.prisma.submission.count({
        where: { studentId, status: SubmissionStatus.GRADED, homework: { courseId: e.courseId } },
      });
      const avgScoreAgg = await this.prisma.submission.aggregate({
        where: { studentId, status: SubmissionStatus.GRADED, homework: { courseId: e.courseId } },
        _avg: { score: true },
      });

      result.push({
        courseId: e.courseId,
        courseTitle: e.course.title,
        teacher: e.teacher,
        totalLessons: lessonIds.length,
        completedLessons,
        lessonCompletionPct: lessonIds.length ? Math.round((completedLessons / lessonIds.length) * 100) : 0,
        totalHomework: e.course._count.homeworks,
        gradedSubmissions,
        averageScore: avgScoreAgg._avg.score ? Math.round(avgScoreAgg._avg.score) : null,
        callsUsed: e.callsUsed,
        callsTotal: e.callsTotal,
      });
    }
    return { studentId, courses: result };
  }

  /** Прогресс ребёнка для родителя — с проверкой связи. */
  async childProgressForParent(parentId: string, studentId: string) {
    const link = await this.prisma.parentLink.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link) throw new ForbiddenException("Этот ученик не привязан к вам");
    return this.studentProgress(studentId);
  }

  /** Просмотр лога действий (автор). */
  async auditLog(filter: { actorId?: string; action?: string; page: number; pageSize: number }) {
    const where = {
      actorId: filter.actorId,
      action: filter.action ? { contains: filter.action } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true, roles: true } } },
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }
}
