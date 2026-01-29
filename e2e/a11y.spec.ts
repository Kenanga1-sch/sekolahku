import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility tests using axe-core
 * Tests critical pages for WCAG 2.1 Level AA compliance
 */

test.describe("Accessibility Tests", () => {
    test("Homepage should have no accessibility violations", async ({ page }) => {
        await page.goto("/");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .exclude(".maplibregl-map") // Exclude map component if present
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test("Login page should have no accessibility violations", async ({ page }) => {
        await page.goto("/login");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test("SPMB registration page should have no accessibility violations", async ({ page }) => {
        await page.goto("/spmb");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test("Contact page should have no accessibility violations", async ({ page }) => {
        await page.goto("/kontak");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test("Gallery page should have no accessibility violations", async ({ page }) => {
        await page.goto("/galeri");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });
});

test.describe("Keyboard Navigation", () => {
    test("Login form should be navigable with keyboard", async ({ page }) => {
        await page.goto("/login");
        
        // Tab to first input
        await page.keyboard.press("Tab");
        const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
        expect(firstFocused).toBeTruthy();
        
        // Tab through form elements
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        
        // Should be able to reach submit button
        const submitReachable = await page.evaluate(() => {
            return document.activeElement?.getAttribute("type") === "submit" ||
                   document.activeElement?.textContent?.toLowerCase().includes("login") ||
                   document.activeElement?.textContent?.toLowerCase().includes("masuk");
        });
        expect(submitReachable).toBe(true);
    });

    test("Navigation menu should be keyboard accessible", async ({ page }) => {
        await page.goto("/");
        
        // Focus on navigation
        await page.keyboard.press("Tab");
        
        // Should be able to navigate menu items
        let foundNavLink = false;
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press("Tab");
            const isLink = await page.evaluate(() => {
                const el = document.activeElement;
                return el?.tagName === "A" || el?.getAttribute("role") === "menuitem";
            });
            if (isLink) {
                foundNavLink = true;
                break;
            }
        }
        expect(foundNavLink).toBe(true);
    });
});

test.describe("Color Contrast", () => {
    test("Primary buttons should have sufficient contrast", async ({ page }) => {
        await page.goto("/login");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["cat.color"])
            .analyze();

        // Filter for contrast violations only
        const contrastViolations = accessibilityScanResults.violations.filter(
            v => v.id === "color-contrast"
        );
        
        expect(contrastViolations).toEqual([]);
    });
});

test.describe("Form Accessibility", () => {
    test("Form inputs should have associated labels", async ({ page }) => {
        await page.goto("/login");
        
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(["cat.forms"])
            .analyze();

        const labelViolations = accessibilityScanResults.violations.filter(
            v => v.id === "label" || v.id === "label-title-only"
        );
        
        expect(labelViolations).toEqual([]);
    });

    test("Required fields should be properly indicated", async ({ page }) => {
        await page.goto("/spmb/daftar");
        
        // Check for aria-required or required attribute on form fields
        const requiredFields = await page.$$eval("input[required], input[aria-required='true']", 
            inputs => inputs.length
        );
        
        // SPMB form should have required fields
        expect(requiredFields).toBeGreaterThan(0);
    });
});
