/**
 * Создание/обновление аккаунта автора платформы (первичный админ).
 * Публичная регистрация автора запрещена, поэтому первого автора заводим так.
 *
 * Использование:
 *   pnpm --filter @edu/api admin:create <email> <пароль> [Имя] [Фамилия]
 * В Docker:
 *   docker compose -f docker-compose.prod.yml exec api pnpm admin:create admin@site.ru 'StrongPass1'
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, firstName = "Админ", lastName = "Платформы"] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Использование: admin:create <email> <пароль> [Имя] [Фамилия]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Пароль должен быть не короче 8 символов.");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { roles: ["AUTHOR"], passwordHash, isActive: true },
    create: { email: email.toLowerCase(), passwordHash, firstName, lastName, roles: ["AUTHOR"] },
  });
  console.log(`Готово. Автор: ${user.email} (роли: ${user.roles.join(", ")}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
