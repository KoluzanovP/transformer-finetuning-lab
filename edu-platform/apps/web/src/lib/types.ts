import type { LessonDocument, Role } from "@edu/shared";

export interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  authorId: string;
  callsPerStudent: number;
  callDurationMinutes: number;
  createdAt: string;
  lessons?: Lesson[];
  homeworks?: Homework[];
  _count?: { lessons?: number; enrollments?: number };
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: LessonDocument;
  order: number;
  estimatedMinutes?: number | null;
  isPublished: boolean;
  homeworks?: Homework[];
}

export interface Homework {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  description?: string | null;
  maxScore: number;
  order: number;
  content?: LessonDocument;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  teacherId?: string | null;
  callsTotal: number;
  callsUsed: number;
  course?: Course;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  student?: { id: string; firstName: string; lastName: string; email: string };
}

export interface Submission {
  id: string;
  homeworkId: string;
  studentId: string;
  content: LessonDocument;
  status: "DRAFT" | "SUBMITTED" | "RETURNED" | "GRADED";
  score?: number | null;
  homework?: { id: string; title: string; maxScore: number; courseId: string };
  student?: { id: string; firstName: string; lastName: string };
}

export interface Call {
  id: string;
  teacherId: string;
  studentId?: string | null;
  courseId?: string | null;
  startsAt: string;
  durationMinutes: number;
  status: "AVAILABLE" | "BOOKED" | "COMPLETED" | "CANCELLED";
  joinUrl?: string | null;
  teacher?: { id: string; firstName: string; lastName: string };
  course?: { id: string; title: string } | null;
}

export interface Ticket {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdById: string;
  mentorId?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
  _count?: { messages: number };
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender?: { id: string; firstName: string; lastName: string };
}

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  createdAt: string;
}

export interface StudentProgress {
  studentId: string;
  courses: {
    courseId: string;
    courseTitle: string;
    teacher?: { id: string; firstName: string; lastName: string } | null;
    totalLessons: number;
    completedLessons: number;
    lessonCompletionPct: number;
    totalHomework: number;
    gradedSubmissions: number;
    averageScore: number | null;
    callsUsed: number;
    callsTotal: number;
  }[];
}
