import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

interface E2EMailEntry {
  to: string;
  subject: string;
  link: string;
}

function getLatestLinkForEmail(email: string): string {
  const path = "./data/e2e-mail.log";
  if (!existsSync(path)) {
    throw new Error("Mail log not found — is E2E_TEST_MODE set for the dev server?");
  }
  const entries = readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as E2EMailEntry);

  const match = entries.filter((entry) => entry.to === email).at(-1);
  if (!match) {
    throw new Error(`No email logged for ${email}`);
  }
  return match.link;
}

test("register, verify email, log in, manage todos, and log out", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "password123";

  await page.goto("/register");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/Password/).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/verify your address/i)).toBeVisible();

  const verifyLink = new URL(getLatestLinkForEmail(email));
  await page.goto(verifyLink.pathname + verifyLink.search);
  await page.getByRole("button", { name: /verify my email/i }).click();
  await expect(page.getByText(/email is verified/i)).toBeVisible();

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Your Todos")).toBeVisible();

  await page.getByPlaceholder("What needs doing?").fill("Buy milk");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Buy milk")).toBeVisible();

  await page.getByLabel("Mark as done").click();
  await expect(page.getByText("Buy milk")).toHaveClass(/line-through/);

  await page.getByLabel('Delete "Buy milk"').click();
  await expect(page.getByText("Buy milk")).toHaveCount(0);

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("a logged-out visitor is redirected away from the todo list", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
