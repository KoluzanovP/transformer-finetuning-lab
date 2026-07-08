/**
 * Наполнение курса «Математика: с нуля до ЕГЭ».
 * Запуск: pnpm --filter @edu/api seed:math
 *
 * Контент модулей лежит в prisma/seeds/math/moduleN.ts (по одному модулю в файле).
 */
import { PrismaClient, CourseStatus, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { SeedModule } from "./seeds/math/types";
import m1 from "./seeds/math/module1";
import m2 from "./seeds/math/module2";
import m3 from "./seeds/math/module3";
import m4 from "./seeds/math/module4";
import m5 from "./seeds/math/module5";
import m6 from "./seeds/math/module6";
import m7 from "./seeds/math/module7";
import m8 from "./seeds/math/module8";

const prisma = new PrismaClient();
const modules: SeedModule[] = [m1, m2, m3, m4, m5, m6, m7, m8];

async function main() {
  console.log("Наполняю курс «Математика: с нуля до ЕГЭ»…");

  // Автор курса (переиспользуем демо-автора или создаём).
  let author = await prisma.user.findUnique({ where: { email: "author@edu.dev" } });
  if (!author) {
    author = await prisma.user.create({
      data: {
        email: "author@edu.dev",
        passwordHash: await bcrypt.hash("password123", 12),
        firstName: "Ольга",
        lastName: "Автор",
        roles: ["AUTHOR"],
      },
    });
  }

  const description =
    "Полный школьный курс математики с нуля до ЕГЭ: простые объяснения «как для чайника», " +
    "наглядные схемы, жизненные примеры, много задач и тестов для отработки. Модули:\n" +
    modules.map((m, i) => `${i + 1}. ${m.title}`).join("\n");

  const course = await prisma.course.upsert({
    where: { slug: "math-ege" },
    update: { description, status: CourseStatus.PUBLISHED },
    create: {
      title: "Математика: с нуля до ЕГЭ",
      slug: "math-ege",
      description,
      status: CourseStatus.PUBLISHED,
      authorId: author.id,
      callsPerStudent: 12,
      callDurationMinutes: 30,
    },
  });

  // Идемпотентность: пересоздаём уроки и домашки курса.
  await prisma.homework.deleteMany({ where: { courseId: course.id } });
  await prisma.lesson.deleteMany({ where: { courseId: course.id } });

  let order = 0;
  let lessonCount = 0;
  let hwCount = 0;
  let blockCount = 0;
  let quizCount = 0;

  for (let mi = 0; mi < modules.length; mi += 1) {
    const mod = modules[mi];
    const lessonIds: string[] = [];

    for (let li = 0; li < mod.lessons.length; li += 1) {
      const lesson = mod.lessons[li];
      const created = await prisma.lesson.create({
        data: {
          courseId: course.id,
          title: `${mi + 1}.${li + 1} ${lesson.title}`,
          order: order++,
          isPublished: true,
          estimatedMinutes: lesson.estimatedMinutes ?? 20,
          content: { version: 1, blocks: lesson.blocks } as unknown as Prisma.InputJsonValue,
        },
      });
      lessonIds.push(created.id);
      lessonCount += 1;
      blockCount += lesson.blocks.length;
      quizCount += lesson.blocks.filter((b) => b.type === "QUIZ").length;
    }

    for (let hi = 0; hi < mod.homeworks.length; hi += 1) {
      const hw = mod.homeworks[hi];
      const lessonId = hw.lessonIndex != null ? lessonIds[hw.lessonIndex] : undefined;
      await prisma.homework.create({
        data: {
          courseId: course.id,
          lessonId: lessonId ?? null,
          title: `${mi + 1}. ${hw.title}`,
          description: hw.description,
          maxScore: hw.maxScore ?? 100,
          order: hwCount,
          content: { version: 1, blocks: hw.blocks } as unknown as Prisma.InputJsonValue,
        },
      });
      hwCount += 1;
      quizCount += hw.blocks.filter((b) => b.type === "QUIZ").length;
    }
  }

  // Зачисляем демо-ученика (если есть), чтобы курс был сразу доступен для просмотра.
  const student = await prisma.user.findUnique({ where: { email: "student@edu.dev" } });
  const teacher = await prisma.user.findUnique({ where: { email: "teacher@edu.dev" } });
  if (student) {
    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      update: { teacherId: teacher?.id ?? null, isActive: true },
      create: { courseId: course.id, studentId: student.id, teacherId: teacher?.id ?? null, callsTotal: course.callsPerStudent },
    });
  }

  console.log(
    `Готово: модулей ${modules.length}, уроков ${lessonCount}, домашек ${hwCount}, ` +
      `блоков контента ${blockCount}, тестов-вопросов ${quizCount}.`,
  );
  console.log(`Курс опубликован (slug: math-ege)${student ? ", демо-ученик зачислен" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
