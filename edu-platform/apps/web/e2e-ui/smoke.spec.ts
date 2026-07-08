import { test, expect } from "@playwright/test";

test.describe("EduPlatform UI smoke", () => {
  test("неавторизованного редиректит на /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "EduPlatform" })).toBeVisible();
  });

  test("вход автора и навигация по кабинету", async ({ page }) => {
    await page.goto("/login");
    // Поля предзаполнены демо-данными (author@edu.dev / password123).
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page).toHaveURL(/\/author/);
    // В сайдбаре доступны разделы автора.
    await expect(page.getByRole("link", { name: "Пользователи" })).toBeVisible();

    await page.getByRole("link", { name: "Курсы" }).click();
    await expect(page).toHaveURL(/\/author\/courses/);
    await expect(page.getByText("Основы Python").first()).toBeVisible();
  });

  test("вход ученика и просмотр своих курсов", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type=email]").fill("student@edu.dev");
    await page.locator("input[type=password]").fill("password123");
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByText("Математика").first()).toBeVisible();
  });

  test("урок математики: формулы (KaTeX) и SVG-схемы отрисованы", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type=email]").fill("student@edu.dev");
    await page.locator("input[type=password]").fill("password123");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/student/);

    await page.getByText("Математика: с нуля до ЕГЭ").first().click();
    await expect(page).toHaveURL(/\/student\/courses\//);
    await page.getByRole("link", { name: /1\.1/ }).first().click();
    await expect(page).toHaveURL(/\/student\/lessons\//);

    // Формула KaTeX и векторная схема должны отрендериться.
    await expect(page.locator(".katex").first()).toBeVisible();
    await expect(page.locator("main svg").first()).toBeVisible();
  });

  test("авто-проверяемый тест ЕГЭ выставляет балл", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type=email]").fill("student@edu.dev");
    await page.locator("input[type=password]").fill("password123");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/student/);

    await page.getByText("ЕГЭ по математике: пробные варианты").first().click();
    await expect(page).toHaveURL(/\/student\/courses\//);
    await page.getByRole("link", { name: /Пройти тест/ }).first().click();
    await expect(page).toHaveURL(/\/student\/homework\//);

    // Отвечаем на первый вопрос и проверяем.
    await page.locator(".card button").first().click();
    await page.getByRole("button", { name: /Проверить/ }).click();
    await expect(page.getByText(/%/).first()).toBeVisible();
  });
});
