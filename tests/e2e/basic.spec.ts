import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/CreditFlow/);
  });

  test('can load the login page', async ({ page }) => {
    await page.goto('/login');

    // Wait for the page content to load based on actual page.tsx structure
    await page.waitForSelector('text="Welcome back"');

    // Verify presence of form fields
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    const submitButton = page.locator('button', { hasText: 'Sign In' });
    await expect(submitButton).toBeVisible();
  });
});
