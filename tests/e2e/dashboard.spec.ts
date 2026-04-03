import { test, expect } from '@playwright/test';

test.describe('Dashboard Role Visibility', () => {
  test('RM sees all widgets', async ({ page }) => {
    // Assuming impersonation role can be set or default is RM in test env
    // For the sake of this test, we check if Portfolio Overview is visible
    // We would need to set the role to RM. If we can't easily do it via UI, we might just test the UI elements are present.
    // For now, let's write a simple check that passes if the user is RM.
    await page.goto('/');
    
    // This assumes the default test user is an RM. 
    // If not, this test will fail and need to be adapted to your auth testing strategy.
    await expect(page.locator('text=Portfolio Overview')).toBeVisible();
    await expect(page.locator('text=Efficiency Funnel')).toBeVisible();
  });
});
