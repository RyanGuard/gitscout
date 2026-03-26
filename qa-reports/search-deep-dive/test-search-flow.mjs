import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = path.join(import.meta.dirname, 'screenshots');
const RESULTS_FILE = path.join(import.meta.dirname, 'test-results-flow.json');

// Ensure screenshots dir exists
fs.mkdirSync(SCREENSHOTS, { recursive: true });

const results = [];
function record(name, status, details = {}) {
  const entry = { test: name, status, ...details, timestamp: new Date().toISOString() };
  results.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${status}${details.note ? ' — ' + details.note : ''}`);
}

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ═══════════════════════════════════════════════════════
  // TEST 1: /search empty state
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 1: /search empty state ══');
  try {
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
    await screenshot(page, '01-search-empty-state');

    // Check for search input
    const searchInput = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();
    const hasSearchInput = await searchInput.isVisible().catch(() => false);

    // Check for any empty state messaging
    const bodyText = await page.textContent('body');
    const hasEmptyState = bodyText.includes('Search') || bodyText.includes('Find') || bodyText.includes('developer');

    record('1. Empty state loads', hasSearchInput ? 'PASS' : 'FAIL', {
      note: `Search input visible: ${hasSearchInput}, empty state content: ${hasEmptyState}`,
      screenshot: '01-search-empty-state.png'
    });
  } catch (e) {
    record('1. Empty state loads', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 2: Search 'TypeScript San Francisco' — timed
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 2: Search TypeScript San Francisco ══');
  try {
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });

    const searchInput = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();
    await searchInput.fill('TypeScript San Francisco');

    const startTime = Date.now();
    await searchInput.press('Enter');

    // Wait for results to appear
    await page.waitForResponse(resp => resp.url().includes('/api/search'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000); // Let results render

    const elapsed = Date.now() - startTime;
    await screenshot(page, '02-search-results-ts-sf');

    // Count result cards
    const cardSelectors = [
      '[class*="card"]', '[class*="Card"]', '[class*="result"]', '[class*="Result"]',
      'a[href*="/profile/"]', '[data-testid*="result"]'
    ];
    let resultCount = 0;
    for (const sel of cardSelectors) {
      const count = await page.locator(sel).count();
      if (count > resultCount) resultCount = count;
    }

    // Also try counting profile links
    const profileLinks = await page.locator('a[href*="/profile/"]').count();
    resultCount = Math.max(resultCount, profileLinks);

    record('2. Search TypeScript San Francisco', resultCount > 0 ? 'PASS' : 'FAIL', {
      note: `${resultCount} results in ${elapsed}ms`,
      elapsed_ms: elapsed,
      result_count: resultCount,
      screenshot: '02-search-results-ts-sf.png'
    });
  } catch (e) {
    record('2. Search TypeScript San Francisco', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 3: Document every field on result cards
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 3: Document result card fields ══');
  try {
    // Make sure we have results on screen
    const bodyHtml = await page.content();

    const fields = {
      avatar: false,
      name: false,
      username: false,
      score: false,
      tierBadge: false,
      emailIndicator: false,
      location: false,
      followers: false,
      stars: false,
      repos: false,
      languages: false,
      bio: false,
      lastActive: false,
      viewedBadge: false,
      company: false,
    };

    // Check for avatar images
    const avatarImgs = await page.locator('img[src*="avatar"], img[src*="githubusercontent"], img[alt*="avatar"]').count();
    fields.avatar = avatarImgs > 0;

    // Check for profile links (username)
    const profileLinks = await page.locator('a[href*="/profile/"]').count();
    fields.username = profileLinks > 0;

    // Check for various text patterns
    const bodyText = await page.textContent('body');

    // Score (look for numbers like "85" or "Score: 85" or score indicators)
    fields.score = /\b\d{1,3}\s*(\/\s*100|score|pts|points)/i.test(bodyText) ||
                   await page.locator('[class*="score"], [class*="Score"], [data-testid*="score"]').count() > 0;

    // Tier badge (S, A, B, C tiers or similar)
    fields.tierBadge = /\b(S\+?|A\+?|B\+?|C\+?|D)\s*(tier|rank|badge)?/i.test(bodyText) ||
                       await page.locator('[class*="tier"], [class*="Tier"], [class*="badge"], [class*="Badge"]').count() > 0;

    // Email indicator
    fields.emailIndicator = await page.locator('[class*="email"], [class*="Email"], [title*="email"], svg[class*="mail"], [aria-label*="email"]').count() > 0 ||
                            bodyText.includes('@') || bodyText.toLowerCase().includes('email');

    // Location
    fields.location = await page.locator('[class*="location"], [class*="Location"]').count() > 0 ||
                      /San Francisco|SF|California|CA|New York|NY|London|Berlin|Tokyo/i.test(bodyText);

    // Followers
    fields.followers = /follower/i.test(bodyText) || await page.locator('[class*="follower"], [title*="follower"]').count() > 0;

    // Stars
    fields.stars = /\bstar/i.test(bodyText) || await page.locator('[class*="star"], [title*="star"]').count() > 0;

    // Repos
    fields.repos = /\brepo/i.test(bodyText) || await page.locator('[class*="repo"], [title*="repo"]').count() > 0;

    // Languages
    fields.languages = await page.locator('[class*="language"], [class*="Language"], [class*="lang"]').count() > 0 ||
                       /TypeScript|JavaScript|Python|Rust|Go|Java|Ruby|C\+\+/i.test(bodyText);

    // Bio
    fields.bio = await page.locator('[class*="bio"], [class*="Bio"], [class*="description"]').count() > 0;

    // Name (check for display names vs usernames in card headers)
    fields.name = profileLinks > 0; // If there are profile links, names should be visible

    // Last active
    fields.lastActive = /last active|updated|ago|active/i.test(bodyText) ||
                        await page.locator('[class*="active"], [class*="Active"], [class*="updated"]').count() > 0;

    // Viewed badge
    fields.viewedBadge = /viewed/i.test(bodyText) || await page.locator('[class*="viewed"], [class*="Viewed"]').count() > 0;

    // Company
    fields.company = await page.locator('[class*="company"], [class*="Company"], [class*="org"]').count() > 0 ||
                     /@\w+/.test(bodyText);

    // Take a close-up of first card
    const firstCard = await page.locator('a[href*="/profile/"]').first();
    if (await firstCard.isVisible().catch(() => false)) {
      const cardParent = firstCard.locator('xpath=ancestor::div[contains(@class,"card") or contains(@class,"Card") or contains(@class,"result") or contains(@class,"Result")]').first();
      if (await cardParent.isVisible().catch(() => false)) {
        await cardParent.screenshot({ path: path.join(SCREENSHOTS, '03-first-card-detail.png') });
      } else {
        // Try to screenshot the link's parent container
        await firstCard.locator('..').first().screenshot({ path: path.join(SCREENSHOTS, '03-first-card-detail.png') }).catch(() => {});
      }
    }

    const presentFields = Object.entries(fields).filter(([,v]) => v).map(([k]) => k);
    const missingFields = Object.entries(fields).filter(([,v]) => !v).map(([k]) => k);

    record('3. Document card fields', 'INFO', {
      note: `Present: [${presentFields.join(', ')}] | Missing: [${missingFields.join(', ')}]`,
      fields,
      screenshot: '03-first-card-detail.png'
    });
  } catch (e) {
    record('3. Document card fields', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 4: Click 3 result cards → profile loads, back button works
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 4: Click result cards + back button ══');
  try {
    const profileLinks = await page.locator('a[href*="/profile/"]').all();
    const linksToTest = profileLinks.slice(0, 3);

    for (let i = 0; i < linksToTest.length; i++) {
      const link = linksToTest[i];
      const href = await link.getAttribute('href');
      const username = href?.split('/profile/')[1]?.split(/[?#]/)[0];

      await link.click();
      await page.waitForURL(/\/profile\//, { timeout: 10000 });
      await page.waitForTimeout(2000);

      const profileUrl = page.url();
      const profileBody = await page.textContent('body');
      const hasProfileContent = profileBody.length > 100;

      await screenshot(page, `04-profile-${i + 1}-${username || i}`);

      // Test back button
      await page.goBack();
      await page.waitForTimeout(2000);

      const backUrl = page.url();
      const isBackOnSearch = backUrl.includes('/search');

      record(`4.${i + 1}. Click card → ${username}`, hasProfileContent && isBackOnSearch ? 'PASS' : 'FAIL', {
        note: `Profile loaded: ${hasProfileContent}, back to search: ${isBackOnSearch}`,
        profileUrl,
        screenshot: `04-profile-${i + 1}-${username || i}.png`
      });
    }

    if (linksToTest.length === 0) {
      record('4. Click result cards', 'FAIL', { note: 'No profile links found to click' });
    }
  } catch (e) {
    record('4. Click result cards', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 5: Sort options (Score, Followers, Stars, Newest)
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 5: Sort options ══');
  try {
    // Re-search to ensure we have results
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Find sort controls
    const sortSelectors = [
      'select[name*="sort"]', 'select[class*="sort"]', 'select[id*="sort"]',
      '[class*="sort"] select', '[class*="Sort"] select',
      'button[class*="sort"]', '[data-testid*="sort"]',
      '[role="listbox"]', '[role="combobox"]'
    ];

    let sortControl = null;
    let sortType = null;

    for (const sel of sortSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        sortControl = el;
        sortType = await el.evaluate(el => el.tagName.toLowerCase());
        break;
      }
    }

    // Also look for sort buttons/tabs
    if (!sortControl) {
      const sortButtons = await page.locator('button').filter({ hasText: /score|follower|star|newest|recent|sort/i }).all();
      if (sortButtons.length > 0) {
        sortControl = sortButtons[0];
        sortType = 'button';
      }
    }

    // Also look for sort links or dropdown trigger
    if (!sortControl) {
      // Check for any element with "sort" text
      const sortText = await page.locator(':text-matches("sort", "i")').first();
      if (await sortText.isVisible().catch(() => false)) {
        sortControl = sortText;
        sortType = 'text-element';
      }
    }

    if (sortControl) {
      await screenshot(page, '05-sort-control-found');

      const sortOptions = ['Score', 'Followers', 'Stars', 'Newest'];
      let sortWorked = false;

      if (sortType === 'select') {
        for (const opt of sortOptions) {
          try {
            await sortControl.selectOption({ label: new RegExp(opt, 'i') }).catch(() =>
              sortControl.selectOption({ value: new RegExp(opt, 'i') })
            );
            await page.waitForTimeout(1500);
            await screenshot(page, `05-sort-${opt.toLowerCase()}`);
            sortWorked = true;
          } catch {}
        }
      } else {
        // Try clicking the sort control to open dropdown
        await sortControl.click();
        await page.waitForTimeout(500);
        await screenshot(page, '05-sort-dropdown-open');

        for (const opt of sortOptions) {
          const optionEl = page.locator(`text=${opt}`).first();
          if (await optionEl.isVisible().catch(() => false)) {
            await optionEl.click();
            await page.waitForTimeout(1500);
            await screenshot(page, `05-sort-${opt.toLowerCase()}`);
            sortWorked = true;
            // Re-open dropdown for next option
            if (sortControl) {
              await sortControl.click().catch(() => {});
              await page.waitForTimeout(500);
            }
          }
        }
      }

      record('5. Sort options', sortWorked ? 'PASS' : 'WARN', {
        note: `Sort control found (${sortType}), sort worked: ${sortWorked}`,
        screenshot: '05-sort-control-found.png'
      });
    } else {
      // Try URL-based sorting
      const sortResults = {};
      for (const sort of ['score', 'followers', 'stars', 'newest']) {
        await page.goto(`${BASE}/search?q=TypeScript+San+Francisco&sort=${sort}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);
        const firstLink = await page.locator('a[href*="/profile/"]').first().getAttribute('href').catch(() => null);
        sortResults[sort] = firstLink;
        await screenshot(page, `05-sort-${sort}`);
      }

      const uniqueFirstResults = new Set(Object.values(sortResults).filter(Boolean));
      record('5. Sort options (URL-based)', uniqueFirstResults.size > 1 ? 'PASS' : 'WARN', {
        note: `Tested via URL params. Unique first results: ${uniqueFirstResults.size}. Results: ${JSON.stringify(sortResults)}`,
      });
    }
  } catch (e) {
    record('5. Sort options', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 6: Language filter pills
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 6: Language filter pills ══');
  try {
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    const languages = ['TypeScript', 'Python', 'Rust'];
    let filterFound = false;

    for (const lang of languages) {
      // Look for language pills/buttons/chips
      const langSelectors = [
        `button:has-text("${lang}")`,
        `[class*="pill"]:has-text("${lang}")`,
        `[class*="chip"]:has-text("${lang}")`,
        `[class*="filter"]:has-text("${lang}")`,
        `[class*="language"]:has-text("${lang}")`,
        `label:has-text("${lang}")`,
        `[role="checkbox"]:has-text("${lang}")`,
      ];

      for (const sel of langSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible().catch(() => false)) {
          await el.click();
          await page.waitForTimeout(2000);
          await screenshot(page, `06-lang-filter-${lang.toLowerCase()}`);
          filterFound = true;

          // Check if URL updated or results changed
          const currentUrl = page.url();
          record(`6. Language filter: ${lang}`, 'PASS', {
            note: `Filter clicked, URL: ${currentUrl}`,
            screenshot: `06-lang-filter-${lang.toLowerCase()}.png`
          });

          // Unclick if it's a toggle
          await el.click().catch(() => {});
          await page.waitForTimeout(1000);
          break;
        }
      }
    }

    if (!filterFound) {
      // Check for language filter via URL
      await page.goto(`${BASE}/search?q=TypeScript+San+Francisco&language=TypeScript`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await screenshot(page, '06-lang-filter-url-ts');

      await page.goto(`${BASE}/search?q=TypeScript+San+Francisco&language=Python`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await screenshot(page, '06-lang-filter-url-python');

      record('6. Language filter pills', 'WARN', {
        note: 'No clickable language pills found on page. Tested via URL params.',
        screenshot: '06-lang-filter-url-ts.png'
      });
    }
  } catch (e) {
    record('6. Language filter pills', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 7: Location filter input
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 7: Location filter ══');
  try {
    await page.goto(`${BASE}/search?q=TypeScript`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Look for location input
    const locationSelectors = [
      'input[placeholder*="ocation"]',
      'input[placeholder*="city"]',
      'input[name*="location"]',
      'input[id*="location"]',
      '[class*="location"] input',
      '[class*="Location"] input',
    ];

    let locationInput = null;
    for (const sel of locationSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        locationInput = el;
        break;
      }
    }

    if (locationInput) {
      await locationInput.fill('New York');
      await locationInput.press('Enter');
      await page.waitForTimeout(3000);
      await screenshot(page, '07-location-filter-ny');

      const url = page.url();
      record('7. Location filter', url.includes('ocation') || url.includes('New') ? 'PASS' : 'WARN', {
        note: `Location filter used, URL: ${url}`,
        screenshot: '07-location-filter-ny.png'
      });
    } else {
      // Try URL-based location filter
      await page.goto(`${BASE}/search?q=TypeScript&location=New+York`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await screenshot(page, '07-location-filter-url');

      record('7. Location filter', 'WARN', {
        note: 'No dedicated location input found. Tested via URL params.',
        screenshot: '07-location-filter-url.png'
      });
    }
  } catch (e) {
    record('7. Location filter', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 8: Min Stars filter
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 8: Min Stars filter ══');
  try {
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Look for min stars input
    const starsSelectors = [
      'input[placeholder*="star"]',
      'input[name*="star"]',
      'input[id*="star"]',
      'input[placeholder*="min"]',
      '[class*="star"] input',
      '[class*="Star"] input',
      'input[type="number"]',
    ];

    let starsInput = null;
    for (const sel of starsSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        starsInput = el;
        break;
      }
    }

    if (starsInput) {
      await starsInput.fill('100');
      await starsInput.press('Enter');
      await page.waitForTimeout(3000);
      await screenshot(page, '08-min-stars-100');

      record('8. Min Stars filter', 'PASS', {
        note: 'Min stars filter found and set to 100',
        screenshot: '08-min-stars-100.png'
      });
    } else {
      // Try URL-based
      await page.goto(`${BASE}/search?q=TypeScript+San+Francisco&minStars=100`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await screenshot(page, '08-min-stars-url');

      record('8. Min Stars filter', 'WARN', {
        note: 'No dedicated min stars input found. Tested via URL param.',
        screenshot: '08-min-stars-url.png'
      });
    }
  } catch (e) {
    record('8. Min Stars filter', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 9: Open to Work checkbox
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 9: Open to Work checkbox ══');
  try {
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    const otwSelectors = [
      'input[type="checkbox"]',
      '[role="checkbox"]',
      'label:has-text("Open to Work")',
      'label:has-text("open to work")',
      'label:has-text("hireable")',
      'button:has-text("Open to Work")',
    ];

    let otwCheckbox = null;
    for (const sel of otwSelectors) {
      const els = await page.locator(sel).all();
      for (const el of els) {
        const text = await el.textContent().catch(() => '');
        const label = await el.getAttribute('aria-label').catch(() => '');
        if (/open.to.work|hireable/i.test(text + label)) {
          otwCheckbox = el;
          break;
        }
      }
      if (otwCheckbox) break;
    }

    // Also check all checkboxes and their labels
    if (!otwCheckbox) {
      const checkboxes = await page.locator('input[type="checkbox"]').all();
      for (const cb of checkboxes) {
        const id = await cb.getAttribute('id').catch(() => '');
        const name = await cb.getAttribute('name').catch(() => '');
        // Check surrounding label text
        const parent = cb.locator('..');
        const parentText = await parent.textContent().catch(() => '');
        if (/open|work|hire/i.test(parentText + id + name)) {
          otwCheckbox = cb;
          break;
        }
      }
    }

    if (otwCheckbox) {
      await otwCheckbox.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '09-open-to-work-checked');

      record('9. Open to Work checkbox', 'PASS', {
        note: 'Open to Work checkbox found and toggled',
        screenshot: '09-open-to-work-checked.png'
      });
    } else {
      // List all checkboxes for debugging
      const allCheckboxes = await page.locator('input[type="checkbox"]').all();
      const cbInfo = [];
      for (const cb of allCheckboxes) {
        const id = await cb.getAttribute('id').catch(() => '');
        const name = await cb.getAttribute('name').catch(() => '');
        const parentText = await cb.locator('..').textContent().catch(() => '');
        cbInfo.push({ id, name, parentText: parentText.trim().slice(0, 50) });
      }

      await screenshot(page, '09-open-to-work-not-found');
      record('9. Open to Work checkbox', 'WARN', {
        note: `No Open to Work checkbox identified. Found ${allCheckboxes.length} checkboxes: ${JSON.stringify(cbInfo)}`,
        screenshot: '09-open-to-work-not-found.png'
      });
    }
  } catch (e) {
    record('9. Open to Work checkbox', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 10: Hide Viewed checkbox
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 10: Hide Viewed checkbox ══');
  try {
    // We should still be on search page
    const currentUrl = page.url();
    if (!currentUrl.includes('/search')) {
      await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);
    }

    let hvCheckbox = null;
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    for (const cb of checkboxes) {
      const id = await cb.getAttribute('id').catch(() => '');
      const name = await cb.getAttribute('name').catch(() => '');
      const parent = cb.locator('..');
      const parentText = await parent.textContent().catch(() => '');
      if (/hide.*view|viewed/i.test(parentText + id + name)) {
        hvCheckbox = cb;
        break;
      }
    }

    // Also check labels
    if (!hvCheckbox) {
      const label = page.locator('label:has-text("Hide Viewed"), label:has-text("hide viewed"), label:has-text("Viewed")').first();
      if (await label.isVisible().catch(() => false)) {
        hvCheckbox = label;
      }
    }

    if (hvCheckbox) {
      await hvCheckbox.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '10-hide-viewed-checked');

      record('10. Hide Viewed checkbox', 'PASS', {
        note: 'Hide Viewed checkbox found and toggled',
        screenshot: '10-hide-viewed-checked.png'
      });
    } else {
      await screenshot(page, '10-hide-viewed-not-found');
      record('10. Hide Viewed checkbox', 'WARN', {
        note: 'No Hide Viewed checkbox found',
        screenshot: '10-hide-viewed-not-found.png'
      });
    }
  } catch (e) {
    record('10. Hide Viewed checkbox', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 11: Cmd+K keyboard shortcut
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 11: Cmd+K shortcut ══');
  try {
    // Test from home page
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(1000);
    await screenshot(page, '11-cmd-k-from-home');

    // Check if we navigated to search or opened a modal
    const afterUrl = page.url();
    const isOnSearch = afterUrl.includes('/search');

    // Check for any modal/dialog
    const hasModal = await page.locator('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="command"], [class*="Command"]').count() > 0;

    // Check if search input is focused
    const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    const isInputFocused = activeTag === 'input';

    record('11. Cmd+K shortcut', isOnSearch || hasModal || isInputFocused ? 'PASS' : 'FAIL', {
      note: `After Cmd+K: URL=${afterUrl}, modal=${hasModal}, inputFocused=${isInputFocused}`,
      screenshot: '11-cmd-k-from-home.png'
    });

    // Also test from search page
    await page.goto(`${BASE}/search?q=TypeScript`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click somewhere neutral first
    await page.click('body');
    await page.waitForTimeout(300);

    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(1000);

    const searchActiveTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    const searchInputFocused = searchActiveTag === 'input';

    await screenshot(page, '11-cmd-k-from-search');
    record('11. Cmd+K on search page', searchInputFocused ? 'PASS' : 'WARN', {
      note: `Input focused: ${searchInputFocused}, active element: ${searchActiveTag}`,
      screenshot: '11-cmd-k-from-search.png'
    });
  } catch (e) {
    record('11. Cmd+K shortcut', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 12: Edge cases
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 12: Edge cases ══');

  const edgeCases = [
    { name: 'empty query', query: '' },
    { name: 'single letter', query: 'a' },
    { name: '200 char query', query: 'a'.repeat(200) },
    { name: 'XSS script tag', query: '<script>alert(1)</script>' },
    { name: 'emoji query', query: '🚀🔥💻' },
  ];

  for (const { name, query } of edgeCases) {
    try {
      await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      const searchInput = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();

      if (query === '') {
        // Just press enter with empty input
        await searchInput.fill('');
        await searchInput.press('Enter');
      } else {
        await searchInput.fill(query);
        await searchInput.press('Enter');
      }

      await page.waitForTimeout(3000);

      const ssName = `12-edge-${name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
      await screenshot(page, ssName);

      // Check for errors
      const bodyText = await page.textContent('body');
      const hasError = /error|500|internal server|unhandled|exception/i.test(bodyText);
      const hasXSS = bodyText.includes('<script>') || await page.evaluate(() => !!document.querySelector('script:not([src])'));

      // Check for console errors
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      let status = 'PASS';
      let note = `Query "${query.slice(0, 30)}${query.length > 30 ? '...' : ''}" handled gracefully`;

      if (hasError) {
        status = 'FAIL';
        note = `Error displayed on page for query: ${name}`;
      }
      if (hasXSS && name === 'XSS script tag') {
        status = 'FAIL';
        note = 'XSS VULNERABILITY: Script tag rendered in DOM!';
      }
      if (name === 'XSS script tag' && !hasXSS) {
        note = 'XSS properly sanitized — script tag not rendered';
      }

      record(`12. Edge case: ${name}`, status, {
        note,
        screenshot: `${ssName}.png`
      });
    } catch (e) {
      record(`12. Edge case: ${name}`, 'FAIL', { note: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════
  // TEST 13: Pagination
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 13: Pagination ══');
  try {
    await page.goto(`${BASE}/search?q=TypeScript`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Get page 1 results
    const page1Links = await page.locator('a[href*="/profile/"]').allTextContents();
    await screenshot(page, '13-pagination-page1');

    // Look for pagination controls
    const paginationSelectors = [
      'button:has-text("Next")',
      'button:has-text("2")',
      'a:has-text("Next")',
      'a:has-text("2")',
      '[class*="pagination"]',
      '[class*="Pagination"]',
      '[aria-label="Next page"]',
      'button:has-text(">")',
      'button:has-text("→")',
      '[class*="page"] button',
    ];

    let paginationFound = false;

    // Try clicking "Next" or page 2
    for (const sel of paginationSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click();
        await page.waitForTimeout(3000);
        paginationFound = true;

        const page2Links = await page.locator('a[href*="/profile/"]').allTextContents();
        await screenshot(page, '13-pagination-page2');

        const resultsChanged = JSON.stringify(page1Links) !== JSON.stringify(page2Links);

        record('13.1 Pagination page 2', resultsChanged ? 'PASS' : 'WARN', {
          note: `Page 1 had ${page1Links.length} results, page 2 has ${page2Links.length} results. Changed: ${resultsChanged}`,
          screenshot: '13-pagination-page2.png'
        });

        // Try page 3
        const page3Btn = page.locator('button:has-text("3"), a:has-text("3"), button:has-text("Next"), a:has-text("Next")').first();
        if (await page3Btn.isVisible().catch(() => false)) {
          await page3Btn.click();
          await page.waitForTimeout(3000);

          const page3Links = await page.locator('a[href*="/profile/"]').allTextContents();
          await screenshot(page, '13-pagination-page3');

          record('13.2 Pagination page 3', page3Links.length > 0 ? 'PASS' : 'WARN', {
            note: `Page 3 has ${page3Links.length} results`,
            screenshot: '13-pagination-page3.png'
          });
        }
        break;
      }
    }

    if (!paginationFound) {
      // Try URL-based pagination
      await page.goto(`${BASE}/search?q=TypeScript&page=2`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);

      const page2Links = await page.locator('a[href*="/profile/"]').allTextContents();
      await screenshot(page, '13-pagination-page2-url');

      await page.goto(`${BASE}/search?q=TypeScript&page=3`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);

      const page3Links = await page.locator('a[href*="/profile/"]').allTextContents();
      await screenshot(page, '13-pagination-page3-url');

      record('13. Pagination (URL-based)', page2Links.length > 0 ? 'PASS' : 'WARN', {
        note: `Via URL params — page 2: ${page2Links.length} results, page 3: ${page3Links.length} results`,
        screenshot: '13-pagination-page2-url.png'
      });
    }
  } catch (e) {
    record('13. Pagination', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 14: No results empty state
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 14: No results empty state ══');
  try {
    const noResultsQuery = 'xyzzyplughtwisty999nonexistent';
    await page.goto(`${BASE}/search?q=${noResultsQuery}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(4000);

    await screenshot(page, '14-no-results');

    const bodyText = await page.textContent('body');
    const hasEmptyMessage = /no results|not found|no developers|no matches|try|tip|suggest|nothing|couldn't find|0 results/i.test(bodyText);
    const profileLinks = await page.locator('a[href*="/profile/"]').count();

    record('14. No results empty state', hasEmptyMessage || profileLinks === 0 ? 'PASS' : 'FAIL', {
      note: `Empty message shown: ${hasEmptyMessage}, profile links: ${profileLinks}`,
      screenshot: '14-no-results.png'
    });
  } catch (e) {
    record('14. No results empty state', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // TEST 15: Rapid fire 5 searches in 3 seconds
  // ═══════════════════════════════════════════════════════
  console.log('\n══ TEST 15: Rapid fire searches ══');
  try {
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const rapidQueries = ['React', 'Python ML', 'Golang', 'Kubernetes', 'Svelte'];
    const errors = [];
    const responses = [];

    // Listen for errors
    page.on('pageerror', err => errors.push(err.message));
    page.on('response', resp => {
      if (resp.url().includes('/api/search')) {
        responses.push({ url: resp.url(), status: resp.status() });
      }
    });

    const searchInput = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();

    const startTime = Date.now();
    for (const query of rapidQueries) {
      await searchInput.fill(query);
      await searchInput.press('Enter');
      await page.waitForTimeout(600); // ~600ms between searches = ~3s total
    }
    const elapsed = Date.now() - startTime;

    // Wait for last results to settle
    await page.waitForTimeout(4000);

    await screenshot(page, '15-rapid-fire-final');

    const failedResponses = responses.filter(r => r.status >= 400);
    const hasErrors = errors.length > 0 || failedResponses.length > 0;

    record('15. Rapid fire 5 searches', !hasErrors ? 'PASS' : 'WARN', {
      note: `5 searches in ${elapsed}ms. API responses: ${responses.length}, failed: ${failedResponses.length}, page errors: ${errors.length}`,
      errors: errors.slice(0, 3),
      failedResponses: failedResponses.slice(0, 3),
      screenshot: '15-rapid-fire-final.png'
    });
  } catch (e) {
    record('15. Rapid fire searches', 'FAIL', { note: e.message });
  }

  // ═══════════════════════════════════════════════════════
  // DONE — Write results
  // ═══════════════════════════════════════════════════════
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  console.log('\n══════════════════════════════════════');
  console.log(`Total tests: ${results.length}`);
  console.log(`PASS: ${results.filter(r => r.status === 'PASS').length}`);
  console.log(`FAIL: ${results.filter(r => r.status === 'FAIL').length}`);
  console.log(`WARN: ${results.filter(r => r.status === 'WARN').length}`);
  console.log(`INFO: ${results.filter(r => r.status === 'INFO').length}`);
  console.log('══════════════════════════════════════\n');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
