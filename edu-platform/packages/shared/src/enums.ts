/** Статус публикации курса. */
export const CourseStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

/** Статус сдачи домашней работы. */
export const SubmissionStatus = {
  /** Черновик ученика, ещё не отправлен. */
  DRAFT: "DRAFT",
  /** Отправлено учителю, ждёт проверки. */
  SUBMITTED: "SUBMITTED",
  /** Возвращено на доработку. */
  RETURNED: "RETURNED",
  /** Проверено и принято (с оценкой). */
  GRADED: "GRADED",
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

/** Статус созвона. */
export const CallStatus = {
  /** Слот свободен, ученик может забронировать. */
  AVAILABLE: "AVAILABLE",
  /** Забронирован учеником. */
  BOOKED: "BOOKED",
  /** Проведён. */
  COMPLETED: "COMPLETED",
  /** Отменён. */
  CANCELLED: "CANCELLED",
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

/** Статус тикета в саппорт наставнику. */
export const TicketStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

/** Прогресс прохождения урока учеником. */
export const LessonProgressStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;
export type LessonProgressStatus =
  (typeof LessonProgressStatus)[keyof typeof LessonProgressStatus];
