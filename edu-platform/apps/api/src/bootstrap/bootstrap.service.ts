import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * Разовое создание автора платформы из переменных окружения — удобно для
 * PaaS-развёртывания (Timeweb Apps), где нет доступа к консоли контейнера.
 *
 * Задайте BOOTSTRAP_ADMIN_EMAIL и BOOTSTRAP_ADMIN_PASSWORD — при старте появится
 * аккаунт с ролью AUTHOR (идемпотентно; пароль обновляется при каждом старте,
 * поэтому после первого входа переменные можно убрать).
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password) return;

    if (password.length < 8) {
      this.logger.warn("BOOTSTRAP_ADMIN_PASSWORD слишком короткий (мин. 8) — пропускаю.");
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await this.prisma.user.upsert({
        where: { email },
        update: { roles: [Role.AUTHOR], passwordHash, isActive: true },
        create: {
          email,
          passwordHash,
          firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "Админ",
          lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "Платформы",
          roles: [Role.AUTHOR],
        },
      });
      this.logger.log(`Автор платформы готов: ${user.email}`);
    } catch (err) {
      this.logger.error(`Не удалось создать автора из BOOTSTRAP_ADMIN_*: ${String(err)}`);
    }
  }
}
