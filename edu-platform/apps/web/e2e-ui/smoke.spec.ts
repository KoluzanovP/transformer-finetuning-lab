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
    await expect(page.getByText("Основы Python").first()).toBeVisible();
  });
});
