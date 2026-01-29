import { test, expect } from '@playwright/test';

test.setTimeout(120000);

// Mock geolocation to a location near the default school coords (Kenanga)
test.use({
  geolocation: { latitude: -6.8523, longitude: 108.5568 }, // Cirebon area
  permissions: ['geolocation'],
});

test.describe('SPMB Registration Flow', () => {
  test('Registration page basic check', async ({ page }) => {
    // 1. Navigate to Registration Page
    await page.goto('/spmb/daftar', { waitUntil: 'networkidle' });
    
    // Check if we are on Step 1
    await expect(page.getByText('Data Siswa', { exact: true }).first()).toBeVisible({ timeout: 20000 });

    // 2. Fill Step 1 (Student Data)
    await page.fill('input[name="full_name"]', 'Budi Santoso');
    await page.fill('input[name="nik"]', '1234567890123456');
    
    // Just verify the page is functional
    const nextBtn = page.getByRole('button', { name: /Next|Lanjut/i }).first();
    await expect(nextBtn).toBeEnabled();
  });
});
