import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import type { Prisma, User } from "@prisma/client";
import { Role, type UserPublic } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  static toPublic(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles as Role[],
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Пользователь не найден");
    return user;
  }

  async create(input: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    roles: Role[];
  }): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Пользователь с таким email уже существует");

    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: input.roles,
      },
    });
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async list(filter?: { role?: Role }): Promise<UserPublic[]> {
    const where: Prisma.UserWhereInput = filter?.role
      ? { roles: { has: filter.role } }
      : {};
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return users.map(UsersService.toPublic);
  }

  async setRoles(id: string, roles: Role[]): Promise<UserPublic> {
    await this.findById(id);
    const user = await this.prisma.user.update({ where: { id }, data: { roles } });
    return UsersService.toPublic(user);
  }

  /** Привязать родителя к ученику. */
  async linkParent(parentId: string, studentId: string): Promise<void> {
    const [parent, student] = await Promise.all([
      this.findById(parentId),
      this.findById(studentId),
    ]);
    if (!parent.roles.includes(Role.PARENT)) {
      throw new BadRequestException("Указанный пользователь не является родителем");
    }
    if (!student.roles.includes(Role.STUDENT)) {
      throw new BadRequestException("Указанный пользователь не является учеником");
    }
    await this.prisma.parentLink.upsert({
      where: { parentId_studentId: { parentId, studentId } },
      create: { parentId, studentId },
      update: {},
    });
  }

  async childrenOf(parentId: string): Promise<UserPublic[]> {
    const links = await this.prisma.parentLink.findMany({
      where: { parentId },
      include: { student: true },
    });
    return links.map((l) => UsersService.toPublic(l.student));
  }
}
