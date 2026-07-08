import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("Образовательная платформа (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<typeof request>;

  // Токены участников
  const t: Record<string, string> = {};
  const id: Record<string, string> = {};
  const ctx: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.truncateAll();
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  // Публичная регистрация (разрешена только для STUDENT/PARENT).
  const register = async (email: string, role: string) => {
    const res = await http()
      .post("/api/auth/register")
      .send({ email, password: "password123", firstName: role, lastName: "Тест", role })
      .expect(201);
    return res.body;
  };

  const login = async (email: string) => {
    const res = await http()
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(201);
    return res.body;
  };

  it("публичная регистрация не позволяет стать автором (эскалация)", async () => {
    // Роль AUTHOR запрещена валидацией.
    await http()
      .post("/api/auth/register")
      .send({ email: "hacker@test.dev", password: "password123", firstName: "Ha", lastName: "Ck", role: "AUTHOR" })
      .expect(400);
    // Даже без указания роли — публично выдаётся только STUDENT.
    const anon = await register("anon@test.dev", "STUDENT");
    expect(anon.user.roles).toEqual(["STUDENT"]);
  });

  it("создаёт пользователей всех ролей (bootstrap автора + инвайты)", async () => {
    // Автор создаётся напрямую (bootstrap платформы), а не публичной регистрацией.
    const authorUser = await prisma.user.create({
      data: {
        email: "author@test.dev",
        passwordHash: await bcrypt.hash("password123", 12),
        firstName: "Автор",
        lastName: "Тест",
        roles: ["AUTHOR"],
      },
    });
    id.author = authorUser.id;
    const author = await login("author@test.dev");
    t.author = author.tokens.accessToken;

    // Учителя и наставника заводит автор через POST /users.
    const teacher = await http()
      .post("/api/users")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ email: "teacher@test.dev", password: "password123", firstName: "Учитель", lastName: "Тест", roles: ["TEACHER"] })
      .expect(201);
    id.teacher = teacher.body.id;
    t.teacher = (await login("teacher@test.dev")).tokens.accessToken;

    const mentor = await http()
      .post("/api/users")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ email: "mentor@test.dev", password: "password123", firstName: "Наставник", lastName: "Тест", roles: ["MENTOR"] })
      .expect(201);
    id.mentor = mentor.body.id;
    t.mentor = (await login("mentor@test.dev")).tokens.accessToken;

    // Ученик и родитель — публичная регистрация.
    const studentR = await register("student@test.dev", "STUDENT");
    const parent = await register("parent@test.dev", "PARENT");
    t.student = studentR.tokens.accessToken;
    t.parent = parent.tokens.accessToken;
    id.student = studentR.user.id;
    id.parent = parent.user.id;

    expect(author.user.roles).toContain("AUTHOR");
    expect(author.tokens.refreshToken).toBeDefined();
  });

  it("логинит по email/паролю и отдаёт /me", async () => {
    const login = await http()
      .post("/api/auth/login")
      .send({ email: "author@test.dev", password: "password123" })
      .expect(201);
    const me = await http()
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe("author@test.dev");
  });

  it("RBAC: ученик не может создать курс (403)", async () => {
    await http()
      .post("/api/courses")
      .set("Authorization", `Bearer ${t.student}`)
      .send({ title: "Взлом" })
      .expect(403);
  });

  it("автор создаёт курс, урок и домашку", async () => {
    const course = await http()
      .post("/api/courses")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ title: "Основы Python", description: "Курс", callsPerStudent: 4 })
      .expect(201);
    ctx.course = course.body.id;

    const lesson = await http()
      .post(`/api/courses/${ctx.course}/lessons`)
      .set("Authorization", `Bearer ${t.author}`)
      .send({
        title: "Переменные",
        content: { version: 1, blocks: [{ id: "b1", type: "MARKDOWN", markdown: "Привет" }] },
      })
      .expect(201);
    ctx.lesson = lesson.body.id;

    const hw = await http()
      .post(`/api/courses/${ctx.course}/homework`)
      .set("Authorization", `Bearer ${t.author}`)
      .send({ title: "ДЗ 1", description: "Напишите hello world", lessonId: ctx.lesson, maxScore: 100 })
      .expect(201);
    ctx.homework = hw.body.id;

    await http()
      .patch(`/api/courses/${ctx.course}/status`)
      .set("Authorization", `Bearer ${t.author}`)
      .send({ status: "PUBLISHED" })
      .expect(200);
  });

  it("автор зачисляет ученика и назначает учителя", async () => {
    const enr = await http()
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ courseId: ctx.course, studentId: id.student, teacherId: id.teacher })
      .expect(201);
    expect(enr.body.callsTotal).toBe(4);

    await http()
      .post("/api/users/link-parent")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ parentId: id.parent, studentId: id.student })
      .expect(201);
  });

  it("ученик отправляет домашку, учитель оценивает", async () => {
    await http()
      .post(`/api/submissions/homework/${ctx.homework}/submit`)
      .set("Authorization", `Bearer ${t.student}`)
      .send({ content: { version: 1, blocks: [{ id: "s1", type: "CODE", language: "python", code: "print('hi')" }] } })
      .expect(201);

    const queue = await http()
      .get("/api/submissions/queue")
      .set("Authorization", `Bearer ${t.teacher}`)
      .expect(200);
    expect(queue.body.length).toBe(1);
    const submissionId = queue.body[0].id;

    const graded = await http()
      .put(`/api/submissions/${submissionId}/review`)
      .set("Authorization", `Bearer ${t.teacher}`)
      .send({ status: "GRADED", score: 95 })
      .expect(200);
    expect(graded.body.status).toBe("GRADED");
    expect(graded.body.score).toBe(95);
  });

  it("ученик проходит урок (прогресс)", async () => {
    await http()
      .post(`/api/lessons/${ctx.lesson}/progress`)
      .set("Authorization", `Bearer ${t.student}`)
      .send({ status: "COMPLETED" })
      .expect(201);
  });

  it("созвоны: автор задаёт доступность, учитель создаёт слот, ученик бронирует", async () => {
    await http()
      .put(`/api/staff/${id.teacher}/availability`)
      .set("Authorization", `Bearer ${t.author}`)
      .send({ rules: [{ weekday: 1, startMinute: 600, endMinute: 720 }] })
      .expect(200);

    const slot = await http()
      .post("/api/calls")
      .set("Authorization", `Bearer ${t.teacher}`)
      .send({ startsAt: "2030-01-01T10:00:00.000Z", durationMinutes: 30 })
      .expect(201);
    ctx.call = slot.body.id;

    const booked = await http()
      .post(`/api/calls/${ctx.call}/book`)
      .set("Authorization", `Bearer ${t.student}`)
      .send({ courseId: ctx.course })
      .expect(201);
    expect(booked.body.status).toBe("BOOKED");
    expect(booked.body.joinUrl).toContain("meet");
  });

  it("наставник: ученик создаёт тикет, наставник отвечает", async () => {
    const ticket = await http()
      .post("/api/tickets")
      .set("Authorization", `Bearer ${t.student}`)
      .send({ subject: "Не открывается урок", body: "Помогите" })
      .expect(201);
    ctx.ticket = ticket.body.id;

    await http()
      .post(`/api/tickets/${ctx.ticket}/messages`)
      .set("Authorization", `Bearer ${t.mentor}`)
      .send({ body: "Обновите страницу" })
      .expect(201);

    const queue = await http()
      .get("/api/tickets/queue")
      .set("Authorization", `Bearer ${t.mentor}`)
      .expect(200);
    expect(queue.body.length).toBeGreaterThanOrEqual(1);
  });

  it("комментарии к уроку (Q&A)", async () => {
    await http()
      .post("/api/comments")
      .set("Authorization", `Bearer ${t.student}`)
      .send({ body: "Вопрос по уроку?", lessonId: ctx.lesson })
      .expect(201);

    const list = await http()
      .get(`/api/comments?lessonId=${ctx.lesson}`)
      .set("Authorization", `Bearer ${t.teacher}`)
      .expect(200);
    expect(list.body.length).toBe(1);
  });

  it("родитель видит прогресс ребёнка", async () => {
    const progress = await http()
      .get(`/api/analytics/child/${id.student}`)
      .set("Authorization", `Bearer ${t.parent}`)
      .expect(200);
    expect(progress.body.courses[0].lessonCompletionPct).toBe(100);
    expect(progress.body.courses[0].averageScore).toBe(95);
    expect(progress.body.courses[0].callsUsed).toBe(1);
  });

  it("автор видит сводку и лог действий", async () => {
    const overview = await http()
      .get("/api/analytics/overview")
      .set("Authorization", `Bearer ${t.author}`)
      .expect(200);
    expect(overview.body.usersByRole.AUTHOR).toBeGreaterThanOrEqual(1);
    expect(overview.body.courses).toBeGreaterThanOrEqual(1);

    const audit = await http()
      .get("/api/analytics/audit")
      .set("Authorization", `Bearer ${t.author}`)
      .expect(200);
    expect(audit.body.total).toBeGreaterThan(0);
  });

  it("уведомления приходят учителю и ученику", async () => {
    const teacherNotifs = await http()
      .get("/api/notifications")
      .set("Authorization", `Bearer ${t.teacher}`)
      .expect(200);
    expect(teacherNotifs.body.some((n: { type: string }) => n.type === "submission.submitted")).toBe(true);

    const studentNotifs = await http()
      .get("/api/notifications")
      .set("Authorization", `Bearer ${t.student}`)
      .expect(200);
    expect(studentNotifs.body.some((n: { type: string }) => n.type === "submission.graded")).toBe(true);

    const count = await http()
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${t.student}`)
      .expect(200);
    expect(count.body.count).toBeGreaterThan(0);
  });

  it("OAuth (mock) создаёт пользователя и выдаёт токены", async () => {
    const res = await http()
      .post("/api/auth/oauth/mock")
      .send({ provider: "google", providerId: "g-123", email: "oauth-user@test.dev", firstName: "Гость", lastName: "Гуглов" })
      .expect(201);
    expect(res.body.user.email).toBe("oauth-user@test.dev");
    expect(res.body.user.roles).toContain("STUDENT");
    expect(res.body.tokens.accessToken).toBeDefined();

    // Повторный вход тем же провайдером — тот же пользователь.
    const again = await http()
      .post("/api/auth/oauth/mock")
      .send({ provider: "google", providerId: "g-123", email: "oauth-user@test.dev" })
      .expect(201);
    expect(again.body.user.id).toBe(res.body.user.id);
  });

  it("генерация слотов созвонов из расписания", async () => {
    const res = await http()
      .post(`/api/staff/${id.teacher}/generate-slots`)
      .set("Authorization", `Bearer ${t.author}`)
      .send({ weeks: 2, durationMinutes: 30 })
      .expect(201);
    expect(res.body.created).toBeGreaterThanOrEqual(1);
  });

  it("медиа: upload-target (LOCAL) и реальная загрузка файла", async () => {
    const target = await http()
      .post("/api/media/upload-target")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ filename: "cover.png", kind: "IMAGE" })
      .expect(201);
    expect(target.body.driver).toBe("LOCAL");
    expect(target.body.uploadUrl).toBe("/api/media/upload");

    const uploaded = await http()
      .post("/api/media/upload?kind=IMAGE")
      .set("Authorization", `Bearer ${t.author}`)
      .attach("file", Buffer.from("fake-png-bytes"), "cover.png")
      .expect(201);
    expect(uploaded.body.url).toContain("/uploads/");
    expect(uploaded.body.kind).toBe("IMAGE");
  });

  it("отвергает неизвестные поля в теле запроса (400)", async () => {
    await http()
      .post("/api/courses")
      .set("Authorization", `Bearer ${t.author}`)
      .send({ title: "Курс с лишним полем", evilField: true })
      .expect(400);
  });

  it("refresh: ротация и запрет повторного использования токена", async () => {
    const reg = await http()
      .post("/api/auth/register")
      .send({ email: "refresh@test.dev", password: "password123", firstName: "Ре", lastName: "Фреш", role: "STUDENT" })
      .expect(201);
    const oldRefresh = reg.body.tokens.refreshToken;

    const rotated = await http()
      .post("/api/auth/refresh")
      .send({ refreshToken: oldRefresh })
      .expect(201);
    expect(rotated.body.tokens.refreshToken).not.toBe(oldRefresh);

    // Повторное использование старого (отозванного) токена запрещено.
    await http().post("/api/auth/refresh").send({ refreshToken: oldRefresh }).expect(401);
    // Детект кражи сбрасывает и выданный новый токен.
    await http().post("/api/auth/refresh").send({ refreshToken: rotated.body.tokens.refreshToken }).expect(401);
  });

  it("слабый пароль отклоняется при регистрации (400)", async () => {
    await http()
      .post("/api/auth/register")
      .send({ email: "weak@test.dev", password: "onlyletters", firstName: "W", lastName: "K", role: "STUDENT" })
      .expect(400);
  });

  it("авто-проверка теста выставляет балл", async () => {
    const hw = await http()
      .post(`/api/courses/${ctx.course}/homework`)
      .set("Authorization", `Bearer ${t.author}`)
      .send({
        title: "Тест по арифметике",
        content: {
          version: 1,
          blocks: [
            { id: "tq1", type: "QUIZ", question: "2+2?", multiple: false, options: [{ id: "a", text: "3", correct: false }, { id: "b", text: "4", correct: true }] },
            { id: "tq2", type: "QUIZ", question: "3+3?", multiple: false, options: [{ id: "c", text: "6", correct: true }, { id: "d", text: "7", correct: false }] },
          ],
        },
      })
      .expect(201);

    const full = await http()
      .post(`/api/submissions/homework/${hw.body.id}/autocheck`)
      .set("Authorization", `Bearer ${t.student}`)
      .send({ answers: { tq1: ["b"], tq2: ["c"] } })
      .expect(201);
    expect(full.body.scorePercent).toBe(100);
    expect(full.body.correctCount).toBe(2);

    const half = await http()
      .post(`/api/submissions/homework/${hw.body.id}/autocheck`)
      .set("Authorization", `Bearer ${t.student}`)
      .send({ answers: { tq1: ["b"], tq2: ["d"] } })
      .expect(201);
    expect(half.body.scorePercent).toBe(50);
  });

  it("родитель не может открыть сводку автора (403)", async () => {
    await http()
      .get("/api/analytics/overview")
      .set("Authorization", `Bearer ${t.parent}`)
      .expect(403);
  });
});
