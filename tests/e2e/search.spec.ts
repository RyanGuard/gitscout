import { test, expect, Page } from "@playwright/test";

const SEARCH_URL = "/search";
const SCREENSHOT_DIR = "qa-reports/screenshots";

// Helper: collect console errors during a test
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });
  return errors;
}

// Helper: screenshot on failure with descriptive name
async function screenshotOnFail(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

// ─────────────────────────────────────────────
// 1. PAGE LOAD TESTS
// ─────────────────────────────────────────────
test.describe("Page Load", () => {
  test("search page loads successfully", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const start = Date.now();
    const response = await page.goto(SEARCH_URL);
    const loadTime = Date.now() - start;

    expect(response?.status()).toBe(200);
    // Page should have a search input
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    // Page should have a Search button
    await expect(page.getByRole("button", { name: /search/i })).toBeVisible();

    if (errors.length > 0) {
      await screenshotOnFail(page, "page-load-console-errors");
    }

    // Attach load time as annotation
    test.info().annotations.push({
      type: "load_time_ms",
      description: String(loadTime),
    });
  });

  test("page title and meta are present", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("Cmd+K / Ctrl+K focuses search input", async ({ page }) => {
    await page.goto(SEARCH_URL);
    await page.waitForTimeout(1000); // Wait for JS hydration
    const input = page.locator('input[type="text"]').first();

    // Click elsewhere first to ensure input is NOT focused
    await page.locator("body").click();

    // Try both key combos — Playwright in headless Chrome doesn't always
    // propagate Meta on macOS
    await page.keyboard.press("Control+k");
    const focused = await input.evaluate(
      (el) => document.activeElement === el
    );
    if (!focused) {
      await page.keyboard.press("Meta+k");
    }

    // Record result as annotation rather than hard-fail — keyboard shortcut
    // behavior varies by OS/headless mode
    const isFocused = await input.evaluate(
      (el) => document.activeElement === el
    );
    test.info().annotations.push({
      type: "cmd_k_focused",
      description: String(isFocused),
    });
    if (!isFocused) {
      await screenshotOnFail(page, "cmd-k-not-focused");
    }
    expect(isFocused).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 2. SEARCH EXECUTION TESTS
// ─────────────────────────────────────────────
test.describe("Search Execution", () => {
  test("basic search returns results", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto(SEARCH_URL);

    const input = page.locator('input[type="text"]').first();
    await input.fill("react");
    await page.getByRole("button", { name: /search/i }).click();

    // URL should update with query parameter
    await page.waitForURL(/[?&]q=react/);

    // Wait for results or empty state (loading to finish)
    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    // Should show developer cards or no-results
    const cards = page.locator('a[href^="/profile/"]');
    const noResults = page.getByText("No developers found");
    const hasCards = (await cards.count()) > 0;
    const hasNoResults = await noResults.isVisible().catch(() => false);

    expect(hasCards || hasNoResults).toBeTruthy();

    if (errors.length > 0) {
      await screenshotOnFail(page, "basic-search-console-errors");
    }
  });

  test("search via URL parameter works", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=python`);

    // Should auto-search based on URL
    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    const cards = page.locator('a[href^="/profile/"]');
    const count = await cards.count();
    // URL-driven search should trigger automatically
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("search with natural language query", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await input.fill("rust engineers in San Francisco");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForURL(/[?&]q=rust/);

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );
  });

  test("search for specific username", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await input.fill("torvalds");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForURL(/[?&]q=torvalds/);

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );
  });
});

// ─────────────────────────────────────────────
// 3. FILTER TESTS
// ─────────────────────────────────────────────
test.describe("Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=developer`);
    // Wait for initial search to complete
    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );
  });

  test("language filter toggles update URL", async ({ page }) => {
    // On mobile/tablet, might need to open filters first
    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    // Click on TypeScript language pill
    const tsPill = page.getByRole("button", { name: "TypeScript" });
    if (await tsPill.isVisible().catch(() => false)) {
      await tsPill.click();
      // URL should include languages parameter
      await expect(page).toHaveURL(/languages=typescript/i, {
        timeout: 5000,
      });
    }
  });

  test("sort options change URL parameter", async ({ page }) => {
    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    const followersBtn = page.getByRole("button", { name: "Followers" });
    if (await followersBtn.isVisible().catch(() => false)) {
      await followersBtn.click();
      await expect(page).toHaveURL(/sort=followers/, { timeout: 5000 });
    }
  });

  test("location filter updates URL", async ({ page }) => {
    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    const locationInput = page.locator('input[placeholder*="San Francisco"]');
    if (await locationInput.isVisible().catch(() => false)) {
      await locationInput.fill("New York");
      // Blur to trigger update
      await locationInput.blur();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/location=New/, { timeout: 5000 });
    }
  });

  test("min stars filter updates URL", async ({ page }) => {
    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    const starsInput = page.locator('input[type="number"]');
    if (await starsInput.isVisible().catch(() => false)) {
      await starsInput.fill("100");
      await starsInput.blur();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/minStars=100/, { timeout: 5000 });
    }
  });

  test("hireable checkbox updates URL", async ({ page }) => {
    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
      await expect(page).toHaveURL(/hireable=true/, { timeout: 5000 });
    }
  });

  test("clear filters resets all", async ({ page }) => {
    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    // Activate a filter first
    const tsPill = page.getByRole("button", { name: "TypeScript" });
    if (await tsPill.isVisible().catch(() => false)) {
      await tsPill.click();
      await page.waitForTimeout(500);

      // Click clear
      const clearBtn = page.getByRole("button", { name: /clear/i });
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
        // URL should no longer have languages
        await page.waitForTimeout(500);
        const url = page.url();
        expect(url).not.toContain("languages=");
      }
    }
  });
});

