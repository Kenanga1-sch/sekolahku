import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test.describe('Mobile Shell', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.skip(!testInfo.project.name.includes('mobile'), 'Mobile viewport only');

    await page.goto('/login', { waitUntil: 'networkidle' });

    const url = page.url();
    if (url.includes('auth/sign-in')) {
      await page.fill('input[name="email"]', 'testadmin@sekolah.id');
      await page.fill('input[name="password"]', 'test1234');
      await page.click('button:has-text("Sign in")');
    } else {
      await page.fill('input[name*="identity" i], input[name*="user" i]', 'testadmin@sekolah.id');
      await page.fill('input[name="password"]', 'test1234');
      await page.click('button[type="submit"]');
    }

    await expect(page).toHaveURL(/\/overview|inventaris|perpustakaan|dashboard/, { timeout: 45000 });
  });

  test('Bottom nav is visible and sidebar drawer opens via FAB', async ({ page }) => {
    await page.goto('/overview', { waitUntil: 'networkidle' });

    const bottomNav = page.locator('nav').first();
    await expect(bottomNav).toBeVisible();

    // FAB opens the full navigation drawer
    await page.locator('button[aria-label="Menu"]').click();
    await expect(page.getByText('Beranda').first()).toBeVisible({ timeout: 10000 });
  });

  test('No horizontal overflow on key pages', async ({ page }) => {
    const routes = ['/overview', '/tabungan/riwayat', '/perpustakaan/buku', '/arsip/surat-masuk'];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(hasOverflow, `Unexpected horizontal overflow on ${route}`).toBe(false);
    }
  });
});
