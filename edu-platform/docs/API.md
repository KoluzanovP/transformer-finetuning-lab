# REST API

Базовый префикс — `/api`. Авторизация: заголовок `Authorization: Bearer <access>`.
Роли в скобках — кому доступен маршрут (пусто = любому авторизованному).

## Auth
| Метод | Путь | Тело | Доступ |
|-------|------|------|--------|
| POST | `/auth/register` | `{email,password,firstName,lastName,role?}` | public |
| POST | `/auth/login` | `{email,password}` | public |
| POST | `/auth/refresh` | `{refreshToken}` | public |
| POST | `/auth/logout` | `{refreshToken}` | auth |
| GET | `/auth/me` | — | auth |

## Users (AUTHOR, кроме /me/children)
| Метод | Путь | Тело |
|-------|------|------|
| GET | `/users?role=` | — |
| POST | `/users` | `{email,password?,firstName,lastName,roles[]}` |
| PUT | `/users/:id/roles` | `{roles[]}` |
| POST | `/users/link-parent` | `{parentId,studentId}` |
| GET | `/users/me/children` | — (PARENT) |

## Courses
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/courses?status=&mine=` | auth |
| GET | `/courses/:id` | auth |
| POST | `/courses` | AUTHOR |
| PATCH | `/courses/:id` | AUTHOR |
| PATCH | `/courses/:id/status` | AUTHOR |
| DELETE | `/courses/:id` | AUTHOR |

## Lessons
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/courses/:courseId/lessons` | AUTHOR |
| PATCH | `/courses/:courseId/lessons/reorder` | AUTHOR |
| GET | `/lessons/:id` | auth |
| PATCH | `/lessons/:id` | AUTHOR |
| DELETE | `/lessons/:id` | AUTHOR |
| POST | `/lessons/:id/progress` | STUDENT |

## Homework
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/courses/:courseId/homework` | AUTHOR |
| GET | `/courses/:courseId/homework` | auth |
| GET | `/homework/:id` | auth |
| PATCH `/homework/:id`, DELETE `/homework/:id` | | AUTHOR |

## Enrollments
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/enrollments` | AUTHOR |
| PUT | `/enrollments/:id/teacher` | AUTHOR |
| GET | `/enrollments/mine` | STUDENT |
| GET | `/enrollments/teaching` | TEACHER |
| GET | `/enrollments/course/:courseId` | AUTHOR, TEACHER |

## Submissions
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/submissions/homework/:homeworkId/draft` | STUDENT |
| POST | `/submissions/homework/:homeworkId/submit` | STUDENT |
| GET | `/submissions/mine` | STUDENT |
| GET | `/submissions/queue` | TEACHER |
| GET | `/submissions/:id` | STUDENT, TEACHER, AUTHOR |
| PUT | `/submissions/:id/review` `{status:GRADED\|RETURNED,score?}` | TEACHER |

## Comments / Chat
| Метод | Путь |
|-------|------|
| POST `/comments` `{body,lessonId?\|homeworkId?\|submissionId?,parentId?}` |
| GET `/comments?lessonId=&homeworkId=&submissionId=` · DELETE `/comments/:id` |
| POST `/chat/threads` · GET `/chat/threads` |
| GET `/chat/threads/:id/messages` · POST `/chat/threads/:id/messages` · POST `/chat/threads/:id/read` |

## Scheduling
| Метод | Путь | Доступ |
|-------|------|--------|
| PUT | `/staff/:staffId/availability` | AUTHOR |
| GET | `/staff/:staffId/availability` | AUTHOR, TEACHER, MENTOR |
| POST | `/calls` `{startsAt,durationMinutes?,courseId?,teacherId?}` | AUTHOR, TEACHER |
| GET | `/calls/teaching` | TEACHER, MENTOR |
| GET | `/calls/mine` | STUDENT |
| GET | `/calls/available?teacherId=` | STUDENT, AUTHOR |
| POST | `/calls/:id/book` `{courseId}` | STUDENT |
| POST | `/calls/:id/cancel` | STUDENT, TEACHER, AUTHOR |
| POST | `/calls/:id/complete` | TEACHER |

## Tickets
| Метод | Путь | Доступ |
|-------|------|--------|
| POST `/tickets` `{subject,body}` | | auth |
| GET `/tickets/mine` | | auth |
| GET `/tickets/queue` | | MENTOR, AUTHOR |
| GET `/tickets/:id` | | участник/MENTOR/AUTHOR |
| POST `/tickets/:id/messages` `{body}` | | участник/MENTOR/AUTHOR |
| PUT `/tickets/:id/status` `{status}` | | MENTOR, AUTHOR |

## Media
| Метод | Путь | Доступ |
|-------|------|--------|
| POST `/media` · POST `/media/upload-target` | | AUTHOR, TEACHER |
| GET `/media/mine` · DELETE `/media/:id` | | auth |

## Analytics
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/analytics/overview` | AUTHOR |
| GET | `/analytics/teacher/:id` | AUTHOR, TEACHER |
| GET | `/analytics/me/teacher` | TEACHER |
| GET | `/analytics/student/:id` | AUTHOR, TEACHER |
| GET | `/analytics/me/student` | STUDENT |
| GET | `/analytics/child/:studentId` | PARENT |
| GET | `/analytics/audit?page=&pageSize=&actorId=&action=` | AUTHOR |
