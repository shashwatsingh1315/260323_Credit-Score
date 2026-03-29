import { test, expect } from '@playwright/test';

test('Test Case Builder Scenarios', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="email"]', 'admin@tejas.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3000/');

  await page.goto('http://localhost:3000/cases/new');
  await page.waitForSelector('text=Case Scenario');

  // Try scenario 1
  await page.selectOption('select', { value: 'customer_name_customer_pays' });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Continue")');

  const text1 = await page.locator('text=Stage 1 Intake Questions').isVisible();
  console.log("Scenario 1 - Intake Questions visible:", text1);
  const err1 = await page.locator('text=No specific intake questions required').isVisible();
  console.log("Scenario 1 - No questions text visible:", err1);
});
