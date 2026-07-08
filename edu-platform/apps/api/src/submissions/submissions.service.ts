import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Submission } from "@prisma/client";
import { SubmissionStatus, type LessonDocument } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ученик сохраняет/отправляет ответ. submit=true переводит в SUBMITTED. */
  async upsertForStudent(studentId: string, homeworkId: string, content: LessonDocument, submit: boolean): Promise<Submission> {
    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw new NotFoundException("Домашнее задание не найдено");

    // Проверяем, что ученик зачислен на курс.
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: hw.courseId, studentId } },
    });
    if (!enrollment) throw new ForbiddenException("Вы не зачислены на этот курс");

    const status = submit ? SubmissionStatus.SUBMITTED : SubmissionStatus.DRAFT;
    const submission = await this.prisma.submission.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      create: {
        homeworkId,
        studentId,
        content: content as unknown as Prisma.InputJsonValue,
        status,
        submittedAt: submit ? new Date() : null,
      },
      update: {
        content: content as unknown as Prisma.InputJsonValue,
        status,
        submittedAt: submit ? new Date() : undefined,
      },
    });

    // Уведомляем закреплённого учителя о новой сдаче.
    if (submit && enrollment.teacherId) {
      await this.notifications.notify(enrollment.teacherId, "submission.submitted", {
        submissionId: submission.id,
        homeworkId,
        homeworkTitle: hw.title,
        studentId,
      });
    }
    return submission;
  }

  /**
   * Авто-проверка теста: сверяет ответы ученика с правильными вариантами в
   * QUIZ-блоках домашки, вычисляет балл (процент верных), сохраняет как
   * проверенную сдачу (GRADED) и возвращает детальный результат.
   */
  async autoCheck(
    studentId: string,
    homeworkId: string,
    answers: Record<string, string[]>,
  ) {
    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw new NotFoundException("Домашнее задание не найдено");

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: hw.courseId, studentId } },
    });
    if (!enrollment) throw new ForbiddenException("Вы не зачислены на этот курс");

    const content = hw.content as unknown as {
      blocks?: Array<{ id: string; type: string; options?: Array<{ id: string; correct: boolean }> }>;
    };
    const quizzes = (content.blocks ?? []).filter((b) => b.type === "QUIZ" && b.options);
    if (quizzes.length === 0) {
      throw new BadRequestException("В этом задании нет тестовых вопросов");
    }

    const results = quizzes.map((q) => {
      const correctIds = (q.options ?? []).filter((o) => o.correct).map((o) => o.id).sort();
      const given = [...(answers[q.id] ?? [])].sort();
      const isCorrect =
        given.length === correctIds.length && given.every((id, i) => id === correctIds[i]);
      return { blockId: q.id, correct: isCorrect, correctOptionIds: correctIds };
    });

    const correctCount = results.filter((r) => r.correct).length;
    const total = quizzes.length;
    const scorePercent = Math.round((correctCount / total) * 100);

    await this.prisma.submission.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      create: {
        homeworkId,
        studentId,
        content: { version: 1, blocks: [] } as unknown as Prisma.InputJsonValue,
        status: SubmissionStatus.GRADED,
        score: scorePercent,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
      update: {
        status: SubmissionStatus.GRADED,
        score: scorePercent,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    await this.notifications.notify(studentId, "submission.graded", {
      homeworkId,
      score: scorePercent,
      auto: true,
    });

    return { scorePercent, correctCount, total, results };
  }

  listForStudent(studentId: string) {
    return this.prisma.submission.findMany({
      where: { studentId },
      include: { homework: { select: { id: true, title: true, courseId: true, maxScore: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  /** Очередь проверки для учителя: сдачи учеников, закреплённых за ним. */
  async queueForTeacher(teacherId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { teacherId },
      select: { studentId: true, courseId: true },
    });
    if (enrollments.length === 0) return [];
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
    return this.prisma.submission.findMany({
      where: {
        studentId: { in: studentIds },
        status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.RETURNED, SubmissionStatus.GRADED] },
        homework: { courseId: { in: courseIds } },
      },
      include: {
        homework: { select: { id: true, title: true, maxScore: true, courseId: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
  }

  async get(id: string): Promise<Submission> {
    const s = await this.prisma.submission.findUnique({
      where: { id },
      include: { homework: true, student: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!s) throw new NotFoundException("Сдача не найдена");
    return s;
  }

  private async assertTeacherCanReview(teacherId: string, submission: Submission): Promise<void> {
    const hw = await this.prisma.homework.findUnique({ where: { id: submission.homeworkId } });
    if (!hw) throw new NotFoundException("Домашнее задание не найдено");
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: hw.courseId, studentId: submission.studentId } },
    });
    if (!enrollment || enrollment.teacherId !== teacherId) {
      throw new ForbiddenException("Вы не являетесь учителем этого ученика на курсе");
    }
  }

  /** Учитель оценивает (GRADED) или возвращает на доработку (RETURNED). */
  async review(teacherId: string, submissionId: string, dto: { status: "GRADED" | "RETURNED"; score?: number }): Promise<Submission> {
    const submission = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException("Сдача не найдена");
    await this.assertTeacherCanReview(teacherId, submission);

    if (dto.status === SubmissionStatus.GRADED) {
      const hw = await this.prisma.homework.findUnique({ where: { id: submission.homeworkId } });
      if (dto.score == null) throw new BadRequestException("Укажите балл при выставлении оценки");
      if (hw && (dto.score < 0 || dto.score > hw.maxScore)) {
        throw new BadRequestException(`Балл должен быть в диапазоне 0..${hw.maxScore}`);
      }
    }

    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: dto.status,
        score: dto.status === SubmissionStatus.GRADED ? dto.score : null,
        reviewedById: teacherId,
        reviewedAt: new Date(),
      },
    });

    await this.notifications.notify(
      updated.studentId,
      dto.status === SubmissionStatus.GRADED ? "submission.graded" : "submission.returned",
      { submissionId: updated.id, homeworkId: updated.homeworkId, score: updated.score },
    );
    return updated;
  }
}
