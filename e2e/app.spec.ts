import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
    test('homepage loads correctly', async ({ page }) => {
        await page.goto('/');

        // Check hero section exists
        await expect(page.locator('h1')).toBeVisible();

        // Check navigation exists
        await expect(page.locator('nav')).toBeVisible();

        // Check footer exists
        await expect(page.locator('footer')).toBeVisible();
    });

    test('SPMB page is accessible', async ({ page }) => {
        await page.goto('/spmb');

        await expect(page).toHaveURL('/spmb');
        await expect(page.locator('h1')).toContainText(/SPMB|Pendaftaran/i);
    });

    test('FAQ page shows accordions', async ({ page }) => {
        await page.goto('/faq');

        await expect(page.locator('h1')).toContainText(/FAQ|Pertanyaan/i);

        // Check accordion items exist
        const accordions = page.locator('[data-state]');
        await expect(accordions.first()).toBeVisible();
    });

    test('Gallery page shows images', async ({ page }) => {
        await page.goto('/galeri');

        await expect(page.locator('h1')).toContainText(/Galeri/i);

        // Check images are present
        const images = page.locator('img');
        await expect(images.first()).toBeVisible();
    });

    test('Kurikulum page shows tabs', async ({ page }) => {
        await page.goto('/kurikulum');

        await expect(page.locator('h1')).toContainText(/Kurikulum/i);

        // Check tabs exist
        const tabs = page.getByRole('tablist');
        await expect(tabs).toBeVisible();
    });

    test('Contact page is accessible', async ({ page }) => {
        await page.goto('/kontak');

        await expect(page).toHaveURL('/kontak');
        await expect(page.locator('h1')).toBeVisible();
    });

    test('News page lists articles', async ({ page }) => {
        await page.goto('/berita');

        await expect(page).toHaveURL('/berita');
        await expect(page.locator('h1')).toContainText(/Berita|Pengumuman/i);
    });
});

test.describe('Navigation', () => {
    test('navigation links work correctly', async ({ page }) => {
        await page.goto('/');

        // Click SPMB link
        await page.getByRole('link', { name: /SPMB/i }).first().click();
        await expect(page).toHaveURL('/spmb');

        // Go back to home
        await page.goto('/');

        // Click FAQ link (may be in dropdown)
        const faqLink = page.getByRole('link', { name: /FAQ/i });
        if (await faqLink.isVisible()) {
            await faqLink.click();
            await expect(page).toHaveURL('/faq');
        }
    });

    test('mobile menu toggle works', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Find and click mobile menu button
        const menuButton = page.getByRole('button', { name: /menu/i });
        if (await menuButton.isVisible()) {
            await menuButton.click();

            // Check mobile menu opened
            await expect(page.getByRole('navigation')).toBeVisible();
        }
    });
});

test.describe('SPMB Flow', () => {
    test('SPMB registration page loads', async ({ page }) => {
        await page.goto('/spmb/daftar');

        // Check form elements exist
        await expect(page.locator('form')).toBeVisible();
    });

    test('SPMB tracking page loads', async ({ page }) => {
        await page.goto('/spmb/tracking');

        await expect(page).toHaveURL('/spmb/tracking');

        // Check input for registration number exists
        const input = page.getByPlaceholder(/pendaftaran|nomor/i);
        await expect(input).toBeVisible();
    });
});

test.describe('Authentication', () => {
    test('login page is accessible', async ({ page }) => {
        await page.goto('/login');

        await expect(page).toHaveURL('/login');

        // Check login form exists
        await expect(page.getByLabel(/email|username/i)).toBeVisible();
        await expect(page.getByLabel(/password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /login|masuk/i })).toBeVisible();
    });

    test('protected routes redirect to login', async ({ page }) => {
        await page.goto('/overview');

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Responsive Design', () => {
    const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1280, height: 720 },
    ];

    for (const viewport of viewports) {
        test(`homepage renders correctly on ${viewport.name}`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto('/');

            // Page should not have horizontal scroll
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Small tolerance
        });
    }
});
