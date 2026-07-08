import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Удобный помощник для тестов: очистка всех таблиц в правильном порядке. */
  async truncateAll(): Promise<void> {
    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    const tables = tablenames
      .map(({ tablename }) => `"public"."${tablename}"`)
      .filter((name) => !name.includes("_prisma_migrations"))
      .join(", ");
    if (tables.length) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  }
}
