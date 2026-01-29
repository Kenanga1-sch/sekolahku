import { test, expect } from '@playwright/test';

test.setTimeout(120000);

test.describe('Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
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

  test('Check Overview', async ({ page }) => {
    await page.goto('/overview', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Statistik|Overview|Dashboard/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Check Inventaris', async ({ page }) => {
    await page.goto('/inventaris', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Inventaris|Aset/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Check Perpustakaan', async ({ page }) => {
    await page.goto('/perpustakaan', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Perpustakaan|Buku/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Check Users', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Pengguna|Users/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Module specific actions - Inventaris', async ({ page }) => {
    await page.goto('/inventaris/aset', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Data Aset/i).first()).toBeVisible();

    const addButton = page.getByRole('button', { name: /Tambah Aset/i }).first();
    if (await addButton.isVisible()) {
        await addButton.click();
        await expect(page.getByText(/Tambah Aset Baru/i)).toBeVisible();
    }
  });
});
