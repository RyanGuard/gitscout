import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = path.resolve("qa-reports/screenshots");
const REPORT_DATA_FILE = path.resolve("qa-reports/qa-data.json");

// All routes to test (logged-out state)
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/search", name: "search" },
  { path: "/lists", name: "lists" },
  { path: "/match", name: "match" },
  { path: "/favorites", name: "favorites" },
  { path: "/profile/torvalds", name: "profile-torvalds" },
];

interface QaNavA11yViolation {
  id: string;
  impact: string | null | undefined;
  description: string;
  helpUrl: string;
  nodes: number;
  targets: string[];
}

// Shared report data accumulator
const reportData: {
  screenshots: { route: string; file: string; theme: string }[];
  navigation: { test: string; passed: boolean; details: string }[];
  accessibility: { route: string; violations: QaNavA11yViolation[] }[];
  performance: { route: string; metrics: Record<string, number> }[];
  visualBugs: { route: string; issues: string[] }[];
} = {
  screenshots: [],
  navigation: [],
  accessibility: [],
  performance: [],
  visualBugs: [],
};

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Helper: take a full-page screenshot
async function takeScreenshot(page: Page, name: string, theme: string) {
  const filename = `${name}-${theme}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  reportData.screenshots.push({ route: name, file: filename, theme });
}

// Helper: get performance metrics for a page
async function getPerformanceMetrics(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((e) => e.name === "first-contentful-paint");

    return {
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      loadComplete: nav ? nav.loadEventEnd - nav.startTime : 0,
      firstContentfulPaint: fcp ? fcp.startTime : 0,
      ttfb: nav ? nav.responseStart - nav.startTime : 0,
    };
  });
}

// Helper: check for visual/layout issues
async function checkVisualIssues(page: Page, routeName: string) {
  const issues: string[] = [];

  // Check for horizontal overflow (layout bug)
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (hasHorizontalScroll) {
    issues.push("Horizontal scrollbar detected - possible layout overflow");
  }

  // Check for overlapping elements via z-index issues on header
  const headerVisible = await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return true;
    const rect = header.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(centerX, centerY);
    return header.contains(topEl);
  });
  if (!headerVisible) {
    issues.push("Header may be obscured by another element (z-index issue)");
  }

  // Check for elements overflowing viewport
  const overflowingElements = await page.evaluate(() => {
    const overflowing: string[] = [];
    const viewportWidth = window.innerWidth;
    const elements = document.querySelectorAll("*");
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth + 5 && rect.width > 0) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className?.toString().slice(0, 50) || "";
        overflowing.push(`${tag}.${cls} overflows by ${Math.round(rect.right - viewportWidth)}px`);
      }
    });
    return overflowing.slice(0, 5);
  });
  if (overflowingElements.length > 0) {
    issues.push(`Elements overflowing viewport: ${overflowingElements.join("; ")}`);
  }

  // Check for broken images
  const brokenImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src || img.getAttribute("alt") || "unnamed")
      .slice(0, 5);
  });
  if (brokenImages.length > 0) {
    issues.push(`Broken images: ${brokenImages.join(", ")}`);
  }

  // Check for empty links or buttons
  const emptyInteractives = await page.evaluate(() => {
    const issues: string[] = [];
    document.querySelectorAll("a, button").forEach((el) => {
      const text = (el as HTMLElement).innerText?.trim();
      const ariaLabel = el.getAttribute("aria-label");
      const title = el.getAttribute("title");
      if (!text && !ariaLabel && !title && el.querySelector("svg, img") === null) {
        issues.push(`Empty ${el.tagName.toLowerCase()}: ${el.className?.toString().slice(0, 40)}`);
      }
    });
    return issues.slice(0, 5);
  });
  if (emptyInteractives.length > 0) {
    issues.push(`Empty interactive elements: ${emptyInteractives.join("; ")}`);
  }

  reportData.visualBugs.push({ route: routeName, issues });
  return issues;
}

// ─── TEST SUITE 1: Full-page screenshots (light + dark) ───

test.describe("Screenshots - all routes", () => {
  for (const route of ROUTES) {
    test(`screenshot ${route.name} (light)`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(500); // let animations settle
      await takeScreenshot(page, route.name, "light");
    });

    test(`screenshot ${route.name} (dark)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await takeScreenshot(page, route.name, "dark");
    });
  }
});

// ─── TEST SUITE 2: Navigation ───

