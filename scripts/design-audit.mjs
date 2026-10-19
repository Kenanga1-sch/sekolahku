/**
 * Baseline audit UI/UX: screenshot responsif + axe-core + metrik halaman.
 *
 * Pemakaian:
 *   BASE_URL=http://localhost:8181 node scripts/design-audit.mjs
 *   BASE_URL=https://sdn1kenanga.sch.id SESSION_TOKEN=... USER_INFO='{"id":"...","role":"superadmin"}' node scripts/design-audit.mjs
 *
 * Tanpa SESSION_TOKEN, hanya halaman publik yang diaudit. Token hanya dibaca
 * dari environment dan tidak pernah ditulis ke disk.
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:8181").replace(
  /\/$/,
  "",
);
const OUT = process.env.OUT_DIR || "docs/design-baseline/run";
const TOKEN = process.env.SESSION_TOKEN || "";
const USER_INFO = process.env.USER_INFO || "";
const HOST = new URL(BASE).hostname;
const SECURE = BASE.startsWith("https://");

const publicPages = [
  ["landing", "/"],
  ["login", "/login"],
  ["spmb", "/spmb"],
  ["daftar-ortu", "/daftar-ortu"],
  ["berita", "/berita"],
  ["katalog", "/katalog-buku"],
];
const authPages = [
  ["overview", "/overview"],
  ["siswa", "/admin/siswa"],
  ["tabungan", "/tabungan"],
  ["presensi", "/presensi"],
  ["pengaturan", "/pengaturan"],
  ["keuangan", "/keuangan"],
];
const pages = TOKEN ? [...publicPages, ...authPages] : publicPages;

const fourWidths = new Set([
  "landing",
  "login",
  "overview",
  "spmb",
  "daftar-ortu",
]);
const cookieJar = TOKEN
  ? [
      {
        name: "session",
        value: TOKEN,
        domain: HOST,
        path: "/",
        httpOnly: true,
        secure: SECURE,
        sameSite: "Lax",
      },
      {
        name: "user_info",
        value: encodeURIComponent(USER_INFO),
        domain: HOST,
        path: "/",
        httpOnly: false,
        secure: SECURE,
        sameSite: "Lax",
      },
    ]
  : [];

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { base: BASE, generatedAt: new Date().toISOString(), pages: [] };

for (const [name, route] of pages) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  if (cookieJar.length) await context.addCookies(cookieJar);
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const widths = fourWidths.has(name) ? [375, 768, 1024, 1440] : [375, 1440];
  const entry = {
    name,
    path: route,
    widths: {},
    axe: null,
    metrics: null,
    consoleErrors,
    pageErrors,
  };

  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      const res = await page.goto(`${BASE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: path.join(OUT, `${name}-${width}.png`),
        fullPage: true,
        animations: "allow",
        timeout: 90000,
      });
      entry.widths[width] = {
        status: res?.status(),
        title: await page.title(),
      };

      if (width === 1440) {
        entry.metrics = await page.evaluate(() => {
          const resources = performance.getEntriesByType("resource");
          const sum = (items) =>
            Math.round(
              items.reduce((acc, item) => acc + (item.transferSize || 0), 0) /
                1024,
            );
          return {
            domNodes: document.querySelectorAll("*").length,
            scrollHeight: document.documentElement.scrollHeight,
            resourceCount: resources.length,
            transferKB: sum(resources),
            jsKB: sum(resources.filter((r) => r.name.endsWith(".js"))),
            cssKB: sum(resources.filter((r) => r.name.endsWith(".css"))),
            images: document.images.length,
            h1: [...document.querySelectorAll("h1")].map((el) =>
              el.textContent?.trim(),
            ),
          };
        });

        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        entry.axe = {
          violations: axe.violations.length,
          passes: axe.passes.length,
          incomplete: axe.incomplete.length,
          items: axe.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.length,
            help: violation.help,
            targets: violation.nodes.slice(0, 8).map((node) => ({
              target: node.target,
              html: (node.html || "").slice(0, 160),
              summary: (node.failureSummary || "").slice(0, 220),
            })),
          })),
        };
      }
    }
  } catch (err) {
    entry.error = err.message;
  }

  report.pages.push(entry);
  console.log(
    `${name}: ${entry.error ? `ERROR ${entry.error}` : "ok"} | axe=${
      entry.axe?.violations ?? "n/a"
    } | transferKB=${entry.metrics?.transferKB ?? "n/a"}`,
  );
  await page.close();
  await context.close();
}

await fs.writeFile(
  path.join(OUT, "report.json"),
  JSON.stringify(report, null, 2),
);
await browser.close();
console.log(`written ${path.join(OUT, "report.json")}`);
