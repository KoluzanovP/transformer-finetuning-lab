/**
 * Модель контента урока в стиле Jupyter Notebook.
 *
 * Урок = упорядоченный список ячеек (блоков). Каждая ячейка имеет тип и
 * полезную нагрузку. Порядок задаётся массивом; поле `id` стабильно для
 * drag-and-drop и комментариев к конкретной ячейке.
 */

export const BlockType = {
  /** Форматированный текст (Markdown). */
  MARKDOWN: "MARKDOWN",
  /** Заголовок раздела внутри урока. */
  HEADING: "HEADING",
  /** Изображение (ссылка на media asset). */
  IMAGE: "IMAGE",
  /** Видео (media asset или внешний embed). */
  VIDEO: "VIDEO",
  /** Аудио (media asset). */
  AUDIO: "AUDIO",
  /** Блок кода с указанием языка (как code-cell в Jupyter). */
  CODE: "CODE",
  /** Выноска / callout (заметка, предупреждение). */
  CALLOUT: "CALLOUT",
  /** Встраиваемый тест с вариантами (быстрая самопроверка). */
  QUIZ: "QUIZ",
  /**
   * Ссылка на домашнее задание, прикреплённое к уроку. Сам контент задания
   * хранится в модели Homework; блок лишь размещает его в потоке урока.
   */
  HOMEWORK_REF: "HOMEWORK_REF",
  /** Разделитель. */
  DIVIDER: "DIVIDER",
} as const;
export type BlockType = (typeof BlockType)[keyof typeof BlockType];

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface MarkdownBlock extends BaseBlock {
  type: "MARKDOWN";
  markdown: string;
}

export interface HeadingBlock extends BaseBlock {
  type: "HEADING";
  text: string;
  level: 1 | 2 | 3;
}

export interface ImageBlock extends BaseBlock {
  type: "IMAGE";
  assetId?: string;
  url: string;
  alt?: string;
  caption?: string;
}

export interface VideoBlock extends BaseBlock {
  type: "VIDEO";
  assetId?: string;
  /** Прямая ссылка (S3/CDN) или внешний embed (YouTube/Vimeo). */
  url: string;
  provider?: "FILE" | "YOUTUBE" | "VIMEO";
  caption?: string;
}

export interface AudioBlock extends BaseBlock {
  type: "AUDIO";
  assetId?: string;
  url: string;
  caption?: string;
}

export interface CodeBlock extends BaseBlock {
  type: "CODE";
  language: string;
  code: string;
}

export interface CalloutBlock extends BaseBlock {
  type: "CALLOUT";
  variant: "info" | "warning" | "success" | "danger";
  markdown: string;
}

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuizBlock extends BaseBlock {
  type: "QUIZ";
  question: string;
  multiple: boolean;
  options: QuizOption[];
  explanation?: string;
}

export interface HomeworkRefBlock extends BaseBlock {
  type: "HOMEWORK_REF";
  homeworkId: string;
}

export interface DividerBlock extends BaseBlock {
  type: "DIVIDER";
}

export type LessonBlock =
  | MarkdownBlock
  | HeadingBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | CodeBlock
  | CalloutBlock
  | QuizBlock
  | HomeworkRefBlock
  | DividerBlock;

/** Полный документ контента урока, сериализуется в поле Lesson.content (JSON). */
export interface LessonDocument {
  version: 1;
  blocks: LessonBlock[];
}

export const emptyLessonDocument = (): LessonDocument => ({
  version: 1,
  blocks: [],
});
