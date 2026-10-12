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

    // ISBN yang sudah dipakai 1 judul → panel "Pilih tujuan eksemplar" muncul
    // dengan opsi "+ Judul lain" untuk membuat katalog baru ber-ISBN sama.
    test("ISBN sama dengan judul lain → bisa buat judul baru", async ({ page }) => {
        const isbn = "978" + Date.now().toString().slice(-10); // ISBN-13 unik per run

        // Daftarkan buku pertama dengan ISBN tsb.
        await page.goto("/perpustakaan/binding");
        await page.getByPlaceholder("Input Kode QR Manual...").fill("E2E-A-" + Date.now());
        await page.getByRole("button", { name: "Lanjut" }).click();
        await page.getByPlaceholder("Scan barcode ISBN...").fill(isbn);
        await page.locator("#title").fill("Judul Pertama E2E");
        await page.getByRole("button", { name: "Lanjut" }).click();
        await page.click("text=Simpan Buku");
        await expect(page.locator("text=Buku berhasil didaftarkan!")).toBeVisible();

        // Daftarkan buku kedua dengan ISBN SAMA tapi judul berbeda.
        await page.getByPlaceholder("Input Kode QR Manual...").fill("E2E-B-" + Date.now());
        await page.getByRole("button", { name: "Lanjut" }).click();
        await page.getByPlaceholder("Scan barcode ISBN...").fill(isbn);
        await page.getByRole("button", { name: "Cari" }).click();

        // Panel picker harus muncul (walau hanya 1 judul terdaftar).
        await expect(page.getByText("ISBN ini sudah terdaftar. Pilih tujuan eksemplar:").or(
            page.getByText(/ISBN ini dipakai \d+ judul berbeda/)
        )).toBeVisible();

        // Pilih "+ Judul lain" → form judul dikosongkan, ISBN tetap terisi.
        await page.getByText("+ Judul lain (buat katalog baru dengan ISBN ini)").click();
        await page.locator("#title").fill("Judul Kedua E2E");
        await page.getByRole("button", { name: "Lanjut" }).click();

        // Konfirmasi menampilkan judul baru + ISBN yang sama.
        await expect(page.locator("text=Judul Kedua E2E")).toBeVisible();
        await expect(page.locator(`text=${isbn}`)).toBeVisible();
        await page.click("text=Simpan Buku");
        await expect(page.locator("text=Buku berhasil didaftarkan!")).toBeVisible();
    });
});
