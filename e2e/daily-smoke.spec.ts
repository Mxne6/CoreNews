import { expect, test } from "@playwright/test";

test("daily smoke: homepage -> category -> detail", async ({ page, request }) => {
  await request.get("/api/dev/seed");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CoreNews" })).toBeVisible();

  await page.getByRole("link", { name: "查看更多" }).first().click();
  await expect(page.getByRole("heading", { name: /ai 热点/i })).toBeVisible();

  await page.getByRole("link", { name: "OpenAI releases GPT-5" }).first().click();
  await expect(page.getByRole("heading", { name: "OpenAI releases GPT-5" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看原文 1" })).toHaveAttribute(
    "target",
    "_blank",
  );
});
