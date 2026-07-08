/**
 * Курс «ЕГЭ по математике: пробные варианты».
 * Запуск: pnpm --filter @edu/api seed:ege
 * Контент вариантов — prisma/seeds/math-ege/variantN.ts.
 */
import { PrismaClient, CourseStatus, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { SeedModule } from "./seeds/math/types";
import v1 from "./seeds/math-ege/variant1";
import v2 from "./seeds/math-ege/variant2";
import v3 from "./seeds/math-ege/variant3";
import v4 from "./seeds/math-ege/variant4";

const prisma = new PrismaClient();
const variants: SeedModule[] = [v1, v2, v3, v4];

async function main() {
  console.log("Наполняю курс «ЕГЭ по математике: пробные варианты»…");

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
    "Пробные варианты ЕГЭ по математике с полными разборами, схемами и ответами. " +
    "Тренируйтесь в формате экзамена и проверяйте себя тестами.\n" +
    variants.map((v, i) => `${i + 1}. ${v.title}`).join("\n");

  const course = await prisma.course.upsert({
    where: { slug: "math-ege-variants" },
    update: { description, status: CourseStatus.PUBLISHED },
    create: {
      title: "ЕГЭ по математике: пробные варианты",
      slug: "math-ege-variants",
      description,
      status: CourseStatus.PUBLISHED,
      authorId: author.id,
      callsPerStudent: 6,
      callDurationMinutes: 30,
    },
  });

  await prisma.homework.deleteMany({ where: { courseId: course.id } });
  await prisma.lesson.deleteMany({ where: { courseId: course.id } });

  let order = 0;
  let lessonCount = 0;
  let hwCount = 0;
  let quizCount = 0;

  for (let vi = 0; vi < variants.length; vi += 1) {
    const variant = variants[vi];
    const lessonIds: string[] = [];
    for (let li = 0; li < variant.lessons.length; li += 1) {
      const lesson = variant.lessons[li];
      const created = await prisma.lesson.create({
        data: {
          courseId: course.id,
          title: lesson.title,
          order: order++,
          isPublished: true,
          estimatedMinutes: lesson.estimatedMinutes ?? 40,
          content: { version: 1, blocks: lesson.blocks } as unknown as Prisma.InputJsonValue,
        },
      });
      lessonIds.push(created.id);
      lessonCount += 1;
      quizCount += lesson.blocks.filter((b) => b.type === "QUIZ").length;
    }
    for (const hw of variant.homeworks) {
      const lessonId = hw.lessonIndex != null ? lessonIds[hw.lessonIndex] : undefined;
      await prisma.homework.create({
        data: {
          courseId: course.id,
          lessonId: lessonId ?? null,
          title: hw.title,
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

  const student = await prisma.user.findUnique({ where: { email: "student@edu.dev" } });
  const teacher = await prisma.user.findUnique({ where: { email: "teacher@edu.dev" } });
  if (student) {
    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      update: { teacherId: teacher?.id ?? null, isActive: true },
      create: { courseId: course.id, studentId: student.id, teacherId: teacher?.id ?? null, callsTotal: course.callsPerStudent },
    });
  }

  console.log(`Готово: вариантов ${variants.length}, уроков-разборов ${lessonCount}, пробников ${hwCount}, тест-вопросов ${quizCount}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
