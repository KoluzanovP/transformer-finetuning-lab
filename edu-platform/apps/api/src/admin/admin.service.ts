import { Injectable } from "@nestjs/common";
import { CourseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import type { SeedModule } from "../../prisma/seeds/math/types";

// Данные курсов (те же, что в prisma/seed-math*.ts).
import m1 from "../../prisma/seeds/math/module1";
import m2 from "../../prisma/seeds/math/module2";
import m3 from "../../prisma/seeds/math/module3";
import m4 from "../../prisma/seeds/math/module4";
import m5 from "../../prisma/seeds/math/module5";
import m6 from "../../prisma/seeds/math/module6";
import m7 from "../../prisma/seeds/math/module7";
import m8 from "../../prisma/seeds/math/module8";
import v1 from "../../prisma/seeds/math-ege/variant1";
import v2 from "../../prisma/seeds/math-ege/variant2";
import v3 from "../../prisma/seeds/math-ege/variant3";
import v4 from "../../prisma/seeds/math-ege/variant4";
import v5 from "../../prisma/seeds/math-ege/variant5";
import v6 from "../../prisma/seeds/math-ege/variant6";
import v7 from "../../prisma/seeds/math-ege/variant7";
import v8 from "../../prisma/seeds/math-ege/variant8";

const MATH_MODULES: SeedModule[] = [m1, m2, m3, m4, m5, m6, m7, m8];
const EGE_VARIANTS: SeedModule[] = [v1, v2, v3, v4, v5, v6, v7, v8];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async buildCourse(opts: {
    authorId: string;
    slug: string;
    title: string;
    description: string;
    modules: SeedModule[];
    callsPerStudent: number;
    numberLessons: boolean;
    defaultLessonMinutes: number;
  }) {
    const course = await this.prisma.course.upsert({
      where: { slug: opts.slug },
      update: { description: opts.description, status: CourseStatus.PUBLISHED, authorId: opts.authorId },
      create: {
        title: opts.title,
        slug: opts.slug,
        description: opts.description,
        status: CourseStatus.PUBLISHED,
        authorId: opts.authorId,
        callsPerStudent: opts.callsPerStudent,
        callDurationMinutes: 30,
      },
    });

    await this.prisma.homework.deleteMany({ where: { courseId: course.id } });
    await this.prisma.lesson.deleteMany({ where: { courseId: course.id } });

    let order = 0;
    let lessons = 0;
    let homeworks = 0;
    let quizzes = 0;

    for (let mi = 0; mi < opts.modules.length; mi += 1) {
      const mod = opts.modules[mi];
      const lessonIds: string[] = [];
      for (let li = 0; li < mod.lessons.length; li += 1) {
        const lesson = mod.lessons[li];
        const created = await this.prisma.lesson.create({
          data: {
            courseId: course.id,
            title: opts.numberLessons ? `${mi + 1}.${li + 1} ${lesson.title}` : lesson.title,
            order: order++,
            isPublished: true,
            estimatedMinutes: lesson.estimatedMinutes ?? opts.defaultLessonMinutes,
            content: { version: 1, blocks: lesson.blocks } as unknown as Prisma.InputJsonValue,
          },
        });
        lessonIds.push(created.id);
        lessons += 1;
        quizzes += lesson.blocks.filter((b) => b.type === "QUIZ").length;
      }
      for (const hw of mod.homeworks) {
        const lessonId = hw.lessonIndex != null ? lessonIds[hw.lessonIndex] : undefined;
        await this.prisma.homework.create({
          data: {
            courseId: course.id,
            lessonId: lessonId ?? null,
            title: opts.numberLessons ? `${mi + 1}. ${hw.title}` : hw.title,
            description: hw.description,
            maxScore: hw.maxScore ?? 100,
            order: homeworks,
            content: { version: 1, blocks: hw.blocks } as unknown as Prisma.InputJsonValue,
          },
        });
        homeworks += 1;
        quizzes += hw.blocks.filter((b) => b.type === "QUIZ").length;
      }
    }
    return { courseId: course.id, title: course.title, lessons, homeworks, quizzes };
  }

  /** Загрузить/обновить готовые курсы математики. Автор курсов — вызывающий. */
  async seedMathCourses(authorId: string) {
    const math = await this.buildCourse({
      authorId,
      slug: "math-ege",
      title: "Математика: с нуля до ЕГЭ",
      description:
        "Полный школьный курс математики с нуля до ЕГЭ: простые объяснения, наглядные схемы, " +
        "жизненные примеры, много задач и тестов.",
      modules: MATH_MODULES,
      callsPerStudent: 12,
      numberLessons: true,
      defaultLessonMinutes: 20,
    });
    const ege = await this.buildCourse({
      authorId,
      slug: "math-ege-variants",
      title: "ЕГЭ по математике: пробные варианты",
      description: "Пробные варианты ЕГЭ с разборами, схемами, ответами и авто-проверяемыми тестами.",
      modules: EGE_VARIANTS,
      callsPerStudent: 6,
      numberLessons: false,
      defaultLessonMinutes: 40,
    });
    return { courses: [math, ege] };
  }
}
