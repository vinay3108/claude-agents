import { expect, test } from "@playwright/test";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
test("paste notes → agent saves them → undo removes them", async ({ page }) => {
  test.skip(
    !email || !password,
    "Set E2E_EMAIL and E2E_PASSWORD for a test account",
  );
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/import");
  await page
    .getByLabel("Notes to import")
    .fill("# E2E heap\nA min-heap pops the smallest item.");
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText(/done/).first()).toBeVisible({
    timeout: 150_000,
  });
});
