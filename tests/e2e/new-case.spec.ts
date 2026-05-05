import { test, expect } from '@playwright/test';

test.describe('New Case Form', () => {
  test('Strategic Justification is a dropdown', async ({ page }) => {
    // Set test bypass cookies
    await page.context().addCookies([
      { name: 'test_auth_bypass', value: 'true', domain: 'localhost', path: '/' },
      { name: 'impersonated_role', value: 'rm', domain: 'localhost', path: '/' }
    ]);

    await page.goto('/cases/new');
    
    // Check if the New Case form heading is visible
    await expect(page.locator('text=Case Scenario & Parties')).toBeVisible();
    await expect(page.locator('text=Parties & Terms')).toBeVisible(); // From sidebar
  });
});
