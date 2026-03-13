import { expect, test } from "@playwright/test";

test("daily smoke: homepage -> category -> detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "CoreNews" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "全站热点 Top 40" })).toBeVisible();

  await page.locator("header").getByRole("link", { name: "AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: /AI 热点情报/i })).toBeVisible();

  await page.locator("main article h3 a").first().click();
  await expect(page).toHaveURL(/\/news\//);

  const sourceLink = page.getByRole("link", { name: /查看原始报道/i }).first();
  if ((await sourceLink.count()) > 0) {
    await expect(sourceLink).toHaveAttribute("target", "_blank");
  }
});
