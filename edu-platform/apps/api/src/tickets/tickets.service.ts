import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role, TicketStatus } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ученик создаёт обращение в поддержку с первым сообщением. */
  create(createdById: string, dto: { subject: string; body: string }) {
    return this.prisma.supportTicket.create({
      data: {
        createdById,
        subject: dto.subject,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            senderId: createdById,
            body: dto.body,
          },
        },
      },
      include: { messages: true },
    });
  }

  /** Список обращений текущего пользователя (свежие сверху). */
  listMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { createdById: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
        mentor: true,
      },
    });
  }

  /** Очередь обращений для наставника (все обращения). */
  listQueue() {
    return this.prisma.supportTicket.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        createdBy: true,
        mentor: true,
      },
    });
  }

  /** Проверяет доступ пользователя к обращению. */
  private assertAccess(createdById: string, user: AuthUser): void {
    const allowed =
      user.id === createdById ||
      user.roles.includes(Role.MENTOR) ||
      user.roles.includes(Role.AUTHOR);
    if (!allowed) {
      throw new ForbiddenException("Нет доступа к обращению");
    }
  }

  /** Открыть обращение с перепиской. */
  async get(id: string, user: AuthUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          include: { sender: true },
          orderBy: { createdAt: "asc" },
        },
        createdBy: true,
        mentor: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException("Обращение не найдено");
    }
    this.assertAccess(ticket.createdById, user);
    return ticket;
  }

  /** Ответить в обращении. Первый ответ наставника берёт обращение в работу. */
  async reply(id: string, user: AuthUser, body: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException("Обращение не найдено");
    }
    this.assertAccess(ticket.createdById, user);

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        body,
      },
    });

    const takeInWork = user.roles.includes(Role.MENTOR) && ticket.mentorId === null;
    await this.prisma.supportTicket.update({
      where: { id },
      data: takeInWork
        ? { mentorId: user.id, status: TicketStatus.IN_PROGRESS }
        : { updatedAt: new Date() },
    });

    return message;
  }

  /** Смена статуса обращения (наставник/автор). */
  async setStatus(id: string, user: AuthUser, status: TicketStatus) {
    if (!user.roles.includes(Role.MENTOR) && !user.roles.includes(Role.AUTHOR)) {
      throw new ForbiddenException("Недостаточно прав для смены статуса");
    }
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException("Обращение не найдено");
    }
    const takeMentor = user.roles.includes(Role.MENTOR) && ticket.mentorId === null;
    return this.prisma.supportTicket.update({
      where: { id },
      data: takeMentor ? { status, mentorId: user.id } : { status },
    });
  }
}
