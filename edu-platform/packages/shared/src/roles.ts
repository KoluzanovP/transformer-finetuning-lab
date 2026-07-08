/**
 * Роли платформы. Держим строковые литералы совместимыми с Prisma enum `Role`.
 */
export const Role = {
  /** Автор платформы — составляет курсы, видит всю статистику и логи, настраивает расписание. */
  AUTHOR: "AUTHOR",
  /** Учитель — проверяет домашки, отвечает на вопросы, ведёт созвоны. */
  TEACHER: "TEACHER",
  /** Наставник — отвечает на вопросы по работе платформы (саппорт). */
  MENTOR: "MENTOR",
  /** Ученик — проходит курсы, сдаёт домашки, ходит на созвоны. */
  STUDENT: "STUDENT",
  /** Родитель — отслеживает прогресс своего ученика. */
  PARENT: "PARENT",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

/** Роли преподавательского состава, для которых автор настраивает расписание созвонов. */
export const STAFF_ROLES: Role[] = [Role.TEACHER, Role.MENTOR];

/**
 * Роли, доступные для самостоятельной публичной регистрации.
 * Учителей/наставников/авторов заводит автор платформы (защита от эскалации привилегий).
 */
export const SELF_SIGNUP_ROLES: Role[] = [Role.STUDENT, Role.PARENT];

export const ROLE_LABELS_RU: Record<Role, string> = {
  AUTHOR: "Автор платформы",
  TEACHER: "Учитель",
  MENTOR: "Наставник",
  STUDENT: "Ученик",
  PARENT: "Родитель",
};

/** Домашняя страница кабинета по роли. */
export const ROLE_HOME: Record<Role, string> = {
  AUTHOR: "/author",
  TEACHER: "/teacher",
  MENTOR: "/mentor",
  STUDENT: "/student",
  PARENT: "/parent",
};
