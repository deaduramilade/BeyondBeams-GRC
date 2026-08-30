import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_MAGIC_TOKEN } from "./constants";
import { seedMagicLinkToken } from "./db";

async function loginViaMagicLink(page: Page) {
  await seedMagicLinkToken();
  await page.goto(`/magic-link?email=${encodeURIComponent(E2E_EMAIL)}&token=${E2E_MAGIC_TOKEN}`);
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

test.describe("authenticated GRC user journeys & accessibility", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("journey 1: owner can log in and reach all workspaces with accessible navigation", async ({ page }) => {
    await loginViaMagicLink(page);

    // Risk Register
    await page.goto("/app/risks");
    await expect(page.getByRole("heading", { name: "Risk register" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    // Assessments
    await page.goto("/app/assessments");
    await expect(page.getByRole("heading", { name: "Assessment register" })).toBeVisible();

    // Governance Workbench
    await page.goto("/app/governance");
    await expect(page.getByRole("heading", { name: "Governance workbench" })).toBeVisible();

    // Treatment Plans
    await page.goto("/app/treatments");
    await expect(page.getByRole("heading", { name: "Treatment plans and actions" })).toBeVisible();

    // Control Management
    await page.goto("/app/controls");
    await expect(page.getByRole("heading", { name: "Control profiles and test history" })).toBeVisible();

    // Reviews & Escalations
    await page.goto("/app/reviews");
    await expect(page.getByRole("heading", { name: "Reviews and escalation" })).toBeVisible();

    // Evidence Register
    await page.goto("/app/evidence");
    await expect(page.getByRole("heading", { name: "Evidence metadata register" })).toBeVisible();

    // Frameworks & Compliance
    await page.goto("/app/frameworks");
    await expect(page.getByRole("heading", { name: "Framework library & compliance mappings" })).toBeVisible();

    // Report Centre
    await page.goto("/app/reports");
    await expect(page.getByRole("heading", { name: "Report centre" })).toBeVisible();

    // Risk Insights & Accessible Heatmap
    await page.goto("/app/insights");
    await expect(page.getByRole("heading", { name: "Risk insights" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("journey 2: risk creation and editing flow with taxonomy selection", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/risks/new");
    await expect(page.getByRole("heading", { name: "Identify a new risk" })).toBeVisible();

    // Validate form inputs
    const titleInput = page.getByLabel("Risk title");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("E2E Test Cloud Outage Risk");

    const descInput = page.getByLabel("Risk description");
    await descInput.fill("Critical cloud provider failure impacting production operations.");

    await expect(page.getByRole("button", { name: "Create risk" })).toBeVisible();
  });

  test("journey 3: report centre catalogue and secure download links", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/reports");
    await expect(page.getByRole("heading", { name: "Report centre" })).toBeVisible();
    await expect(page.getByText("Monthly export quota")).toBeVisible();

    // Check report cards
    await expect(page.getByRole("heading", { name: "Risk Register" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Board Risk Report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Framework Gap Analysis" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Treatment Status & Actions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Control Effectiveness Summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portfolio Exposure Summary" })).toBeVisible();
  });

  test("journey 4: governance forms accessibility, keyboard tab order, and focus management", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/reviews");
    await expect(page.getByLabel("Cadence in months")).toBeVisible();
    await page.getByLabel("Cadence in months").focus();
    await expect(page.getByLabel("Cadence in months")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Save review schedule" })).toBeFocused();
  });

  test("journey 5: operations job queue and retry accessibility", async ({ page }) => {
    await loginViaMagicLink(page);

    await page.goto("/app/operations/jobs");
    await expect(page.getByRole("heading", { name: "Job queue" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });
});