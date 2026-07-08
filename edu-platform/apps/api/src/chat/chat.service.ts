import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import { type AuthUser } from "../common/decorators/current-user.decorator";

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /** Открыть (или найти) личный диалог между учеником и учителем. */
  async openThread(
    user: AuthUser,
    dto: { teacherId?: string; studentId?: string; courseId?: string },
  ) {
    let studentId: string;
    let teacherId: string;

    if (user.roles.includes(Role.STUDENT)) {
      if (!dto.teacherId) {
        throw new BadRequestException("Не указан учитель (teacherId)");
      }
      studentId = user.id;
      teacherId = dto.teacherId;
    } else if (user.roles.includes(Role.TEACHER)) {
      if (!dto.studentId) {
        throw new BadRequestException("Не указан ученик (studentId)");
      }
      studentId = dto.studentId;
      teacherId = user.id;
    } else {
      throw new ForbiddenException("Недостаточно прав для открытия диалога");
    }

    const courseId = dto.courseId ?? null;

    return this.prisma.chatThread.upsert({
      where: {
        studentId_teacherId_courseId: {
          studentId,
          teacherId,
          courseId: courseId as string,
        },
      },
      create: { studentId, teacherId, courseId },
      update: {},
    });
  }

  /** Список диалогов текущего пользователя с последним сообщением. */
  listThreads(user: AuthUser) {
    return this.prisma.chatThread.findMany({
      where: {
        OR: [{ studentId: user.id }, { teacherId: user.id }],
      },
      include: {
        student: true,
        teacher: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Сообщения диалога (только для участников). */
  async getMessages(threadId: string, user: AuthUser) {
    await this.ensureParticipant(threadId, user);
    return this.prisma.chatMessage.findMany({
      where: { threadId },
      include: { sender: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Отправить сообщение в диалог. */
  async sendMessage(threadId: string, user: AuthUser, body: string) {
    await this.ensureParticipant(threadId, user);
    return this.prisma.chatMessage.create({
      data: { threadId, senderId: user.id, body },
    });
  }

  /** Отметить входящие сообщения диалога прочитанными. */
  async markRead(threadId: string, user: AuthUser) {
    await this.ensureParticipant(threadId, user);
    return this.prisma.chatMessage.updateMany({
      where: { threadId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /** Проверяет, что пользователь — участник диалога (ученик или учитель). */
  private async ensureParticipant(threadId: string, user: AuthUser) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
    });
    if (!thread || (thread.studentId !== user.id && thread.teacherId !== user.id)) {
      throw new ForbiddenException("Нет доступа к этому диалогу");
    }
    return thread;
  }
}