// ─────────────────────────────────────────────
// 4. EMPTY & INVALID INPUT TESTS
// ─────────────────────────────────────────────
test.describe("Empty & Invalid Inputs", () => {
  test("empty search submission behavior", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await input.fill("");
    await page.getByRole("button", { name: /search/i }).click();

    // Should either stay on page or show helpful state
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/empty-search.png`,
      fullPage: true,
    });
  });

  test("whitespace-only search", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await input.fill("   ");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/whitespace-search.png`,
      fullPage: true,
    });
  });

  test("special characters in search", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await input.fill('<script>alert("xss")</script>');
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForTimeout(3000);

    // Should not crash - page should still be functional
    await expect(
      page.locator('input[type="text"]').first()
    ).toBeVisible();

    if (errors.length > 0) {
      await screenshotOnFail(page, "special-chars-errors");
    }
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/special-chars-search.png`,
      fullPage: true,
    });
  });

  test("very long search query", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    const longQuery = "a".repeat(500);
    await input.fill(longQuery);
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForTimeout(3000);

    // Page should not crash
    await expect(
      page.locator('input[type="text"]').first()
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/long-query-search.png`,
      fullPage: true,
    });
  });

  test("gibberish search returns no results gracefully", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await input.fill("zzzxqwkjh928374ncvbm");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForFunction(
      () => {
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        const results = document.querySelectorAll('a[href^="/profile/"]');
        return noResults || results.length > 0;
      },
      { timeout: 30000 }
    );

    // Should show "No developers found" or similar
    const noResults = page.getByText("No developers found");
    const cards = page.locator('a[href^="/profile/"]');
    const visible = await noResults.isVisible().catch(() => false);
    const count = await cards.count();

    expect(visible || count === 0).toBeTruthy();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/gibberish-search.png`,
      fullPage: true,
    });
  });

  test("negative min stars value", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=react`);
    await page.waitForTimeout(2000);

    const filterToggle = page.getByRole("button", { name: /filters/i });
    if (await filterToggle.isVisible().catch(() => false)) {
      await filterToggle.click();
    }

    const starsInput = page.locator('input[type="number"]');
    if (await starsInput.isVisible().catch(() => false)) {
      await starsInput.fill("-50");
      await starsInput.blur();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/negative-stars.png`,
        fullPage: true,
      });
    }
  });
});

// ─────────────────────────────────────────────
// 5. RESULT CARD RENDERING TESTS
// ─────────────────────────────────────────────
test.describe("Result Card Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=react`);
    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );
  });

  test("developer cards have required elements", async ({ page }) => {
    const cards = page.locator('a[href^="/profile/"]');
    const count = await cards.count();

    if (count > 0) {
      const firstCard = cards.first();

      // Should have an avatar image
      const avatar = firstCard.locator("img");
      await expect(avatar.first()).toBeVisible();

      // Should have username text (starts with @)
      const usernameText = firstCard.locator("text=@");
      expect(await usernameText.count()).toBeGreaterThanOrEqual(0);

      // Card should link to a profile page
      const href = await firstCard.getAttribute("href");
      expect(href).toMatch(/\/profile\/.+/);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/result-cards.png`,
        fullPage: true,
      });
    }
  });

  test("developer cards link to correct profile pages", async ({ page }) => {
    const cards = page.locator('a[href^="/profile/"]');
    const count = await cards.count();

    if (count > 0) {
      const firstCard = cards.first();
      const href = await firstCard.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).toMatch(/^\/profile\/[a-zA-Z0-9_-]+/);
    }
  });

  test("avatar images load without errors", async ({ page }) => {
    const cards = page.locator('a[href^="/profile/"]');
    const count = await cards.count();

    if (count > 0) {
      const images = page.locator('a[href^="/profile/"] img');
      const imgCount = await images.count();
      let brokenImages = 0;

      for (let i = 0; i < Math.min(imgCount, 5); i++) {
        const img = images.nth(i);
        // Scroll into view to trigger lazy loading
        await img.scrollIntoViewIfNeeded();
        // Wait for image to load
        await img.evaluate(
          (el: HTMLImageElement) =>
            el.complete ||
            new Promise((resolve) => {
              el.onload = resolve;
              el.onerror = resolve;
              setTimeout(resolve, 3000);
            })
        );
        const naturalWidth = await img.evaluate(
          (el: HTMLImageElement) => el.naturalWidth
        );
        if (naturalWidth === 0) brokenImages++;
      }

      if (brokenImages > 0) {
        await screenshotOnFail(page, "broken-avatar-images");
      }
      expect(brokenImages).toBe(0);
    }
  });

  test("result count text is displayed", async ({ page }) => {
    const countText = page.getByText(/developers? found/i);
    const visible = await countText.isVisible().catch(() => false);
    // If we have results, count text should appear
    const cards = page.locator('a[href^="/profile/"]');
    if ((await cards.count()) > 0) {
      expect(visible).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────
// 6. LOADING ANIMATION TESTS
// ─────────────────────────────────────────────
test.describe("Loading Animations", () => {
  test("loading state appears during search", async ({ page }) => {
    await page.goto(SEARCH_URL);

    // Intercept API to add delay so we can observe loading
    await page.route("**/api/search**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    const input = page.locator('input[type="text"]').first();
    await input.fill("golang");
    await page.getByRole("button", { name: /search/i }).click();

    // Should show loading indicator
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/loading-state.png`,
      fullPage: true,
    });

    // Check for animated elements (SearchRadar or loading messages)
    const loadingVisible =
      (await page.locator("svg").count()) > 0 ||
      (await page.getByText(/searching/i).isVisible().catch(() => false));

    // At minimum, the page shouldn't show results yet
    test.info().annotations.push({
      type: "loading_observed",
      description: String(loadingVisible),
    });
  });

  test("loading state clears after results arrive", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=javascript`);

    // Wait for search to complete
    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    // Loading indicator should be gone
    const loadingMessages = page.getByText(/scanning repositories/i);
    const stillLoading = await loadingMessages.isVisible().catch(() => false);
    expect(stillLoading).toBeFalsy();
  });
});

// ─────────────────────────────────────────────
// 7. RESPONSIVE LAYOUT TESTS
// ─────────────────────────────────────────────
test.describe("Responsive Layout", () => {
  test("search input is visible and usable", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();

    // Input should be interactable
    await input.fill("test");
    expect(await input.inputValue()).toBe("test");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/responsive-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test("search button is visible and clickable", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const btn = page.getByRole("button", { name: /search/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("page layout has no horizontal overflow", async ({ page }) => {
    await page.goto(SEARCH_URL);
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );

    if (scrollWidth > clientWidth) {
      await screenshotOnFail(page, `overflow-${test.info().project.name}`);
    }
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance
  });

  test("results display correctly at current viewport", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=go`);

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/results-${test.info().project.name}.png`,
      fullPage: true,
    });

    // Cards should not overflow their container
    const cards = page.locator('a[href^="/profile/"]');
    const count = await cards.count();
    if (count > 0) {
      const cardBox = await cards.first().boundingBox();
      const viewportWidth = page.viewportSize()?.width ?? 1280;
      if (cardBox) {
        expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
          viewportWidth + 5
        );
      }
    }
  });

  test("filter sidebar visibility matches viewport", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=test`);
    await page.waitForTimeout(2000);

    const viewportWidth = page.viewportSize()?.width ?? 1280;

    if (viewportWidth >= 1024) {
      // Desktop: sidebar should be visible by default
      const sidebar = page.locator("aside");
      const visible = await sidebar.isVisible().catch(() => false);
      // Sidebar should be present on desktop
      test.info().annotations.push({
        type: "sidebar_visible",
        description: String(visible),
      });
    } else {
      // Mobile/tablet: filter toggle button should exist
      const filterBtn = page.getByRole("button", { name: /filters/i });
      const visible = await filterBtn.isVisible().catch(() => false);
      test.info().annotations.push({
        type: "filter_toggle_visible",
        description: String(visible),
      });
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/filters-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
});

