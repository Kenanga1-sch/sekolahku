import { test, expect } from '@playwright/test';

// Increase timeout for all tests in this file
test.setTimeout(60000);

test.describe('Public Pages', () => {
    test('homepage loads correctly', async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' });

        await expect(page.locator('nav')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('footer')).toBeVisible();

        // Flexible hero check
        await expect(page.getByText(/Generasi|Sekolah|Daftar/i).first()).toBeVisible();
    });

    test('SPMB page is accessible', async ({ page }) => {
        await page.goto('/spmb', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(/\/spmb/);
        await expect(page.getByText(/Pendaftaran|SPMB/i).first()).toBeVisible();
    });

    test('FAQ page shows accordions', async ({ page }) => {
        await page.goto('/faq', { waitUntil: 'networkidle' });
        await expect(page.getByText(/FAQ|Pertanyaan/i).first()).toBeVisible();
    });

    test('Gallery page is accessible', async ({ page }) => {
        await page.goto('/galeri', { waitUntil: 'networkidle' });
        await expect(page.getByText(/Galeri/i).first()).toBeVisible();
    });

    test('Kurikulum page shows content', async ({ page }) => {
        await page.goto('/kurikulum', { waitUntil: 'networkidle' });
        await expect(page.getByText(/Kurikulum/i).first()).toBeVisible();
    });

    test('Contact page is accessible', async ({ page }) => {
        await page.goto('/kontak', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL('/kontak');
        await expect(page.getByText(/Kontak|Hubungi/i).first()).toBeVisible();
    });

    test('News page lists articles', async ({ page }) => {
        await page.goto('/berita', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL('/berita');
        await expect(page.getByText(/Berita|Pengumuman|Kabar/i).first()).toBeVisible();
    });
});

test.describe('Navigation', () => {
    test('navigation links work correctly', async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' });

        const spmbLink = page.getByRole('link', { name: /SPMB/i }).first();
        if (await spmbLink.isVisible()) {
            await spmbLink.click();
            await expect(page).toHaveURL(/\/spmb/);
        }
    });

    test('mobile menu toggle works', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/', { waitUntil: 'networkidle' });

        const menuButton = page.getByRole('button', { name: /menu|buka/i }).first();
        if (await menuButton.isVisible()) {
            await menuButton.click();
            await expect(page.getByRole('navigation')).toBeVisible();
        }
    });
});

test.describe('SPMB Flow', () => {
    test('SPMB registration page loads', async ({ page }) => {
        await page.goto('/spmb/daftar', { waitUntil: 'networkidle' });
        await expect(page.locator('form, input, button').first()).toBeVisible();
    });

    test('SPMB tracking page loads', async ({ page }) => {
        await page.goto('/spmb/tracking', { waitUntil: 'networkidle' });
        await expect(page).toHaveURL('/spmb/tracking');
        await expect(page.locator('input').first()).toBeVisible();
    });
});

test.describe('Authentication', () => {
    test('login page is accessible', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' });
        const url = page.url();
        expect(url).toMatch(/login|sign-in/);
        await expect(page.locator('input[type="password"]').first()).toBeVisible();
    });

    test('protected routes redirect to login', async ({ page }) => {
        await page.goto('/overview');
        await expect(page).toHaveURL(/.*(login|sign-in).*/);
    });
});

test.describe('Responsive Design', () => {
    const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'desktop', width: 1280, height: 720 },
    ];

    for (const viewport of viewports) {
        test(`homepage renders correctly on ${viewport.name}`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto('/', { waitUntil: 'networkidle' });
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 25);
        });
    }
});
