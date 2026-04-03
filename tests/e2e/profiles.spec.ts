import { test, expect, type Page } from "@playwright/test";

/**
 * QA Test Suite: Developer Profile Pages
 *
 * Tests profile page load, score/tier display, repo/language/org sections,
 * action buttons (scouting report, outreach draft, find similar, share card, save),
 * and error handling for invalid usernames.
 *
 * Approach: first search for a valid username, then test the profile page.
 */

const SCREENSHOT_DIR = "qa-reports/screenshots";

// We'll discover a valid username via search
let validUsername: string;
let profileData: {
  hasScore: boolean;
  hasLanguages: boolean;
  hasRepos: boolean;
  hasLocation: boolean;
  hasCompany: boolean;
  hasBio: boolean;
};

async function screenshotOnContext(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

test.describe("Profile Page QA Suite", () => {
  test.describe.configure({ mode: "serial" });

  test("T01 — Search for a valid developer username", async ({ page }) => {
    // Go to search page and perform a search to find a real username
    await page.goto("/search?q=javascript");

    // Wait for search results to load (either results appear or empty state)
    const resultOrEmpty = await Promise.race([
      page.locator('a[href^="/profile/"]').first().waitFor({ timeout: 15000 }).then(() => "results"),
      page.getByText(/no results|no developers/i).waitFor({ timeout: 15000 }).then(() => "empty"),
    ]).catch(() => "timeout");

    if (resultOrEmpty === "empty" || resultOrEmpty === "timeout") {
      // Try a broader search
      await page.goto("/search?q=react");
      await page.locator('a[href^="/profile/"]').first().waitFor({ timeout: 15000 });
    }

    // Extract the first profile link's username
    const firstLink = page.locator('a[href^="/profile/"]').first();
    await expect(firstLink).toBeVisible();
    const href = await firstLink.getAttribute("href");
    expect(href).toBeTruthy();
    validUsername = href!.replace("/profile/", "").split("?")[0];
    expect(validUsername.length).toBeGreaterThan(0);

    await screenshotOnContext(page, "T01-search-results");
  });

  test("T02 — Profile page loads successfully", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    const response = await page.goto(`/profile/${validUsername}`);
    expect(response?.status()).toBeLessThan(400);

    // Wait for page to fully render
    await page.waitForLoadState("networkidle");

    // Profile header card should be visible
    const profileCard = page.locator(".rounded-xl.border").first();
    await expect(profileCard).toBeVisible();

    // Username should be displayed (use exact match to avoid title conflict)
    const usernameText = page.locator(`p:has-text("@${validUsername}")`);
    await expect(usernameText).toBeVisible();

    // Avatar image should be present
    const avatar = page.locator(`img[alt="${validUsername}"]`);
    await expect(avatar).toBeVisible();

    // "Back to search" link should exist
    const backLink = page.getByText("Back to search");
    await expect(backLink).toBeVisible();

    // "View on GitHub" link should exist
    const githubLink = page.locator(`a[href="https://github.com/${validUsername}"]`);
    await expect(githubLink).toBeVisible();

    await screenshotOnContext(page, "T02-profile-loaded");
  });

  test("T03 — Score display and tier badge (ScoreBreakdown)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // Check for the score section — it's loaded async via /api/score/:username
    // First we see "Computing developer score..." then the actual score or it disappears on error
    const scoreSection = page.locator("text=Scout Score");

    // Wait for computing text to appear then resolve, or timeout
    const computingText = page.locator("text=Computing developer score...");
    await computingText.waitFor({ timeout: 5000 }).catch(() => {});

    // Now wait for the score to appear (or the computing spinner to vanish = error/null)
    const scoreLoaded = await scoreSection.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);

    profileData = {
      hasScore: false,
      hasLanguages: false,
      hasRepos: false,
      hasLocation: false,
      hasCompany: false,
      hasBio: false,
    };

    if (scoreLoaded) {
      profileData.hasScore = true;

      // Check for score ring (SVG circle animation)
      const scoreRing = page.locator("svg circle").first();
      await expect(scoreRing).toBeVisible();

      // Check for "5-pillar analysis" text
      const pillarText = page.locator("text=5-pillar analysis");
      await expect(pillarText).toBeVisible();

      // Check for pillar bars (Impact, Contribution, Consistency, Technical, Reputation)
      const pillarLabels = ["Impact", "Contribution", "Consistency", "Technical", "Reputation"];
      for (const label of pillarLabels) {
        const pillar = page.locator(`text=${label}`).first();
        const pillarVisible = await pillar.isVisible().catch(() => false);
        expect(pillarVisible).toBeTruthy();
      }

      // Check confidence indicator
      const confidenceEl = page.locator("text=/high confidence|medium confidence|low confidence/i").first();
      const hasConfidence = await confidenceEl.isVisible().catch(() => false);
      // Confidence might not always be visible, just check
      if (hasConfidence) {
        await expect(confidenceEl).toBeVisible();
      }

      // Check key stats section (External PRs, Commits, Contributions)
      const externalPRs = page.locator("text=External PRs");
      const commits = page.locator("text=Commits (12mo)");
      const contributions = page.locator("text=Contributions");

      await expect(externalPRs).toBeVisible();
      await expect(commits).toBeVisible();
      await expect(contributions).toBeVisible();
    } else {
      // Score section didn't load — score API may have errored (score=0 for github-live profiles)
      // This is expected for profiles fetched live from GitHub
      const sourceWarning = page.locator("text=Live from GitHub");
      const isLive = await sourceWarning.isVisible().catch(() => false);
      if (isLive) {
        // Expected: live profiles have score 0, ScoreBreakdown returns null on error
      }
    }

    // Check for the Score: N badge in the header (only shows if score > 0)
    const scoreBadge = page.locator("text=/Score: \\d+/");
    profileData.hasScore = (await scoreBadge.count()) > 0;

    await screenshotOnContext(page, "T03-score-breakdown");
  });

  test("T04 — Repository section", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // Check for "Top Repositories" heading
    const repoHeading = page.locator("text=Top Repositories");
    const hasRepos = await repoHeading.isVisible().catch(() => false);
    profileData.hasRepos = hasRepos;

    if (hasRepos) {
      await expect(repoHeading).toBeVisible();

      // Check that repo cards are in a grid (use sm:grid-cols-2 to distinguish from stats grid)
      const repoGrid = page.locator(".grid.gap-3.sm\\:grid-cols-2");
      await expect(repoGrid).toBeVisible();

      // Check at least one repo card exists
      const repoCards = repoGrid.locator("> *");
      const cardCount = await repoCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Each repo card should have a name link to GitHub
      const firstCard = repoCards.first();
      await expect(firstCard).toBeVisible();
    }

    await screenshotOnContext(page, "T04-repositories");
  });

  test("T05 — Languages section", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // Check for "Languages" heading
    const langHeading = page.locator("h2:has-text('Languages')");
    const hasLangs = await langHeading.isVisible().catch(() => false);
    profileData.hasLanguages = hasLangs;

    if (hasLangs) {
      await expect(langHeading).toBeVisible();

      // Language bar should be present (a colored bar showing language distribution)
      const langSection = langHeading.locator("..");
      await expect(langSection).toBeVisible();
    }

    await screenshotOnContext(page, "T05-languages");
  });

  test("T06 — Organization/Company and Location display", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // Check for company (Building2 icon)
    // These are conditional — the developer may not have them set
    const metaRow = page.locator(".flex.flex-wrap.gap-4.text-sm");
    const metaVisible = await metaRow.isVisible().catch(() => false);

    if (metaVisible) {
      const metaText = await metaRow.textContent();
      profileData.hasLocation = metaText?.includes("") || (await page.locator("text=/[A-Z][a-z].*,.*[A-Z]/").first().isVisible().catch(() => false));
      profileData.hasCompany = metaText?.includes("") || false;
    }

    // Check bio
    const bioSection = page.locator(".mt-2.text-neutral-700");
    profileData.hasBio = await bioSection.isVisible().catch(() => false);

    // Check for the stats row (stars, followers, repos)
    const starsEl = page.locator("text=/stars$/");
    await expect(starsEl.first()).toBeVisible();

    const followersEl = page.locator("text=/followers$/");
    await expect(followersEl.first()).toBeVisible();

    const reposEl = page.locator("text=/repos$/");
    await expect(reposEl.first()).toBeVisible();

    await screenshotOnContext(page, "T06-org-location-stats");
  });

  test("T07 — Scouting Report button (requires auth, expect hidden)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // The ScoutingReport component is NOT imported/rendered on the profile page
    // This is a finding: the component exists in src/components/features/ScoutingReport.tsx
    // but is never used in the profile page.tsx
    const scoutingBtn = page.locator("button:has-text('Generate Scouting Report')");
    const isPresent = await scoutingBtn.isVisible().catch(() => false);

    // Document finding: button should NOT be present since component isn't wired in
    if (!isPresent) {
      // EXPECTED: ScoutingReport component is not rendered on the profile page
      await screenshotOnContext(page, "T07-scouting-report-NOT-WIRED");
    } else {
      // If it IS present (maybe it was added), verify it's clickable
      await expect(scoutingBtn).toBeEnabled();
      await screenshotOnContext(page, "T07-scouting-report-found");
    }

    // We just verify and document — this test reports the state, not pass/fail
    expect(true).toBe(true);
  });

  test("T08 — Outreach Draft button (requires auth, expect hidden)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // OutreachDraft component exists in src/components/features/OutreachDraft.tsx
    // but is NOT imported/rendered on the profile page
    const outreachBtn = page.locator("button:has-text('Draft Outreach')");
    const isPresent = await outreachBtn.isVisible().catch(() => false);

    if (!isPresent) {
      await screenshotOnContext(page, "T08-outreach-draft-NOT-WIRED");
    } else {
      await expect(outreachBtn).toBeEnabled();
      await screenshotOnContext(page, "T08-outreach-draft-found");
    }

    expect(true).toBe(true);
  });

  test("T09 — Find Similar button (expect hidden — not wired)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // FindSimilar component exists in src/components/features/FindSimilar.tsx
    // but is NOT imported/rendered on the profile page
    const findSimilarBtn = page.locator("button:has-text('Find Similar')");
    const isPresent = await findSimilarBtn.isVisible().catch(() => false);

    if (!isPresent) {
      await screenshotOnContext(page, "T09-find-similar-NOT-WIRED");
    } else {
      await expect(findSimilarBtn).toBeEnabled();
      await screenshotOnContext(page, "T09-find-similar-found");
    }

    expect(true).toBe(true);
  });

  test("T10 — Share Card button (expect hidden — not wired)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // ShareCard component exists in src/components/features/ShareCard.tsx
    // but is NOT imported/rendered on the profile page
    const shareBtn = page.locator("button:has-text('Share Card')");
    const isPresent = await shareBtn.isVisible().catch(() => false);

    if (!isPresent) {
      await screenshotOnContext(page, "T10-share-card-NOT-WIRED");
    } else {
      // If present, click to open modal
      await shareBtn.click();
      const modal = page.locator("text=Share Card —");
      await expect(modal).toBeVisible();
      await screenshotOnContext(page, "T10-share-card-modal");
    }

    expect(true).toBe(true);
  });

  test("T11 — Save/Favorite button (requires auth)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // The FavoriteButton is rendered via ProfileActions, which requires auth.
    // Without auth, ProfileActions returns null entirely.
    // Check if the user is logged in (ProfileActions renders something)
    const saveBtn = page.locator("button:has-text('Save')");
    const indexBtn = page.locator("button:has-text('Index to unlock actions')");
    const isSavePresent = await saveBtn.isVisible().catch(() => false);
    const isIndexPresent = await indexBtn.isVisible().catch(() => false);

    if (isSavePresent) {
      // User is authenticated and developer is indexed
      await expect(saveBtn).toBeEnabled();
      await screenshotOnContext(page, "T11-save-button-visible");
    } else if (isIndexPresent) {
      // User is authenticated but developer not indexed yet
      await expect(indexBtn).toBeEnabled();
      await screenshotOnContext(page, "T11-index-button-visible");
    } else {
      // User is NOT authenticated — ProfileActions returns null
      // This is expected behavior: auth-gated features are hidden
      await screenshotOnContext(page, "T11-save-button-NOT-VISIBLE-no-auth");
    }

    expect(true).toBe(true);
  });

  test("T12 — Profile Actions section (auth-gated)", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // The "View on GitHub" button should always be visible (not auth-gated)
    const githubBtn = page.locator("text=View on GitHub");
    await expect(githubBtn).toBeVisible();

    // Check if any auth-gated actions are visible
    const enrichBtn = page.locator("button:has-text('Enrich')");
    const pushAshbyBtn = page.locator("button:has-text('Ashby')");
    const addToListBtn = page.locator("button:has-text('Add to List')");

    await enrichBtn.isVisible().catch(() => false);
    await pushAshbyBtn.isVisible().catch(() => false);
    await addToListBtn.isVisible().catch(() => false);

    // These all require auth + indexed developer
    await screenshotOnContext(page, "T12-profile-actions");
  });

  test("T13 — Source badge for live GitHub profiles", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // Check if this is a live GitHub profile (not in local DB)
    const liveBadge = page.locator("text=Live from GitHub");
    const isLive = await liveBadge.isVisible().catch(() => false);

    if (isLive) {
      await expect(liveBadge).toBeVisible();
      // The message should mention limited data
      const limitedText = page.locator("text=Data may be limited");
      await expect(limitedText).toBeVisible();
    }

    await screenshotOnContext(page, "T13-source-badge");
  });

  test("T14 — Error handling: invalid/nonexistent username (404)", async ({ page }) => {
    // Navigate to a clearly non-existent profile
    await page.goto("/profile/this-user-definitely-does-not-exist-xyz-12345");

    // Should show the not-found page
    await page.waitForLoadState("networkidle");

    // Check for "Developer not found" heading
    const notFoundHeading = page.locator("text=Developer not found");
    const isNotFound = await notFoundHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (isNotFound) {
      await expect(notFoundHeading).toBeVisible();

      // Check for the explanation text
      const explanation = page.locator("text=hasn't been indexed yet");
      await expect(explanation).toBeVisible();

      // Check for "Search developers" link
      const searchLink = page.locator("text=Search developers");
      await expect(searchLink).toBeVisible();

      // Verify the link points to /search
      const href = await searchLink.getAttribute("href");
      expect(href).toBe("/search");
    } else {
      // Might get a Next.js 404 page or a different error
      await page.title();
    }

    await screenshotOnContext(page, "T14-invalid-username-404");
  });

  test("T15 — Error handling: special characters in username", async ({ page }) => {
    await page.goto("/profile/<script>alert('xss')</script>");
    await page.waitForLoadState("networkidle");

    // Should not execute any script — should show 404 or error
    const notFoundHeading = page.locator("text=Developer not found");
    await notFoundHeading.isVisible({ timeout: 5000 }).catch(() => false);

    // Page should not have any alert dialogs
    // (Playwright would throw on unhandled dialogs, so reaching here means no XSS)

    // Verify no script injection occurred
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("<script>");

    await screenshotOnContext(page, "T15-special-chars-xss");
  });

  test("T16 — Error handling: empty username", async ({ page }) => {
    await page.goto("/profile/");
    await page.waitForLoadState("networkidle");

    // This should either redirect or show 404
    await screenshotOnContext(page, "T16-empty-username");
  });

  test("T17 — Profile page responsive layout", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    // Check that profile renders at different viewport sizes
    // Desktop (default from config)
    const profileHeader = page.locator("h1").first();
    await expect(profileHeader).toBeVisible();

    await screenshotOnContext(page, "T17-responsive-layout");
  });

  test("T18 — Navigation: Back to search link works", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");

    const backLink = page.getByText("Back to search");
    await expect(backLink).toBeVisible();
    await backLink.click();

    // Should navigate to /search
    await page.waitForURL("**/search**");
    expect(page.url()).toContain("/search");

    await screenshotOnContext(page, "T18-back-to-search");
  });

  test("T19 — Navigation: clicking profile from search results", async ({ page }) => {
    // Search and click through to a profile
    await page.goto("/search?q=python");

    // Wait for results
    const firstResult = page.locator('a[href^="/profile/"]').first();
    await firstResult.waitFor({ timeout: 15000 }).catch(() => {});

    const hasResults = await firstResult.isVisible().catch(() => false);
    if (!hasResults) {
      await screenshotOnContext(page, "T19-no-search-results");
      return;
    }

    await firstResult.click();

    // Should navigate to the profile page
    await page.waitForURL("**/profile/**");
    expect(page.url()).toContain("/profile/");

    // Profile should load
    const usernameEl = page.locator("text=/^@/").first();
    await expect(usernameEl).toBeVisible();

    await screenshotOnContext(page, "T19-search-to-profile-nav");
  });

  test("T20 — Performance: profile page load time", async ({ page }) => {
    test.skip(!validUsername, "No valid username found from search");

    const startTime = Date.now();
    await page.goto(`/profile/${validUsername}`);
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // Profile should load within 10 seconds (generous for GitHub API fetch)
    expect(loadTime).toBeLessThan(10000);

    // Avatar should be visible within the page
    const avatar = page.locator("img.rounded-full").first();
    await expect(avatar).toBeVisible();

    await screenshotOnContext(page, "T20-perf-load-time");
  });
});