test.describe("Navigation - top nav links", () => {
  const NAV_LINKS = [
    { text: "Search", href: "/search" },
    { text: "Match", href: "/match" },
    { text: "Lists", href: "/lists" },
  ];

  for (const route of ROUTES) {
    test(`nav links present and clickable on ${route.name}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });

      // Check header exists
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Check Scout logo/link
      const logoLink = header.locator('a[href="/"]');
      await expect(logoLink).toBeVisible();

      // Check each nav link
      for (const link of NAV_LINKS) {
        const navLink = header.locator(`a[href="${link.href}"]`);
        await expect(navLink).toBeVisible();
        await expect(navLink).toContainText(link.text);

        reportData.navigation.push({
          test: `${link.text} link on ${route.name}`,
          passed: true,
          details: `Link to ${link.href} visible and contains text "${link.text}"`,
        });
      }
    });
  }

  test("clicking nav links navigates correctly", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    for (const link of NAV_LINKS) {
      const navLink = page.locator(`header a[href="${link.href}"]`);
      await navLink.click();
      await page.waitForURL(`**${link.href}*`, { timeout: 10000 });
      expect(page.url()).toContain(link.href);

      reportData.navigation.push({
        test: `Click ${link.text} link navigates to ${link.href}`,
        passed: true,
        details: `Successfully navigated to ${page.url()}`,
      });
    }
  });

  test("logo link navigates back to home", async ({ page }) => {
    await page.goto("/search", { waitUntil: "networkidle" });
    const logo = page.locator('header a[href="/"]');
    await logo.click();
    await page.waitForURL("**/", { timeout: 10000 });

    reportData.navigation.push({
      test: "Logo click navigates to home",
      passed: true,
      details: `Navigated to ${page.url()}`,
    });
  });
});

test.describe("Navigation - browser back/forward", () => {
  test("back/forward buttons work across routes", async ({ page }) => {
    // Navigate through several pages
    await page.goto("/", { waitUntil: "networkidle" });
    await page.goto("/search", { waitUntil: "networkidle" });
    await page.goto("/match", { waitUntil: "networkidle" });
    await page.goto("/lists", { waitUntil: "networkidle" });

    // Go back
    await page.goBack();
    await page.waitForURL("**/match*", { timeout: 5000 });
    expect(page.url()).toContain("/match");

    await page.goBack();
    await page.waitForURL("**/search*", { timeout: 5000 });
    expect(page.url()).toContain("/search");

    await page.goBack();
    await page.waitForURL(/\/$/, { timeout: 5000 });

    // Go forward
    await page.goForward();
    await page.waitForURL("**/search*", { timeout: 5000 });
    expect(page.url()).toContain("/search");

    await page.goForward();
    await page.waitForURL("**/match*", { timeout: 5000 });
    expect(page.url()).toContain("/match");

    reportData.navigation.push({
      test: "Browser back/forward navigation",
      passed: true,
      details: "Successfully navigated back and forward through / -> /search -> /match -> /lists",
    });
  });
});

// ─── TEST SUITE 3: Dashboard content ───

test.describe("Dashboard - landing page content", () => {
  test("greeting and hero section visible (logged-out)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Logged-out: should see LandingHero
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toContain("Scout");

    // Search input should be present
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
    const searchExists = await searchInput.count();

    // Feature cards (Globe, Zap, Shield)
    const featureTexts = ["Live GitHub search", "Apollo enrichment", "Push to Ashby"];
    for (const feat of featureTexts) {
      const el = page.locator(`text=${feat}`);
      const visible = (await el.count()) > 0;
      reportData.navigation.push({
        test: `Feature card "${feat}" visible`,
        passed: visible,
        details: visible ? "Visible on landing page" : "NOT FOUND on landing page",
      });
    }

    // Role preset buttons (these appear on logged-in dashboard, may not be on landing)
    const roleLabels = ["Frontend Engineer", "Backend Engineer", "ML Engineer", "DevOps / Infra", "Rust Systems", "Mobile Developer"];
    for (const role of roleLabels) {
      const el = page.locator(`text=${role}`);
      const visible = (await el.count()) > 0;
      reportData.navigation.push({
        test: `Role card "${role}" visible on home`,
        passed: visible,
        details: visible ? "Visible (dashboard/logged-in view)" : "Not visible (expected for logged-out view)",
      });
    }

    reportData.navigation.push({
      test: "Landing hero heading",
      passed: headingText?.includes("Scout") ?? false,
      details: `Heading text: "${headingText}"`,
    });

    reportData.navigation.push({
      test: "Search input on landing",
      passed: searchExists > 0,
      details: searchExists > 0 ? "Search input found" : "Search input NOT found",
    });
  });

  test("sample search terms are clickable", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const sampleTerms = ["rust developers in San Francisco", "python machine learning", "TypeScript React", "go engineers in Berlin"];
    for (const term of sampleTerms) {
      const btn = page.locator(`button:has-text("${term}")`);
      const exists = (await btn.count()) > 0;
      reportData.navigation.push({
        test: `Sample search term "${term}" button`,
        passed: exists,
        details: exists ? "Button present and clickable" : "Button NOT found",
      });
    }
  });
});

// ─── TEST SUITE 4: Dark theme consistency ───

test.describe("Dark theme consistency", () => {
  for (const route of ROUTES) {
    test(`dark theme renders correctly on ${route.name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const issues: string[] = [];

      // Check that body/html has dark background
      const bgColor = await page.evaluate(() => {
        const body = document.body;
        const computed = getComputedStyle(body);
        return computed.backgroundColor;
      });

      // Check for white text on white background (contrast issue)
      const contrastIssues = await page.evaluate(() => {
        const problems: string[] = [];
        const textElements = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, span, a, button, label, li");
        textElements.forEach((el) => {
          const style = getComputedStyle(el as HTMLElement);
          const color = style.color;
          // Check for very light text on very light background (light-on-light in dark mode)
          if (color === "rgb(0, 0, 0)" || color === "rgb(23, 23, 23)") {
            // Dark text that should have been flipped in dark mode
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const text = (el as HTMLElement).innerText?.trim().slice(0, 30);
              if (text) {
                problems.push(`Dark text in dark mode: "${text}" (color: ${color})`);
              }
            }
          }
        });
        return problems.slice(0, 10);
      });

      if (contrastIssues.length > 0) {
        issues.push(...contrastIssues);
      }

      // Check header border is dark-appropriate
      const headerBorderOk = await page.evaluate(() => {
        const header = document.querySelector("header");
        if (!header) return true;
        const style = getComputedStyle(header);
        const borderColor = style.borderBottomColor;
        // In dark mode, border should not be a very light color
        return !borderColor.includes("rgb(229, 229, 229)");
      });
      if (!headerBorderOk) {
        issues.push("Header border appears to use light-mode color in dark mode");
      }

      reportData.navigation.push({
        test: `Dark theme on ${route.name}`,
        passed: issues.length === 0,
        details: issues.length === 0 ? `Body bg: ${bgColor}. No contrast issues found.` : `Issues: ${issues.join("; ")}`,
      });
    });
  }
});

