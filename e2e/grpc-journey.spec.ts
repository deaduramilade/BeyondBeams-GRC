import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_MAGIC_TOKEN } from "./constants";
import { seedMagicLinkToken } from "./db";

async function loginViaMagicLink(page: Page) {
  await seedMagicLinkToken();
  await page.goto(`/magic-link?email=${encodeURIComponent(E2E_EMAIL)}&token=${E2E_MAGIC_TOKEN}`);
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

test.describe("authenticated GRC journey", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("owner can log in, browse the register, and reach every governed workspace", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/risks");
    await expect(page.getByRole("heading", { name: "Risk register" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    await page.goto("/app/assessments");
    await expect(page.getByRole("heading", { name: "Assessment register" })).toBeVisible();
    await page.goto("/app/governance");
    await expect(page.getByRole("heading", { name: "Governance workbench" })).toBeVisible();
    await page.goto("/app/treatments");
    await expect(page.getByRole("heading", { name: "Treatment plans and actions" })).toBeVisible();
    await page.goto("/app/controls");
    await expect(page.getByRole("heading", { name: "Control profiles and test history" })).toBeVisible();
    await page.goto("/app/reviews");
    await expect(page.getByRole("heading", { name: "Reviews and escalation" })).toBeVisible();
    await page.goto("/app/evidence");
    await expect(page.getByRole("heading", { name: "Evidence metadata register" })).toBeVisible();
    await page.goto("/app/audit");
    await expect(page.getByRole("heading", { name: /Audit/i })).toBeVisible();
    await page.goto("/app/insights");
    await expect(page.getByRole("heading", { name: /Insights/i })).toBeVisible();
  });

  test("governance forms are present and labelled for accessibility", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/governance");
    await expect(page.getByRole("button", { name: "Assessments" })).toBeVisible();
    await page.getByRole("button", { name: "Assessments" }).click();
    await expect(page.getByRole("button", { name: /Save/ }).first()).toBeVisible();

    await page.goto("/app/reviews");
    await expect(page.getByRole("button", { name: "Record review outcome" })).toBeVisible();
    await expect(page.getByLabel("Cadence in months")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save review schedule" })).toBeVisible();

    // Verify keyboard navigation and focus
    await page.getByLabel("Cadence in months").focus();
    await expect(page.getByLabel("Cadence in months")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Save review schedule" })).toBeFocused();
  });

  test("job queue and scoring policy pages are reachable for owners", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/operations/jobs");
    await expect(page.getByRole("heading", { name: "Job queue" })).toBeVisible();
    await page.goto("/app/governance/scoring-policy");
    await expect(page.getByRole("heading", { name: "Scoring policy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish policy" })).toBeVisible();
  });
});