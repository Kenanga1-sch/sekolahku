import { test, expect } from '@playwright/test';

// Mock geolocation to a location near the default school coords (Kenanga)
test.use({
  geolocation: { latitude: -6.8523, longitude: 108.5568 }, // Cirebon area
  permissions: ['geolocation'],
});

test.describe('SPMB Registration Flow', () => {
  test('Complete registration with persistence check', async ({ page }) => {
    // 1. Navigate to Registration Page
    console.log('Navigating to page...');
    try {
      await page.goto('/spmb/daftar', { timeout: 30000 });
      console.log('Page loaded');
    } catch (e) {
      console.error('Navigation failed:', e);
      throw e;
    }
    // await expect(page).toHaveTitle(/Pendaftaran Siswa Baru/);
    
    // Check if we are on Step 1
    await expect(page.getByText('Data Siswa', { exact: true })).toBeVisible();
    console.log('Step 1 visible');

    // 2. Fill Step 1 (Student Data)
    console.log('Filling form...');
    await page.fill('input[name="full_name"]', 'Budi Santoso');
    await page.fill('input[name="nik"]', '1234567890123456'); // 16 digits
    await page.fill('input[name="birth_place"]', 'Cirebon');
    await page.fill('input[type="date"]', '2016-01-01'); // 7-8 years old
    
    // Select Gender (Select component is tricky in Playwright, often hidden input)
    // We click the trigger then the option
    await page.click('button[role="combobox"]');
    await page.getByRole('option', { name: 'Laki-laki' }).click();
    
    await page.fill('input[name="previous_school"]', 'TK Pertiwi');

    // 3. PERSISTENCE CHECK: Reload Page
    console.log('Reloading page to check persistence...');
    await page.reload();

    // Verify data is still there
    await expect(page.locator('input[name="full_name"]')).toHaveValue('Budi Santoso');
    await expect(page.locator('input[name="nik"]')).toHaveValue('1234567890123456');
    await expect(page.locator('input[name="birth_place"]')).toHaveValue('Cirebon');
    
    // Note: Select value verification might need specific attribute check or just assume it works if input values persisted
    // Proceed to Step 2
    await page.getByRole('button', { name: 'Next Step' }).click();

    // 4. Fill Step 2 (Parent Data)
    await expect(page.getByText('Data Orang Tua')).toBeVisible();
    await page.fill('input[name="parent_name"]', 'Ayah Budi');
    // Using a valid dummy phone number
    await page.fill('input[name="parent_phone"]', '081234567890');
    await page.fill('input[name="parent_email"]', 'ayah@contoh.com');
    await page.fill('textarea[name="home_address"]', 'Jl. Merdeka No. 10, Cirebon');
    
    await page.getByRole('button', { name: 'Next Step' }).click();

    // 5. Fill Step 3 (Location)
    await expect(page.getByText('Lokasi Rumah')).toBeVisible();
    // Since we mocked geolocation, the map might auto-center or we simulate a click or just rely on default
    // We assume the default pin is okay or the user would move it. 
    // Let's just click 'Next Step' assuming the default/mocked location is valid (in zone)
    // We might need to wait for map to load?
    await page.waitForTimeout(1000); 
    await page.getByRole('button', { name: 'Next Step' }).click();

    // 6. Fill Step 4 (Documents)
    await expect(page.getByText('Dokumen')).toBeVisible();
    
    // Upload a dummy file
    // We need to create a dummy file on the fly or usage existing one?
    // Playwright can handle inputs. We'll use a buffer for a fake image.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'akta.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('this is a fake image')
    });
    
    // Wait for file list to show
    await expect(page.getByText('akta.jpg')).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Step' }).click();

    // 7. Step 5 (Review)
    await expect(page.getByText('Review', { exact: true })).toBeVisible();
    await expect(page.getByText('Budi Santoso')).toBeVisible();
    await expect(page.getByText('Ayah Budi')).toBeVisible();

    // 8. Submit
    // Mock the API response to avoid actual database write? 
    // Or let it hit the dev DB (it's E2E). Ideally we should mock for stability, 
    // but hitting the real dev API ensures the whole stack works (including DB).
    // Let's assume hitting real API.
    
    await page.getByRole('button', { name: 'Submit Application' }).click();

    // 9. Verify Success
    await expect(page.getByText('Pendaftaran Berhasil!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Nomor Registrasi')).toBeVisible();

    // 10. Verify Persistence Cleared
    // We can check localStorage or try to reload and see if we are back to Step 1 empty
    const localStorageData = await page.evaluate(() => localStorage.getItem('spmb_registration_progress'));
    expect(localStorageData).toBeNull();
    
  });
});
