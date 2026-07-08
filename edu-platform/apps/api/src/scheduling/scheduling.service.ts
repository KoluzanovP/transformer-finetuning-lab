import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AvailabilityRule, Call } from "@prisma/client";
import { CallStatus, Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

interface RuleInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------- Доступность (настраивает автор для учителя/наставника) --------

  private async assertStaff(staffId: string): Promise<void> {
    const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException("Сотрудник не найден");
    const isStaff = staff.roles.includes(Role.TEACHER) || staff.roles.includes(Role.MENTOR);
    if (!isStaff) throw new BadRequestException("Расписание настраивается только для учителя или наставника");
  }

  async setAvailability(staffId: string, rules: RuleInput[]): Promise<AvailabilityRule[]> {
    await this.assertStaff(staffId);
    for (const r of rules) {
      if (r.weekday < 0 || r.weekday > 6) throw new BadRequestException("weekday должен быть 0..6");
      if (r.startMinute < 0 || r.endMinute > 24 * 60 || r.startMinute >= r.endMinute) {
        throw new BadRequestException("Некорректный интервал времени");
      }
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { staffId } });
      await tx.availabilityRule.createMany({
        data: rules.map((r) => ({ staffId, ...r })),
      });
      return tx.availabilityRule.findMany({ where: { staffId }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] });
    });
  }

  listAvailability(staffId: string): Promise<AvailabilityRule[]> {
    return this.prisma.availabilityRule.findMany({
      where: { staffId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    });
  }

  // -------- Слоты созвонов --------

  async createSlot(teacherId: string, dto: { startsAt: string; durationMinutes?: number; courseId?: string }): Promise<Call> {
    await this.assertStaff(teacherId);
    return this.prisma.call.create({
      data: {
        teacherId,
        courseId: dto.courseId,
        startsAt: new Date(dto.startsAt),
        durationMinutes: dto.durationMinutes ?? 30,
        status: CallStatus.AVAILABLE,
      },
    });
  }

  listForTeacher(teacherId: string): Promise<Call[]> {
    return this.prisma.call.findMany({
      where: { teacherId },
      include: { student: { select: { id: true, firstName: true, lastName: true } }, course: { select: { id: true, title: true } } },
      orderBy: { startsAt: "asc" },
    });
  }

  listForStudent(studentId: string): Promise<Call[]> {
    return this.prisma.call.findMany({
      where: { studentId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } }, course: { select: { id: true, title: true } } },
      orderBy: { startsAt: "asc" },
    });
  }

  /** Свободные слоты учителя. */
  availableForTeacher(teacherId: string): Promise<Call[]> {
    return this.prisma.call.findMany({
      where: { teacherId, status: CallStatus.AVAILABLE, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    });
  }

  /** Ученик бронирует слот. Списывает один созвон из квоты курса. */
  async book(studentId: string, callId: string, courseId: string): Promise<Call> {
    return this.prisma.$transaction(async (tx) => {
      const call = await tx.call.findUnique({ where: { id: callId } });
      if (!call) throw new NotFoundException("Слот не найден");
      if (call.status !== CallStatus.AVAILABLE) throw new BadRequestException("Слот уже занят");

      const enrollment = await tx.enrollment.findUnique({
        where: { courseId_studentId: { courseId, studentId } },
      });
      if (!enrollment) throw new ForbiddenException("Вы не зачислены на этот курс");
      if (enrollment.callsUsed >= enrollment.callsTotal) {
        throw new BadRequestException("Исчерпана квота созвонов по курсу");
      }

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { callsUsed: { increment: 1 } },
      });

      const updated = await tx.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.BOOKED,
          studentId,
          courseId,
          joinUrl: `https://meet.example.com/edu/${callId}`,
        },
      });
      return updated;
    }).then(async (updated) => {
      await this.notifications.notify(updated.teacherId, "call.booked", {
        callId: updated.id,
        studentId,
        startsAt: updated.startsAt,
      });
      return updated;
    });
  }

  /**
   * Сгенерировать слоты созвонов из правил доступности сотрудника на N недель
   * вперёд. Уже существующие слоты на те же времена не дублируются.
   */
  async generateSlots(staffId: string, weeks: number, durationMinutes = 30): Promise<{ created: number }> {
    await this.assertStaff(staffId);
    const rules = await this.prisma.availabilityRule.findMany({ where: { staffId } });
    if (!rules.length) return { created: 0 };

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const candidates: Date[] = [];

    for (let day = 0; day < weeks * 7; day += 1) {
      const date = new Date(startOfDay);
      date.setUTCDate(startOfDay.getUTCDate() + day);
      const weekday = date.getUTCDay();
      for (const rule of rules.filter((r) => r.weekday === weekday)) {
        for (let m = rule.startMinute; m + durationMinutes <= rule.endMinute; m += durationMinutes) {
          const slot = new Date(date);
          slot.setUTCMinutes(m);
          if (slot > now) candidates.push(new Date(slot));
        }
      }
    }

    let created = 0;
    for (const startsAt of candidates) {
      const exists = await this.prisma.call.findFirst({ where: { teacherId: staffId, startsAt } });
      if (exists) continue;
      await this.prisma.call.create({
        data: { teacherId: staffId, startsAt, durationMinutes, status: CallStatus.AVAILABLE },
      });
      created += 1;
    }
    return { created };
  }

  /** Отмена брони (учеником или учителем): слот снова свободен, квота возвращается. */
  async cancel(callId: string, user: { id: string; roles: Role[] }): Promise<Call> {
    return this.prisma.$transaction(async (tx) => {
      const call = await tx.call.findUnique({ where: { id: callId } });
      if (!call) throw new NotFoundException("Слот не найден");
      const isParticipant = call.studentId === user.id || call.teacherId === user.id || user.roles.includes(Role.AUTHOR);
      if (!isParticipant) throw new ForbiddenException("Нет доступа к слоту");

      if (call.status === CallStatus.BOOKED && call.studentId && call.courseId) {
        const enrollment = await tx.enrollment.findUnique({
          where: { courseId_studentId: { courseId: call.courseId, studentId: call.studentId } },
        });
        if (enrollment && enrollment.callsUsed > 0) {
          await tx.enrollment.update({ where: { id: enrollment.id }, data: { callsUsed: { decrement: 1 } } });
        }
      }
      return tx.call.update({
        where: { id: callId },
        data: { status: CallStatus.AVAILABLE, studentId: null, courseId: null, joinUrl: null },
      });
    });
  }

  async complete(callId: string, teacherId: string, notes?: string): Promise<Call> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException("Слот не найден");
    if (call.teacherId !== teacherId) throw new ForbiddenException("Это не ваш созвон");
    return this.prisma.call.update({ where: { id: callId }, data: { status: CallStatus.COMPLETED, notes } });
  }
}