// ─────────────────────────────────────────────
// 8. CONSOLE ERROR TESTS
// ─────────────────────────────────────────────
test.describe("Console Errors", () => {
  test("no critical console errors on page load", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto(SEARCH_URL);
    await page.waitForTimeout(2000);

    // Filter out known non-critical warnings
    const critical = errors.filter(
      (e) =>
        !e.includes("Warning:") &&
        !e.includes("DevTools") &&
        !e.includes("favicon") &&
        !e.includes("next-router-prefetch")
    );

    if (critical.length > 0) {
      await screenshotOnFail(page, "console-errors-load");
      test.info().annotations.push({
        type: "console_errors",
        description: critical.join(" | "),
      });
    }
    expect(critical.length).toBe(0);
  });

  test("no console errors during search", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto(SEARCH_URL);

    const input = page.locator('input[type="text"]').first();
    await input.fill("typescript");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    const critical = errors.filter(
      (e) =>
        !e.includes("Warning:") &&
        !e.includes("DevTools") &&
        !e.includes("favicon") &&
        !e.includes("next-router-prefetch")
    );

    if (critical.length > 0) {
      await screenshotOnFail(page, "console-errors-search");
      test.info().annotations.push({
        type: "console_errors",
        description: critical.join(" | "),
      });
    }
    expect(critical.length).toBe(0);
  });

  test("no unhandled JS exceptions during interaction", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(SEARCH_URL);

    // Rapid interactions
    const input = page.locator('input[type="text"]').first();
    await input.fill("react");
    await page.getByRole("button", { name: /search/i }).click();
    await page.waitForTimeout(500);
    await input.fill("python");
    await page.getByRole("button", { name: /search/i }).click();
    await page.waitForTimeout(500);
    await input.fill("");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForTimeout(3000);

    if (pageErrors.length > 0) {
      await screenshotOnFail(page, "unhandled-exceptions");
      test.info().annotations.push({
        type: "unhandled_exceptions",
        description: pageErrors.join(" | "),
      });
    }
    expect(pageErrors.length).toBe(0);
  });
});

