/**
 * Демо-данные для локальной разработки.
 * Запуск: pnpm --filter @edu/api seed
 */
import { PrismaClient, CourseStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email: string, firstName: string, lastName: string, roles: string[]) {
  const passwordHash = await bcrypt.hash("password123", 12);
  return prisma.user.upsert({
    where: { email },
    update: { firstName, lastName, roles: roles as never },
    create: { email, firstName, lastName, roles: roles as never, passwordHash },
  });
}

const demoLessonContent = {
  version: 1,
  blocks: [
    { id: "b1", type: "HEADING", text: "Введение в Python", level: 1 },
    { id: "b2", type: "MARKDOWN", markdown: "В этом уроке мы разберём **переменные** и типы данных." },
    { id: "b3", type: "VIDEO", url: "https://cdn.example.com/videos/python-intro.mp4", provider: "FILE", caption: "Обзорное видео" },
    { id: "b4", type: "CODE", language: "python", code: "name = 'Аня'\nprint(f'Привет, {name}!')" },
    { id: "b5", type: "CALLOUT", variant: "info", markdown: "Совет: пробуйте код сами в интерпретаторе." },
    { id: "b6", type: "QUIZ", question: "Что выведет print(2 ** 3)?", multiple: false, options: [
      { id: "o1", text: "6", correct: false },
      { id: "o2", text: "8", correct: true },
      { id: "o3", text: "9", correct: false },
    ], explanation: "** — возведение в степень, 2 в кубе = 8." },
  ],
};

async function main() {
  console.log("Заполняю демо-данные…");

  const author = await upsertUser("author@edu.dev", "Ольга", "Автор", ["AUTHOR"]);
  const teacher = await upsertUser("teacher@edu.dev", "Иван", "Учителев", ["TEACHER"]);
  const mentor = await upsertUser("mentor@edu.dev", "Мария", "Наставник", ["MENTOR"]);
  const student = await upsertUser("student@edu.dev", "Пётр", "Ученик", ["STUDENT"]);
  const parent = await upsertUser("parent@edu.dev", "Елена", "Родитель", ["PARENT"]);

  // Родитель ↔ ученик
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    update: {},
    create: { parentId: parent.id, studentId: student.id },
  });

  // Курс
  const course = await prisma.course.upsert({
    where: { slug: "python-basics" },
    update: {},
    create: {
      title: "Основы Python",
      slug: "python-basics",
      description: "Базовый курс программирования на Python для начинающих.",
      status: CourseStatus.PUBLISHED,
      authorId: author.id,
      callsPerStudent: 8,
      callDurationMinutes: 30,
    },
  });

  // Уроки
  const lesson1 = await prisma.lesson.upsert({
    where: { courseId_order: { courseId: course.id, order: 0 } },
    update: { content: demoLessonContent as never },
    create: { courseId: course.id, title: "Переменные и типы", order: 0, isPublished: true, estimatedMinutes: 25, content: demoLessonContent as never },
  });
  await prisma.lesson.upsert({
    where: { courseId_order: { courseId: course.id, order: 1 } },
    update: {},
    create: { courseId: course.id, title: "Условия и циклы", order: 1, isPublished: true, estimatedMinutes: 30 },
  });

  // Домашка
  await prisma.homework.upsert({
    where: { id: "seed-hw-1" },
    update: {},
    create: {
      id: "seed-hw-1",
      courseId: course.id,
      lessonId: lesson1.id,
      title: "ДЗ №1: первая программа",
      description: "Напишите программу, которая печатает ваше имя и возраст.",
      maxScore: 100,
      order: 0,
    },
  });

  // Зачисление ученика с назначенным учителем
  await prisma.enrollment.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
    update: { teacherId: teacher.id },
    create: { courseId: course.id, studentId: student.id, teacherId: teacher.id, callsTotal: course.callsPerStudent },
  });

  // Доступность учителя (Пн, Ср 10:00–14:00)
  await prisma.availabilityRule.deleteMany({ where: { staffId: teacher.id } });
  await prisma.availabilityRule.createMany({
    data: [
      { staffId: teacher.id, weekday: 1, startMinute: 600, endMinute: 840 },
      { staffId: teacher.id, weekday: 3, startMinute: 600, endMinute: 840 },
    ],
  });

  console.log("Готово. Учётные записи (пароль у всех: password123):");
  console.log("  author@edu.dev / teacher@edu.dev / mentor@edu.dev / student@edu.dev / parent@edu.dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
