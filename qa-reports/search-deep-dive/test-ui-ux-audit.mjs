/**
 * UX QA Audit — Search Page Deep Dive
 * Captures: states, interactions, responsive, dark theme
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const SHOTS = '/Users/ryanguard/gitscout/qa-reports/search-deep-dive/screenshots';

const findings = {
  states: {},
  cardFields: [],
  interactions: {},
  responsive: {},
  darkTheme: {},
  issues: [],
};

function log(msg) {
  console.log(`[QA] ${msg}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ─── 1. PAGE STATES ───────────────────────────────────────────────
  log('=== SECTION 1: Page States ===');

  // 1a. Empty state — search page with no query
  {
    log('Capturing empty state...');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await page.screenshot({ path: `${SHOTS}/states/01-empty-state.png`, fullPage: true });

    // Document what's visible in empty state
    const emptyText = await page.textContent('body');
    findings.states.empty = {
      url: page.url(),
      hasSearchBar: await page.locator('input[type="text"], input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').count() > 0,
      hasFilters: (emptyText.includes('Sort') || emptyText.includes('Filter') || emptyText.includes('Language')),
      bodySnippet: emptyText.substring(0, 500).replace(/\s+/g, ' ').trim(),
    };
    log(`  Empty state captured. URL: ${page.url()}`);
    await ctx.close();
  }

  // 1b. Loading state — capture mid-search
  {
    log('Capturing loading state...');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await sleep(500);

    // Type the query and capture loading state immediately
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('TypeScript San Francisco');
      // Try pressing Enter and immediately screenshot for loading state
      await searchInput.press('Enter');
      await sleep(300); // Brief pause to catch loading indicators
      await page.screenshot({ path: `${SHOTS}/states/02-loading-state.png`, fullPage: true });
      findings.states.loading = {
        captured: true,
        note: 'Screenshot taken 300ms after search submit to catch loading indicators',
      };
      log('  Loading state captured.');
    } else {
      // Fallback: navigate directly with query param
      await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`);
      await sleep(200);
      await page.screenshot({ path: `${SHOTS}/states/02-loading-state.png`, fullPage: true });
      findings.states.loading = { captured: true, note: 'Used direct URL navigation' };
    }
    await ctx.close();
  }

  // 1c. Results state — wait for full results
  {
    log('Capturing results state...');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000); // Wait for API results
    await page.screenshot({ path: `${SHOTS}/states/03-results-state.png`, fullPage: true });

    // Count results
    const bodyText = await page.textContent('body');
    const resultsMatch = bodyText.match(/(\d+)\s*developer/i);
    findings.states.results = {
      url: page.url(),
      resultCountText: resultsMatch ? resultsMatch[0] : 'not found',
      hasCards: await page.locator('[class*="card"], [class*="Card"], [class*="developer"], [class*="Developer"]').count(),
    };

    // ─── 2. DOCUMENT CARD FIELDS ──────────────────────────────────
    log('=== SECTION 2: Documenting Result Card Fields ===');

    // Get all card-like containers
    const cards = page.locator('a[href*="/profile/"], div[class*="card"], div[class*="Card"]');
    const cardCount = await cards.count();
    log(`  Found ${cardCount} potential card elements`);

    if (cardCount > 0) {
      // Screenshot a single card closely
      const firstCard = cards.first();
      await firstCard.scrollIntoViewIfNeeded();
      await sleep(300);
      try {
        await firstCard.screenshot({ path: `${SHOTS}/states/04-single-card-detail.png` });
      } catch {
        log('  Could not screenshot individual card, using full page');
      }
    }

    // Extract detailed card field information by inspecting DOM
    const cardData = await page.evaluate(() => {
      const results = [];
      // Look for developer card links
      const cardLinks = document.querySelectorAll('a[href*="/profile/"]');
      const seen = new Set();

      for (const card of Array.from(cardLinks).slice(0, 5)) {
        const href = card.getAttribute('href');
        if (seen.has(href)) continue;
        seen.add(href);

        const text = card.textContent || '';

        // Extract structured data from the card
        const data = {
          href,
          fullText: text.replace(/\s+/g, ' ').trim().substring(0, 500),
        };

        // Look for specific elements within the card
        const img = card.querySelector('img');
        if (img) data.avatar = { src: img.src, alt: img.alt };

        // Look for score/badge elements
        const allSpans = card.querySelectorAll('span, p, h2, h3, h4, div');
        const fieldTexts = [];
        for (const el of allSpans) {
          const t = el.textContent?.trim();
          if (t && t.length > 0 && t.length < 100) {
            fieldTexts.push({ tag: el.tagName, classes: el.className?.substring?.(0, 80), text: t });
          }
        }
        data.elements = fieldTexts.slice(0, 40);

        // Look for SVG icons (lucide icons)
        const svgs = card.querySelectorAll('svg');
        data.iconCount = svgs.length;

        results.push(data);
      }
      return results;
    });

    findings.cardFields = cardData;
    log(`  Extracted field data from ${cardData.length} cards`);

    // Also capture the filter sidebar
    await page.screenshot({ path: `${SHOTS}/states/05-filters-sidebar.png`, fullPage: false, clip: { x: 0, y: 0, width: 350, height: 900 } });

    await ctx.close();
  }

  // 1d. Error state — force an error by using bad API params
  {
    log('Capturing error state...');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Try to trigger error state - block the API call
    await page.route('**/api/search**', route => route.abort());
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    await page.screenshot({ path: `${SHOTS}/states/06-error-state.png`, fullPage: true });

    const errorText = await page.textContent('body');
    findings.states.error = {
      note: 'Triggered by blocking /api/search requests',
      hasErrorMessage: /error|failed|sorry|try again|went wrong/i.test(errorText),
      visibleText: errorText.replace(/\s+/g, ' ').trim().substring(0, 300),
    };
    log(`  Error state captured. Has error message: ${findings.states.error.hasErrorMessage}`);
    await ctx.close();
  }

  // ─── 3. INTERACTIONS ──────────────────────────────────────────────
  log('=== SECTION 3: Interaction Tests ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);

    // 3a. Click a result card
    log('  Testing: Click result card...');
    const resultLink = page.locator('a[href*="/profile/"]').first();
    if (await resultLink.count() > 0) {
      const href = await resultLink.getAttribute('href');
      await resultLink.click();
      await sleep(2000);
      await page.screenshot({ path: `${SHOTS}/interactions/01-clicked-result.png`, fullPage: true });
      findings.interactions.clickResult = {
        navigatedTo: page.url(),
        expectedProfile: href,
        success: page.url().includes('/profile/'),
      };
      log(`    Navigated to: ${page.url()}`);

      // 3b. Browser back
      log('  Testing: Browser back...');
      await page.goBack();
      await sleep(2000);
      await page.screenshot({ path: `${SHOTS}/interactions/02-browser-back.png`, fullPage: true });
      findings.interactions.browserBack = {
        returnedTo: page.url(),
        preservedQuery: page.url().includes('TypeScript') || page.url().includes('q='),
        success: page.url().includes('/search'),
      };
      log(`    Returned to: ${page.url()}, query preserved: ${findings.interactions.browserBack.preservedQuery}`);
    } else {
      findings.interactions.clickResult = { success: false, note: 'No result links found' };
      findings.interactions.browserBack = { success: false, note: 'Skipped — no results to click' };
    }

    // 3c. Save/Favorite button
    log('  Testing: Save/Favorite button...');
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);

    // Look for favorite/save buttons (heart icons, bookmark icons, or buttons with save text)
    const favBtn = page.locator('button:has(svg), [class*="favorite"], [class*="Favorite"], [aria-label*="save"], [aria-label*="favorite"]');
    const favCount = await favBtn.count();
    findings.interactions.saveButton = {
      found: favCount > 0,
      count: favCount,
    };

    if (favCount > 0) {
      // Look specifically on result cards for a save button
      const cardFavBtn = page.locator('a[href*="/profile/"]').first().locator('button').first();
      if (await cardFavBtn.count() > 0) {
        try {
          await cardFavBtn.click();
          await sleep(1000);
          await page.screenshot({ path: `${SHOTS}/interactions/03-save-button-clicked.png`, fullPage: false });
          findings.interactions.saveButton.clicked = true;
        } catch (e) {
          findings.interactions.saveButton.clicked = false;
          findings.interactions.saveButton.error = e.message.substring(0, 100);
        }
      } else {
        // Try clicking any heart/bookmark icon on the page
        const anyHeart = page.locator('[class*="heart"], [class*="Heart"], [class*="bookmark"], [class*="Bookmark"]').first();
        if (await anyHeart.count() > 0) {
          await anyHeart.click();
          await sleep(1000);
          await page.screenshot({ path: `${SHOTS}/interactions/03-save-button-clicked.png`, fullPage: false });
          findings.interactions.saveButton.clicked = true;
        } else {
          findings.interactions.saveButton.note = 'Save buttons exist but none found on result cards directly';
          await page.screenshot({ path: `${SHOTS}/interactions/03-save-button-area.png`, fullPage: false });
        }
      }
    } else {
      findings.interactions.saveButton.note = 'No save/favorite buttons visible (may require auth)';
      await page.screenshot({ path: `${SHOTS}/interactions/03-no-save-button.png`, fullPage: false });
    }

    // 3d. Filter changes
    log('  Testing: Filter changes...');
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await page.screenshot({ path: `${SHOTS}/interactions/04a-before-filter.png`, fullPage: true });

    // Try clicking a language filter
    const langCheckbox = page.locator('input[type="checkbox"], label:has-text("Python"), button:has-text("Python")').first();
    if (await langCheckbox.count() > 0) {
      await langCheckbox.click();
      await sleep(2000);
      await page.screenshot({ path: `${SHOTS}/interactions/04b-after-language-filter.png`, fullPage: true });
      findings.interactions.filterChange = {
        type: 'language',
        urlAfter: page.url(),
        urlChanged: page.url() !== `${BASE}/search?q=TypeScript+San+Francisco`,
      };
      log(`    Filter applied. URL: ${page.url()}`);
    } else {
      findings.interactions.filterChange = { note: 'Could not find language filter checkboxes' };
    }

    // Try the hireable filter
    const hireableCheckbox = page.locator('input[id*="hireable"], label:has-text("Hireable"), label:has-text("hireable"), input[type="checkbox"]').first();
    if (await hireableCheckbox.count() > 0) {
      await hireableCheckbox.click();
      await sleep(2000);
      await page.screenshot({ path: `${SHOTS}/interactions/04c-hireable-filter.png`, fullPage: true });
      findings.interactions.hireableFilter = {
        urlAfter: page.url(),
        applied: true,
      };
    }

    // Try location filter input
    const locationInput = page.locator('input[placeholder*="location"], input[placeholder*="Location"], input[placeholder*="San Francisco"], input[placeholder*="e.g."]').first();
    if (await locationInput.count() > 0) {
      await locationInput.fill('New York');
      await locationInput.press('Enter');
      await sleep(2000);
      await page.screenshot({ path: `${SHOTS}/interactions/04d-location-filter.png`, fullPage: true });
      findings.interactions.locationFilter = {
        urlAfter: page.url(),
        applied: true,
      };
    }

    // 3e. Sort changes
    log('  Testing: Sort changes...');
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);

    // Try sort options - look for sort buttons/select
    const sortBtns = page.locator('button:has-text("Stars"), button:has-text("Followers"), button:has-text("Commits"), [class*="sort"] button, select');
    const sortCount = await sortBtns.count();
    findings.interactions.sort = { optionsFound: sortCount };

    if (sortCount > 0) {
      // Click "Stars" sort
      const starsSort = page.locator('button:has-text("Stars")').first();
      if (await starsSort.count() > 0) {
        await starsSort.click();
        await sleep(2000);
        await page.screenshot({ path: `${SHOTS}/interactions/05a-sort-stars.png`, fullPage: true });
        findings.interactions.sort.starsUrl = page.url();
        log(`    Sort by Stars. URL: ${page.url()}`);
      }

      // Click "Followers" sort
      const followersSort = page.locator('button:has-text("Followers")').first();
      if (await followersSort.count() > 0) {
        await followersSort.click();
        await sleep(2000);
        await page.screenshot({ path: `${SHOTS}/interactions/05b-sort-followers.png`, fullPage: true });
        findings.interactions.sort.followersUrl = page.url();
        log(`    Sort by Followers. URL: ${page.url()}`);
      }

      // Click "Commits" sort
      const commitsSort = page.locator('button:has-text("Commits")').first();
      if (await commitsSort.count() > 0) {
        await commitsSort.click();
        await sleep(2000);
        await page.screenshot({ path: `${SHOTS}/interactions/05c-sort-commits.png`, fullPage: true });
        findings.interactions.sort.commitsUrl = page.url();
        log(`    Sort by Commits. URL: ${page.url()}`);
      }
    } else {
      // Try select dropdown
      const sortSelect = page.locator('select').first();
      if (await sortSelect.count() > 0) {
        await sortSelect.selectOption({ label: 'Stars' });
        await sleep(2000);
        await page.screenshot({ path: `${SHOTS}/interactions/05a-sort-stars.png`, fullPage: true });
        findings.interactions.sort.starsUrl = page.url();
      }
    }

    await ctx.close();
  }

  // ─── 4. RESPONSIVE SCREENSHOTS ────────────────────────────────────
  log('=== SECTION 4: Responsive Screenshots ===');
  const viewports = [
    { width: 1440, height: 900, name: 'desktop-1440' },
    { width: 1280, height: 800, name: 'desktop-1280' },
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 375, height: 812, name: 'mobile-375' },
  ];

  for (const vp of viewports) {
    log(`  Capturing at ${vp.width}px...`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await page.screenshot({ path: `${SHOTS}/responsive/${vp.name}.png`, fullPage: true });

    // Capture viewport-specific observations
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const hasHorizontalScroll = bodyWidth > vp.width;
    const filtersSidebar = page.locator('[class*="filter"], [class*="Filter"], aside, [class*="sidebar"]');
    const filtersVisible = await filtersSidebar.isVisible().catch(() => false);

    findings.responsive[vp.name] = {
      viewport: `${vp.width}x${vp.height}`,
      horizontalOverflow: hasHorizontalScroll,
      bodyScrollWidth: bodyWidth,
      filtersVisible,
    };
    log(`    Overflow: ${hasHorizontalScroll}, Filters visible: ${filtersVisible}`);
    await ctx.close();
  }

  // ─── 5. DARK THEME ────────────────────────────────────────────────
  log('=== SECTION 5: Dark Theme ===');
  {
    // Use prefers-color-scheme: dark since there's no manual toggle
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const page = await ctx.newPage();

    // Dark: Empty state
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await page.screenshot({ path: `${SHOTS}/dark/01-dark-empty.png`, fullPage: true });

    // Dark: Results state
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await page.screenshot({ path: `${SHOTS}/dark/02-dark-results.png`, fullPage: true });

    // Check background color to verify dark mode applied
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).backgroundColor;
    });
    const textColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).color;
    });

    findings.darkTheme = {
      method: 'prefers-color-scheme: dark (system preference)',
      manualToggle: false,
      bgColor,
      textColor,
      darkModeActive: bgColor !== 'rgb(255, 255, 255)',
    };

    // Dark: Click into a profile
    const profileLink = page.locator('a[href*="/profile/"]').first();
    if (await profileLink.count() > 0) {
      await profileLink.click();
      await sleep(2000);
      await page.screenshot({ path: `${SHOTS}/dark/03-dark-profile.png`, fullPage: true });
    }

    // Dark: Mobile responsive
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await sleep(3000);
    await page.screenshot({ path: `${SHOTS}/dark/04-dark-mobile.png`, fullPage: true });

    log(`  Dark mode active: ${findings.darkTheme.darkModeActive}, bg: ${bgColor}`);
    await ctx.close();
  }

  // ─── SAVE FINDINGS ────────────────────────────────────────────────
  writeFileSync(
    `${SHOTS}/../ui-ux-findings.json`,
    JSON.stringify(findings, null, 2)
  );
  log('=== All screenshots captured. Findings saved. ===');

  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