// ─── TEST SUITE 5: Accessibility audit ───

test.describe("Accessibility audit", () => {
  for (const route of ROUTES) {
    test(`a11y audit on ${route.name}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      reportData.accessibility.push({
        route: route.name,
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: v.nodes.length,
          targets: v.nodes.slice(0, 3).map((n) => n.target.join(" > ")),
        })),
      });

      // Don't fail the test - just record violations
      if (results.violations.length > 0) {
        console.log(`[a11y] ${route.name}: ${results.violations.length} violations found`);
      }
    });
  }
});

// ─── TEST SUITE 6: Performance ───

test.describe("Performance metrics", () => {
  for (const route of ROUTES) {
    test(`performance on ${route.name}`, async ({ page }) => {
      const start = Date.now();
      await page.goto(route.path, { waitUntil: "networkidle" });
      const networkIdleTime = Date.now() - start;

      const metrics = await getPerformanceMetrics(page);
      metrics.networkIdleTime = networkIdleTime;

      reportData.performance.push({
        route: route.name,
        metrics,
      });
    });
  }
});

// ─── TEST SUITE 7: Visual / layout bugs ───

test.describe("Visual and layout checks", () => {
  for (const route of ROUTES) {
    test(`visual checks on ${route.name} (light)`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      await checkVisualIssues(page, `${route.name}-light`);
    });

    test(`visual checks on ${route.name} (dark)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      await checkVisualIssues(page, `${route.name}-dark`);
    });
  }
});

// ─── Write report data at the end ───

test.afterAll(async () => {
  fs.writeFileSync(REPORT_DATA_FILE, JSON.stringify(reportData, null, 2));
});
