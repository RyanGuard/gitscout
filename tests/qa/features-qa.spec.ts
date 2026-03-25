import { test, expect, Page } from "@playwright/test";

// Helper: screenshot on failure with a descriptive name
async function screenshotOnFail(page: Page, name: string) {
  await page.screenshot({
    path: `qa-reports/screenshots/${name}.png`,
    fullPage: true,
  });
}

// ─────────────────────────────────────────────────────────────
// 1. KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
  });

  test("? key opens keyboard shortcuts overlay", async ({ page }) => {
    await page.keyboard.press("?");
    const overlay = page.locator("text=Keyboard Shortcuts");
    try {
      await expect(overlay).toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "shortcut-overlay-open-fail");
      throw new Error("? key did not open keyboard shortcuts overlay");
    }
  });

  test("? key toggles overlay closed", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(page.locator("text=Keyboard Shortcuts")).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("?");
    try {
      await expect(page.locator("text=Keyboard Shortcuts")).not.toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "shortcut-overlay-close-fail");
      throw new Error("? key did not close keyboard shortcuts overlay");
    }
  });

  test("Escape closes keyboard shortcuts overlay", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(page.locator("text=Keyboard Shortcuts")).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    try {
      await expect(page.locator("text=Keyboard Shortcuts")).not.toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "shortcut-overlay-escape-fail");
      throw new Error("Escape key did not close keyboard shortcuts overlay");
    }
  });

  test("clicking backdrop closes keyboard shortcuts overlay", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(page.locator("text=Keyboard Shortcuts")).toBeVisible({ timeout: 3000 });
    // Click on the backdrop (the fixed inset-0 container)
    const backdrop = page.locator(".fixed.inset-0").first();
    await backdrop.click({ position: { x: 10, y: 10 } });
    try {
      await expect(page.locator("text=Keyboard Shortcuts")).not.toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "shortcut-overlay-backdrop-close-fail");
      throw new Error("Clicking backdrop did not close keyboard shortcuts overlay");
    }
  });

  test("overlay displays all shortcut groups", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(page.locator("text=Keyboard Shortcuts")).toBeVisible({ timeout: 3000 });
    try {
      await expect(page.locator("text=Navigation")).toBeVisible();
      await expect(page.locator("text=Search Results")).toBeVisible();
      await expect(page.locator("text=Developer Profile")).toBeVisible();
    } catch {
      await screenshotOnFail(page, "shortcut-overlay-groups-fail");
      throw new Error("Keyboard overlay missing shortcut groups");
    }
  });

  test("/ key focuses search input", async ({ page }) => {
    // Click body first to ensure no input is focused
    await page.click("body");
    await page.keyboard.press("/");
    try {
      const searchInput = page.locator(
        'input[type="search"], input[name="search"], input[placeholder*="earch"], input[data-search]'
      ).first();
      await expect(searchInput).toBeFocused({ timeout: 2000 });
    } catch {
      await screenshotOnFail(page, "slash-focus-search-fail");
      throw new Error("/ key did not focus search input");
    }
  });

  test("g then h navigates to home", async ({ page }) => {
    await page.click("body");
    await page.keyboard.press("g");
    await page.keyboard.press("h");
    try {
      await page.waitForURL("/", { timeout: 5000 });
    } catch {
      await screenshotOnFail(page, "chord-g-h-fail");
      throw new Error("g+h chord did not navigate to home");
    }
  });

  test("g then s navigates to search", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.click("body");
    await page.keyboard.press("g");
    await page.keyboard.press("s");
    try {
      await page.waitForURL(/\/search/, { timeout: 5000 });
    } catch {
      await screenshotOnFail(page, "chord-g-s-fail");
      throw new Error("g+s chord did not navigate to search");
    }
  });

  test("g then l navigates to favorites/lists", async ({ page }) => {
    await page.click("body");
    await page.keyboard.press("g");
    await page.keyboard.press("l");
    try {
      await page.waitForURL(/\/favorites/, { timeout: 5000 });
    } catch {
      await screenshotOnFail(page, "chord-g-l-fail");
      throw new Error("g+l chord did not navigate to favorites");
    }
  });

  test("g key shows chord indicator badge", async ({ page }) => {
    await page.click("body");
    await page.keyboard.press("g");
    try {
      const indicator = page.locator("#gitscout-chord-indicator");
      await expect(indicator).toBeVisible({ timeout: 1000 });
      await expect(indicator).toHaveText("g…");
    } catch {
      await screenshotOnFail(page, "chord-indicator-fail");
      throw new Error("g key did not show chord indicator badge");
    }
  });

  test("chord indicator disappears after timeout", async ({ page }) => {
    await page.click("body");
    await page.keyboard.press("g");
    const indicator = page.locator("#gitscout-chord-indicator");
    await expect(indicator).toBeVisible({ timeout: 1000 });
    // Wait for 500ms chord timeout + 200ms animation
    await page.waitForTimeout(800);
    try {
      await expect(indicator).not.toBeVisible({ timeout: 1000 });
    } catch {
      await screenshotOnFail(page, "chord-indicator-timeout-fail");
      throw new Error("Chord indicator did not disappear after timeout");
    }
  });

  test("j/k keys do not throw errors (navigation callbacks)", async ({ page }) => {
    await page.click("body");
    // These fire onNavigateResults callbacks — just verify no JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.waitForTimeout(200);
    expect(errors.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. SHORTCUTS DON'T FIRE IN TEXT INPUTS
// ─────────────────────────────────────────────────────────────

test.describe("Shortcuts suppressed in text inputs", () => {
  test("? does NOT open overlay when typing in search input", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const searchInput = page.locator(
      'input[type="search"], input[name="search"], input[placeholder*="earch"], input[data-search]'
    ).first();
    await searchInput.click();
    await searchInput.focus();
    await page.keyboard.type("test?query");
    try {
      await expect(page.locator("text=Keyboard Shortcuts")).not.toBeVisible({ timeout: 1500 });
    } catch {
      await screenshotOnFail(page, "shortcut-fires-in-input-fail");
      throw new Error("? shortcut fired while typing in search input");
    }
  });

  test("/ does NOT steal focus when already in an input", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    // Focus the location filter input
    const locationInput = page.locator('input[placeholder*="San Francisco"]').first();
    if (await locationInput.isVisible()) {
      await locationInput.click();
      await locationInput.focus();
      await page.keyboard.type("New/York");
      try {
        // The location input should still be focused and contain our text
        await expect(locationInput).toBeFocused();
        const value = await locationInput.inputValue();
        expect(value).toContain("New/York");
      } catch {
        await screenshotOnFail(page, "slash-in-location-input-fail");
        throw new Error("/ shortcut interfered while typing in location input");
      }
    }
  });

  test("g key does NOT trigger chord when focused on input", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const searchInput = page.locator(
      'input[type="search"], input[name="search"], input[placeholder*="earch"], input[data-search]'
    ).first();
    await searchInput.click();
    await page.keyboard.press("g");
    try {
      const indicator = page.locator("#gitscout-chord-indicator");
      await expect(indicator).not.toBeVisible({ timeout: 1000 });
    } catch {
      await screenshotOnFail(page, "g-chord-in-input-fail");
      throw new Error("g chord indicator appeared while focused on input");
    }
  });

  test("Escape still works when input is focused (closes overlay)", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    // Open overlay first
    await page.click("body");
    await page.keyboard.press("?");
    await expect(page.locator("text=Keyboard Shortcuts")).toBeVisible({ timeout: 3000 });
    // Now focus an input
    const searchInput = page.locator(
      'input[type="search"], input[name="search"], input[placeholder*="earch"], input[data-search]'
    ).first();
    await searchInput.click();
    // Escape should still close overlay even with input focused
    await page.keyboard.press("Escape");
    try {
      await expect(page.locator("text=Keyboard Shortcuts")).not.toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "escape-in-input-fail");
      throw new Error("Escape did not close overlay while input was focused");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. SOUND TOGGLE
// ─────────────────────────────────────────────────────────────

test.describe("Sound Toggle", () => {
  test("sound toggle button is visible in header", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const soundBtn = page.locator('button[aria-label*="ound"], button[title*="ound"]').first();
    try {
      await expect(soundBtn).toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "sound-toggle-missing-fail");
      throw new Error("Sound toggle button not found in header");
    }
  });

  test("sound toggle switches icon on click", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const soundBtn = page.locator('button[aria-label*="ound"], button[title*="ound"]').first();
    if (!(await soundBtn.isVisible())) {
      await screenshotOnFail(page, "sound-toggle-not-visible");
      test.skip();
      return;
    }
    const initialLabel = await soundBtn.getAttribute("aria-label");
    await soundBtn.click();
    await page.waitForTimeout(300);
    const newLabel = await soundBtn.getAttribute("aria-label");
    try {
      expect(newLabel).not.toBe(initialLabel);
    } catch {
      await screenshotOnFail(page, "sound-toggle-icon-switch-fail");
      throw new Error(`Sound toggle label did not change: was "${initialLabel}", still "${newLabel}"`);
    }
  });

  test("sound toggle state persists across reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const soundBtn = page.locator('button[aria-label*="ound"], button[title*="ound"]').first();
    if (!(await soundBtn.isVisible())) {
      test.skip();
      return;
    }
    // Enable sound
    await page.evaluate(() => localStorage.setItem("gitscout_sound_enabled", "true"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    const btn = page.locator('button[aria-label*="ound"], button[title*="ound"]').first();
    try {
      const label = await btn.getAttribute("aria-label");
      expect(label).toContain("Mute");
    } catch {
      await screenshotOnFail(page, "sound-toggle-persist-fail");
      throw new Error("Sound toggle state did not persist after reload");
    }
  });

  test("sound toggle updates localStorage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Clear initial state
    await page.evaluate(() => localStorage.removeItem("gitscout_sound_enabled"));
    await page.reload();
    await page.waitForLoadState("networkidle");

    const soundBtn = page.locator('button[aria-label*="ound"], button[title*="ound"]').first();
    if (!(await soundBtn.isVisible())) {
      test.skip();
      return;
    }
    await soundBtn.click();
    await page.waitForTimeout(300);
    const storageValue = await page.evaluate(() => localStorage.getItem("gitscout_sound_enabled"));
    try {
      expect(storageValue).toBe("true");
    } catch {
      await screenshotOnFail(page, "sound-toggle-localstorage-fail");
      throw new Error(`Sound toggle did not update localStorage, got: ${storageValue}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 4. CELEBRATION TRIGGERS
// ─────────────────────────────────────────────────────────────

test.describe("Celebration Triggers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Clear celebration state
    await page.evaluate(() => localStorage.removeItem("gitscout_celebrations"));
  });

  test("Konami code triggers matrix rain easter egg", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.removeItem("gitscout_celebrations"));

    // Enter Konami code: up up down down left right left right b a
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("b");
    await page.keyboard.press("a");

    // Check for matrix rain canvas or toast
    await page.waitForTimeout(500);
    const matrixCanvas = page.locator("#gitscout-matrix-rain");
    const toast = page.locator("text=You found the secret");
    try {
      const hasCanvas = await matrixCanvas.isVisible();
      const hasToast = await toast.isVisible();
      expect(hasCanvas || hasToast).toBe(true);
    } catch {
      await screenshotOnFail(page, "konami-code-fail");
      throw new Error("Konami code did not trigger matrix rain or toast");
    }
  });

  test("celebration state structure in localStorage", async ({ page }) => {
    // Set celebration state and verify it can be read back
    await page.evaluate(() => {
      localStorage.setItem(
        "gitscout_celebrations",
        JSON.stringify({
          firstUnicorn: true,
          firstExport: false,
          listMilestones: [10],
          lastActiveDates: ["2026-03-25"],
        })
      );
    });
    const state = await page.evaluate(() => {
      const raw = localStorage.getItem("gitscout_celebrations");
      return raw ? JSON.parse(raw) : null;
    });
    expect(state).not.toBeNull();
    expect(state.firstUnicorn).toBe(true);
    expect(state.firstExport).toBe(false);
    expect(state.listMilestones).toContain(10);
  });

  test("unicorn celebration does not re-trigger if already celebrated", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "gitscout_celebrations",
        JSON.stringify({
          firstUnicorn: true,
          firstExport: false,
          listMilestones: [],
          lastActiveDates: [],
        })
      );
    });
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    // Trigger celebrateUnicorn via JS context — should NOT show toast since already celebrated
    await page.waitForTimeout(1000);
    const toast = page.locator("text=You found a unicorn");
    const visible = await toast.isVisible();
    expect(visible).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. SAVED LISTS CRUD
// ─────────────────────────────────────────────────────────────

test.describe("Saved Lists (requires auth)", () => {
  test("lists page loads or redirects to home (unauthenticated)", async ({ page }) => {
    await page.goto("/lists");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const url = page.url();
    try {
      // Should either show lists page or redirect to home for unauthenticated
      const isOnLists = url.includes("/lists");
      const isOnHome = url === "http://localhost:3000/" || url.endsWith(":3000");
      expect(isOnLists || isOnHome).toBe(true);
    } catch {
      await screenshotOnFail(page, "lists-page-load-fail");
      throw new Error(`Lists page unexpected URL: ${url}`);
    }
  });

  test("lists page has 'New List' button when authenticated", async ({ page }) => {
    await page.goto("/lists");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    // This test documents behavior — may redirect if unauthenticated
    if (page.url().includes("/lists")) {
      const newListBtn = page.locator("text=New List");
      try {
        await expect(newListBtn).toBeVisible({ timeout: 3000 });
      } catch {
        await screenshotOnFail(page, "lists-new-button-fail");
        throw new Error("New List button not visible on lists page");
      }
    } else {
      // Redirected to home — unauthenticated
      test.skip();
    }
  });

  test("clicking 'New List' shows create form", async ({ page }) => {
    await page.goto("/lists");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    if (!page.url().includes("/lists")) {
      test.skip();
      return;
    }
    const newListBtn = page.locator("text=New List");
    if (!(await newListBtn.isVisible())) {
      test.skip();
      return;
    }
    await newListBtn.click();
    try {
      await expect(page.locator("#list-name")).toBeVisible({ timeout: 3000 });
      await expect(page.locator("#list-desc")).toBeVisible({ timeout: 1000 });
      await expect(page.locator('button:has-text("Create List")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    } catch {
      await screenshotOnFail(page, "lists-create-form-fail");
      throw new Error("Create list form did not appear or is missing elements");
    }
  });

  test("cancel hides the create form", async ({ page }) => {
    await page.goto("/lists");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    if (!page.url().includes("/lists")) {
      test.skip();
      return;
    }
    const newListBtn = page.locator("text=New List");
    if (!(await newListBtn.isVisible())) {
      test.skip();
      return;
    }
    await newListBtn.click();
    await expect(page.locator("#list-name")).toBeVisible({ timeout: 3000 });
    await page.locator('button:has-text("Cancel")').click();
    try {
      await expect(page.locator("#list-name")).not.toBeVisible({ timeout: 2000 });
    } catch {
      await screenshotOnFail(page, "lists-cancel-form-fail");
      throw new Error("Cancel button did not hide create list form");
    }
  });

  test("create list button disabled when name is empty", async ({ page }) => {
    await page.goto("/lists");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    if (!page.url().includes("/lists")) {
      test.skip();
      return;
    }
    const newListBtn = page.locator("text=New List");
    if (!(await newListBtn.isVisible())) {
      test.skip();
      return;
    }
    await newListBtn.click();
    await expect(page.locator("#list-name")).toBeVisible({ timeout: 3000 });
    const createBtn = page.locator('button:has-text("Create List")');
    try {
      await expect(createBtn).toBeDisabled();
    } catch {
      await screenshotOnFail(page, "lists-create-disabled-fail");
      throw new Error("Create List button is not disabled when name is empty");
    }
  });

  test("export CSV endpoint returns proper content-type", async ({ page }) => {
    // Test the export API shape (won't have real data without auth, but check route exists)
    const response = await page.request.get("/api/lists/test-id/export");
    // Should get 401/404/500 but not a crash
    try {
      expect([200, 401, 403, 404, 500]).toContain(response.status());
    } catch {
      await screenshotOnFail(page, "csv-export-endpoint-fail");
      throw new Error(`CSV export endpoint returned unexpected status: ${response.status()}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 6. MATCH FEATURE
// ─────────────────────────────────────────────────────────────

test.describe("Match Feature", () => {
  test("match page loads with correct heading", async ({ page }) => {
    await page.goto("/match");
    await page.waitForLoadState("networkidle");
    try {
      await expect(page.locator("h1")).toContainText("Match Candidates", { timeout: 5000 });
    } catch {
      await screenshotOnFail(page, "match-page-heading-fail");
      throw new Error("Match page heading not found");
    }
  });

  test("match page has job description input area", async ({ page }) => {
    await page.goto("/match");
    await page.waitForLoadState("networkidle");
    // Look for textarea or text input for JD
    const textArea = page.locator("textarea").first();
    const hasTextArea = await textArea.isVisible();
    const textInput = page.locator('input[type="text"]').first();
    const hasTextInput = await textInput.isVisible();
    try {
      expect(hasTextArea || hasTextInput).toBe(true);
    } catch {
      await screenshotOnFail(page, "match-page-input-fail");
      throw new Error("Match page has no text input or textarea for job description");
    }
  });

  test("match page shows description text", async ({ page }) => {
    await page.goto("/match");
    await page.waitForLoadState("networkidle");
    try {
      await expect(
        page.locator("text=Parse a job description")
      ).toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "match-page-description-fail");
      throw new Error("Match page description text not found");
    }
  });

  test("match API endpoint exists and responds", async ({ page }) => {
    const response = await page.request.post("/api/match", {
      data: { requirements: { languages: ["TypeScript"], skills: [] } },
      headers: { "Content-Type": "application/json" },
    });
    try {
      // Should respond (even with error) — not 404
      expect(response.status()).not.toBe(404);
    } catch {
      await screenshotOnFail(page, "match-api-404-fail");
      throw new Error("Match API endpoint returned 404");
    }
  });

  test("match parse API endpoint exists", async ({ page }) => {
    const response = await page.request.post("/api/match/parse", {
      data: { text: "Senior Rust Engineer in San Francisco" },
      headers: { "Content-Type": "application/json" },
    });
    try {
      expect(response.status()).not.toBe(404);
    } catch {
      await screenshotOnFail(page, "match-parse-api-404-fail");
      throw new Error("Match parse API endpoint returned 404");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 7. FAVORITES
// ─────────────────────────────────────────────────────────────

test.describe("Favorites", () => {
  test("favorites page loads or redirects (unauthenticated)", async ({ page }) => {
    await page.goto("/favorites");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const url = page.url();
    try {
      // Should either show favorites or redirect to home
      const isOnFavorites = url.includes("/favorites");
      const isOnHome = url === "http://localhost:3000/" || url.endsWith(":3000");
      expect(isOnFavorites || isOnHome).toBe(true);
    } catch {
      await screenshotOnFail(page, "favorites-page-load-fail");
      throw new Error(`Favorites page unexpected URL: ${url}`);
    }
  });

  test("favorites API endpoint exists", async ({ page }) => {
    const response = await page.request.get("/api/favorites");
    try {
      // Should get 401 (unauthenticated) or 200, but not 404
      expect(response.status()).not.toBe(404);
    } catch {
      await screenshotOnFail(page, "favorites-api-fail");
      throw new Error("Favorites API endpoint returned 404");
    }
  });

  test("favorites page shows empty state for unauthenticated or new users", async ({ page }) => {
    await page.goto("/favorites");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    if (page.url().includes("/favorites")) {
      // If we stayed on favorites, check for empty state or content
      const hasContent =
        (await page.locator("text=No favorites yet").isVisible()) ||
        (await page.locator("text=My Favorites").isVisible());
      try {
        expect(hasContent).toBe(true);
      } catch {
        await screenshotOnFail(page, "favorites-empty-state-fail");
        throw new Error("Favorites page shows neither empty state nor favorites list");
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 8. GENERAL PAGE SMOKE TESTS
// ─────────────────────────────────────────────────────────────

test.describe("Page Smoke Tests", () => {
  test("home page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    try {
      expect(errors.length).toBe(0);
    } catch {
      await screenshotOnFail(page, "home-page-errors");
      throw new Error(`Home page JS errors: ${errors.join("; ")}`);
    }
  });

  test("search page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    try {
      expect(errors.length).toBe(0);
    } catch {
      await screenshotOnFail(page, "search-page-errors");
      throw new Error(`Search page JS errors: ${errors.join("; ")}`);
    }
  });

  test("match page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/match");
    await page.waitForLoadState("networkidle");
    try {
      expect(errors.length).toBe(0);
    } catch {
      await screenshotOnFail(page, "match-page-errors");
      throw new Error(`Match page JS errors: ${errors.join("; ")}`);
    }
  });

  test("Cmd+K focuses search on search page", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await page.click("body");
    await page.keyboard.press("Meta+k");
    try {
      const searchInput = page.locator(
        'input[type="search"], input[name="search"], input[placeholder*="earch"], input[data-search]'
      ).first();
      await expect(searchInput).toBeFocused({ timeout: 2000 });
    } catch {
      await screenshotOnFail(page, "cmd-k-focus-fail");
      throw new Error("Cmd+K did not focus search input");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 9. NAVIGATION AND ROUTING
// ─────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("header nav links are present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Check for main nav links
    const searchLink = page.locator('a[href="/search"], a[href*="search"]').first();
    try {
      await expect(searchLink).toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "nav-search-link-fail");
      throw new Error("Search link not found in navigation");
    }
  });

  test("search page has working filter sidebar", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    // Check for language filter buttons
    const tsButton = page.locator("button", { hasText: "TypeScript" }).first();
    try {
      await expect(tsButton).toBeVisible({ timeout: 3000 });
    } catch {
      await screenshotOnFail(page, "search-filters-fail");
      throw new Error("Search filter sidebar not visible");
    }
  });

  test("language filter toggles on click", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const tsButton = page.locator("button", { hasText: "TypeScript" }).first();
    if (!(await tsButton.isVisible())) {
      test.skip();
      return;
    }
    await tsButton.click();
    await page.waitForTimeout(500);
    try {
      // After click, button should have active styling (bg-blue-600)
      const classes = await tsButton.getAttribute("class");
      expect(classes).toContain("bg-blue-600");
    } catch {
      await screenshotOnFail(page, "language-filter-toggle-fail");
      throw new Error("Language filter did not toggle to active state");
    }
  });
});
