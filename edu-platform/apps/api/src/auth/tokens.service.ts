import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import type { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import type { JwtPayload } from "./strategies/jwt.strategy";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private ttlToMs(ttl: string): number {
    const m = ttl.match(/^(\d+)([smhd])$/);
    if (!m) return 7 * 24 * 3600 * 1000;
    const n = parseInt(m[1], 10);
    const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]]!;
    return n * unit;
  }

  async issue(user: { id: string; email: string; roles: Role[] }): Promise<IssuedTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email, roles: user.roles };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("jwt.accessSecret"),
      expiresIn: this.config.get<string>("jwt.accessTtl"),
    });

    // Refresh — случайная строка (не JWT), храним только sha256-хэш.
    const raw = `${user.id}.${randomBytes(48).toString("hex")}`;
    const refreshTtl = this.config.get<string>("jwt.refreshTtl") ?? "7d";
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.sha256(raw),
        userId: user.id,
        expiresAt: new Date(Date.now() + this.ttlToMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken: raw };
  }

  /** Проверяет refresh, ротирует его (revoke старый, выдаёт новую пару). */
  async rotate(
    rawRefresh: string,
    lookupUser: (id: string) => Promise<{ id: string; email: string; roles: Role[] } | null>,
  ): Promise<IssuedTokens> {
    const hash = this.sha256(rawRefresh);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Недействительный refresh-токен");
    }
    const user = await lookupUser(stored.userId);
    if (!user) throw new UnauthorizedException("Пользователь не найден");

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issue(user);
  }

  async revoke(rawRefresh: string): Promise<void> {
    const hash = this.sha256(rawRefresh);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
