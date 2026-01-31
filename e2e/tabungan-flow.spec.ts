import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test.describe('Tabungan Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[name*="identity" i], input[name*="user" i]', 'testadmin@sekolah.id');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/overview|inventaris|perpustakaan|dashboard/, { timeout: 45000 });
  });

  test('Navigate to Tabungan and check pages', async ({ page }) => {
    await page.goto('/tabungan', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Tabungan/i).first()).toBeVisible();

    await page.goto('/tabungan/scan', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Scan Transaksi/i).first()).toBeVisible();

    await page.goto('/tabungan/verifikasi', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Verifikasi Setoran/i).first()).toBeVisible();

    await page.goto('/tabungan/brankas', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Brankas/i).first()).toBeVisible();
  });
});
