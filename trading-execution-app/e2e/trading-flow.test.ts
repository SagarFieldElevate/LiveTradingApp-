import { test, expect } from '@playwright/test';

test.describe('Trading Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
  });

  test('complete trading flow from strategy sync to position close', async ({ page }) => {
    // 1. Sync strategies
    await page.click('text=Sync from Pinecone');
    await expect(page.locator('text=Sync Started')).toBeVisible();
    
    // 2. Wait for new strategy
    await expect(page.locator('text=Pending Approval')).toBeVisible({ timeout: 10000 });
    
    // 3. Review strategy
    await page.click('text=Review');
    await expect(page.locator('text=Strategy Approval Required')).toBeVisible();
    
    // 4. Set stop loss
    await page.fill('input[id="stop-loss"]', '2');
    await page.fill('input[id="take-profit"]', '5');
    
    // 5. Approve strategy
    await page.click('text=Approve & Activate');
    await expect(page.locator('text=Strategy Approved')).toBeVisible();
    
    // 6. Monitor for position
    await page.click('text=Portfolio');
    
    // 7. Wait for position to open (simulated)
    await expect(page.locator('table >> text=BTC-USD')).toBeVisible({ timeout: 30000 });
    
    // 8. Close position manually
    await page.click('text=Close');
    await expect(page.locator('text=Position close initiated')).toBeVisible();
  });

  test('emergency close all positions', async ({ page }) => {
    // Navigate to portfolio
    await page.click('text=Portfolio');
    
    // Click kill switch
    await page.click('text=KILL SWITCH');
    
    // Enter auth code
    await page.fill('input[type="password"]', process.env.TEST_EMERGENCY_CODE!);
    
    // Confirm
    await page.click('text=Close All Positions');
    
    // Verify notification
    await expect(page.locator('text=Emergency Close Initiated')).toBeVisible();
  });
}); 