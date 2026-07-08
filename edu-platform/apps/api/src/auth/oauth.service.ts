import { Injectable } from "@nestjs/common";
import { Role, type AuthResponse } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { TokensService } from "./tokens.service";
import { AuditService } from "../common/audit/audit.service";

export interface OAuthProfile {
  provider: "google" | "vk";
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Вход/регистрация по внешнему профилю.
   * 1) если есть OAuthAccount — берём его пользователя;
   * 2) иначе если есть User с таким email — привязываем провайдера;
   * 3) иначе создаём нового пользователя (роль STUDENT) и привязку.
   */
  async loginWithProfile(profile: OAuthProfile): Promise<AuthResponse> {
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: profile.provider, providerId: profile.providerId } },
      include: { user: true },
    });

    let user = existing?.user ?? null;

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            firstName: profile.firstName || "Пользователь",
            lastName: profile.lastName || "",
            avatarUrl: profile.avatarUrl,
            roles: [Role.STUDENT],
          },
        });
      }
      await this.prisma.oAuthAccount.create({
        data: { provider: profile.provider, providerId: profile.providerId, userId: user.id },
      });
      await this.audit.log({ actorId: user.id, action: `auth.oauth.${profile.provider}`, entityType: "User", entityId: user.id });
    }

    const tokens = await this.tokens.issue({ id: user.id, email: user.email, roles: user.roles as Role[] });
    return { user: UsersService.toPublic(user), tokens };
  }
}