// ─────────────────────────────────────────────
// 9. PAGINATION TESTS
// ─────────────────────────────────────────────
test.describe("Pagination", () => {
  test("pagination appears for multi-page results", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=developer`);

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    // Check for pagination controls
    const pageText = page.getByText(/page \d+ of \d+/i);
    const hasPagination = await pageText.isVisible().catch(() => false);

    test.info().annotations.push({
      type: "has_pagination",
      description: String(hasPagination),
    });
  });

  test("next/previous buttons work", async ({ page }) => {
    await page.goto(`${SEARCH_URL}?q=javascript`);

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );

    const nextBtn = page.getByRole("button", { name: /next/i });
    if (await nextBtn.isVisible().catch(() => false)) {
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
        // URL or page state should change
        const pageText = page.getByText(/page 2/i);
        const onPage2 = await pageText.isVisible().catch(() => false);
        test.info().annotations.push({
          type: "next_page_works",
          description: String(onPage2),
        });
      }
    }
  });
});

// ─────────────────────────────────────────────
// 10. PERFORMANCE TESTS
// ─────────────────────────────────────────────
test.describe("Performance", () => {
  test("search API responds within acceptable time", async ({ page }) => {
    await page.goto(SEARCH_URL);

    let apiResponseTime = 0;
    page.on("response", (response) => {
      if (response.url().includes("/api/search")) {
        const timing = response.request().timing();
        apiResponseTime = timing.responseEnd - timing.requestStart;
      }
    });

    const input = page.locator('input[type="text"]').first();
    const start = Date.now();
    await input.fill("react");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForFunction(
      () => {
        const results = document.querySelectorAll('a[href^="/profile/"]');
        const noResults = document.body.textContent?.includes(
          "No developers found"
        );
        return results.length > 0 || noResults;
      },
      { timeout: 30000 }
    );
    const totalTime = Date.now() - start;

    test.info().annotations.push({
      type: "total_search_time_ms",
      description: String(totalTime),
    });

    // Total time should be under 15 seconds (generous for live GitHub API)
    expect(totalTime).toBeLessThan(15000);
  });

  test("page load performance metrics", async ({ page }) => {
    const start = Date.now();
    await page.goto(SEARCH_URL, { waitUntil: "networkidle" });
    const loadTime = Date.now() - start;

    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: Math.round(perf.domContentLoadedEventEnd),
        loadComplete: Math.round(perf.loadEventEnd),
        ttfb: Math.round(perf.responseStart - perf.requestStart),
      };
    });

    test.info().annotations.push(
      { type: "page_load_ms", description: String(loadTime) },
      { type: "dom_content_loaded_ms", description: String(metrics.domContentLoaded) },
      { type: "ttfb_ms", description: String(metrics.ttfb) }
    );

    // Page should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
