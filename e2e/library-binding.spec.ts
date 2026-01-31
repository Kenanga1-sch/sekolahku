import { test, expect } from "@playwright/test";

test.describe("Library Binding Flow", () => {
    test.setTimeout(120000);
    test.beforeEach(async ({ page }) => {
        // Login as admin
        await page.goto("/login");
        await page.fill('input[name="identity"]', "testadmin@sekolah.id");
        await page.fill('input[name="password"]', "password123");
        await page.click('button[type="submit"]');
        // The dashboard URL might be /overview or /dashboard
        await expect(page).toHaveURL(/\/overview|\/dashboard/);
    });

    test("should complete binding flow manually", async ({ page }) => {
        await page.goto("/perpustakaan/binding");

        // Step 1: Physical Identity
        await expect(page.getByText("Langkah 1: Identitas Fisik")).toBeVisible();
        const testQR = "E2E-QR-" + Date.now();
        await page.getByPlaceholder("Input Kode QR Manual...").fill(testQR);
        await page.getByRole("button", { name: "Lanjut" }).click();

        // Step 2: Data Katalog
        await expect(page.getByText("Langkah 2: Data Katalog")).toBeVisible();
        await page.getByPlaceholder("Scan barcode ISBN...").fill("9786022916628"); // Laskar Pelangi

        // Fill manual catalog data
        await page.locator("#title").fill("Buku E2E Test");
        await page.locator("#author").fill("Penulis E2E");
        await page.getByRole("button", { name: "Lanjut" }).click();

        // Step 3: Confirmation
        await expect(page.locator("text=Langkah 3: Konfirmasi & Lokasi")).toBeVisible();
        await expect(page.locator("text=Buku E2E Test")).toBeVisible();
        await expect(page.locator(`text=${testQR}`)).toBeVisible();

        await page.click("text=Simpan Buku");

        // Success message
        await expect(page.locator("text=Buku berhasil didaftarkan!")).toBeVisible();

        // Check if it appears in the book list
        await page.goto("/perpustakaan/buku");
        await page.fill('placeholder="Cari judul, penulis, atau ISBN..."', "Buku E2E Test");
        await expect(page.locator("text=Buku E2E Test")).toBeVisible();
        await expect(page.locator(`text=${testQR}`)).toBeVisible();
    });
});
