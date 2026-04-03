import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "fs";
import * as path from "path";

const REPORT_FILE = path.resolve("qa-reports/qa-full-data.json");

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/search", name: "search" },
  { path: "/lists", name: "lists" },
  { path: "/match", name: "match" },
  { path: "/favorites", name: "favorites" },
  { path: "/profile/torvalds", name: "profile-torvalds" },
];

interface QaPerfRow {
  route: string;
  metrics: Record<string, number>;
}

interface QaA11yViolation {
  id: string;
  impact: string | null | undefined;
  description: string;
  helpUrl: string;
  nodeCount: number;
  targets: string[];
}

interface QaA11yRow {
  route: string;
  violationCount: number;
  violations: QaA11yViolation[];
}

interface QaVisualRow {
  route: string;
  issues: string[];
}

const data: {
  accessibility: QaA11yRow[];
  performance: QaPerfRow[];
  visualBugs: QaVisualRow[];
} = { accessibility: [], performance: [], visualBugs: [] };

test.describe.serial("Collect QA data", () => {
  for (const route of ROUTES) {
    test(`collect data for ${route.name}`, async ({ page }) => {
      // Navigate and wait
      const start = Date.now();
      await page.goto(route.path, { waitUntil: "networkidle" });
      const loadTime = Date.now() - start;
      await page.waitForTimeout(500);

      // Performance metrics
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType("paint");
        const fcp = paint.find((e) => e.name === "first-contentful-paint");
        return {
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : 0,
          loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0,
          firstContentfulPaint: fcp ? Math.round(fcp.startTime) : 0,
          ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : 0,
        };
      });
      data.performance.push({
        route: route.name,
        metrics: { ...metrics, networkIdleTime: loadTime },
      });

      // Accessibility audit
      const a11yResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      data.accessibility.push({
        route: route.name,
        violationCount: a11yResults.violations.length,
        violations: a11yResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodeCount: v.nodes.length,
          targets: v.nodes.slice(0, 3).map((n) => n.target.join(" > ")),
        })),
      });

      // Visual bug checks
      const issues: string[] = [];

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      if (hasHorizontalScroll) issues.push("Horizontal scrollbar detected");

      const headerVisible = await page.evaluate(() => {
        const header = document.querySelector("header");
        if (!header) return true;
        const rect = header.getBoundingClientRect();
        const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return header.contains(el);
      });
      if (!headerVisible) issues.push("Header obscured by another element (z-index issue)");

      const overflows = await page.evaluate(() => {
        const vw = window.innerWidth;
        const results: string[] = [];
        document.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 5 && r.width > 0) {
            results.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() || "").slice(0, 40)} (+${Math.round(r.right - vw)}px)`);
          }
        });
        return results.slice(0, 5);
      });
      if (overflows.length > 0) issues.push(`Overflow: ${overflows.join("; ")}`);

      const brokenImgs = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.src || img.alt || "unknown")
          .slice(0, 5)
      );
      if (brokenImgs.length > 0) issues.push(`Broken images: ${brokenImgs.join(", ")}`);

      const emptyLinks = await page.evaluate(() => {
        const results: string[] = [];
        document.querySelectorAll("a, button").forEach((el) => {
          const txt = (el as HTMLElement).innerText?.trim();
          const aria = el.getAttribute("aria-label");
          const title = el.getAttribute("title");
          const hasIcon = el.querySelector("svg, img") !== null;
          if (!txt && !aria && !title && !hasIcon) {
            results.push(`Empty ${el.tagName.toLowerCase()}`);
          }
        });
        return results.slice(0, 5);
      });
      if (emptyLinks.length > 0) issues.push(`Empty interactives: ${emptyLinks.join("; ")}`);

      data.visualBugs.push({ route: route.name, issues });
    });
  }

  test("write collected data", async () => {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(data, null, 2));
  });
});
