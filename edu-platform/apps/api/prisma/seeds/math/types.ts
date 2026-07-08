/**
 * Контракт данных для наполнения курса математики.
 * Блоки повторяют модель packages/shared/blocks.ts (LessonBlock), но типизированы
 * свободно (any), чтобы контент-файлы модулей были компактными и независимыми.
 */

export type SeedBlock = Record<string, unknown> & { id: string; type: string };

export interface SeedLesson {
  title: string;
  estimatedMinutes?: number;
  blocks: SeedBlock[];
}

export interface SeedHomework {
  title: string;
  description: string;
  maxScore?: number;
  /** Индекс урока (0-based) внутри модуля, к которому привязать ДЗ. */
  lessonIndex?: number;
  blocks: SeedBlock[];
}

export interface SeedModule {
  title: string;
  summary?: string;
  lessons: SeedLesson[];
  homeworks: SeedHomework[];
}
