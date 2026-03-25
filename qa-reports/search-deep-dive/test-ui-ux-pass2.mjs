/**
 * Pass 2 — Focused on: proper results state, card field extraction,
 * click navigation, error state, and dark results
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const SHOTS = '/Users/ryanguard/gitscout/qa-reports/search-deep-dive/screenshots';

const findings = { cardFields: {}, interactions: {}, issues: [] };

function log(msg) { console.log(`[QA2] ${msg}`); }

async function waitForResults(page, timeout = 15000) {
  // Wait for either result cards or "No developers found"
  try {
    await page.waitForSelector('a[href*="/profile/"], text="No developers found"', { timeout });
  } catch {
    log('  Timeout waiting for results');
  }
  // Extra settle time for rendering
  await new Promise(r => setTimeout(r, 1500));
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ─── RESULTS STATE (proper wait) ──────────────────────────────
  log('=== Results state with proper wait ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);
    await page.screenshot({ path: `${SHOTS}/states/03-results-state.png`, fullPage: true });

    const resultCount = await page.locator('a[href*="/profile/"]').count();
    log(`  Result cards: ${resultCount}`);

    // Also capture just the viewport (above fold)
    await page.screenshot({ path: `${SHOTS}/states/03b-results-above-fold.png`, fullPage: false });

    // ─── CARD FIELD EXTRACTION ────────────────────────────────
    log('=== Card field extraction ===');

    // Detailed DOM inspection of first 3 cards
    const cardData = await page.evaluate(() => {
      const profileLinks = document.querySelectorAll('a[href*="/profile/"]');
      const cards = [];
      const seen = new Set();

      for (const link of profileLinks) {
        const href = link.getAttribute('href');
        if (seen.has(href)) continue;
        seen.add(href);
        if (cards.length >= 3) break;

        const card = {
          href,
          fields: [],
        };

        // Avatar
        const img = link.querySelector('img');
        if (img) {
          card.fields.push({ name: 'Avatar', type: 'image', value: img.alt || img.src.substring(0, 80) });
        }

        // Walk through text nodes at various levels
        const elements = link.querySelectorAll('*');
        const fieldMap = new Map();

        for (const el of elements) {
          // Only get direct text (not nested children)
          const directText = Array.from(el.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim())
            .filter(t => t.length > 0)
            .join(' ');

          if (directText && directText.length < 200) {
            const key = directText.substring(0, 50);
            if (!fieldMap.has(key)) {
              fieldMap.set(key, {
                text: directText,
                tag: el.tagName.toLowerCase(),
                classes: (el.className || '').substring(0, 120),
                hasIcon: el.querySelector('svg') !== null,
              });
            }
          }
        }

        // Detect SVG icons and their context
        const svgs = link.querySelectorAll('svg');
        const iconContexts = [];
        for (const svg of svgs) {
          const parent = svg.parentElement;
          const siblingText = parent?.textContent?.trim()?.substring(0, 60);
          iconContexts.push(siblingText || '(icon only)');
        }
        card.iconContexts = iconContexts;

        // Collect unique fields
        for (const [, val] of fieldMap) {
          card.fields.push({
            name: val.text.substring(0, 60),
            tag: val.tag,
            hasIcon: val.hasIcon,
          });
        }

        // Get full card text for completeness
        card.fullText = link.textContent.replace(/\s+/g, ' ').trim().substring(0, 400);

        cards.push(card);
      }
      return cards;
    });

    findings.cardFields = {
      totalCards: resultCount,
      sampleCards: cardData,
    };

    // Screenshot individual card detail
    const firstCard = page.locator('a[href*="/profile/"]').first();
    if (await firstCard.count() > 0) {
      await firstCard.scrollIntoViewIfNeeded();
      const box = await firstCard.boundingBox();
      if (box) {
        await page.screenshot({
          path: `${SHOTS}/states/04-single-card-detail.png`,
          clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 }
        });
      }
    }

    // Screenshot second card too for comparison
    const secondCard = page.locator('a[href*="/profile/"]').nth(1);
    if (await secondCard.count() > 0) {
      await secondCard.scrollIntoViewIfNeeded();
      const box2 = await secondCard.boundingBox();
      if (box2) {
        await page.screenshot({
          path: `${SHOTS}/states/04b-second-card-detail.png`,
          clip: { x: Math.max(0, box2.x - 10), y: Math.max(0, box2.y - 10), width: box2.width + 20, height: box2.height + 20 }
        });
      }
    }

    // Log extracted fields from first card
    if (cardData[0]) {
      log(`  Card 1: ${cardData[0].href}`);
      log(`  Full text: ${cardData[0].fullText.substring(0, 200)}`);
      log(`  Fields: ${cardData[0].fields.length}`);
      for (const f of cardData[0].fields) {
        log(`    - [${f.tag}] ${f.name} ${f.hasIcon ? '(has icon)' : ''}`);
      }
    }

    await ctx.close();
  }

  // ─── LOADING STATE (better capture) ────────────────────────────
  log('=== Loading state capture ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 500));

    // Navigate to search URL and screenshot ASAP
    const navPromise = page.goto(`${BASE}/search?q=TypeScript+San+Francisco`);
    // Take multiple screenshots rapidly
    await new Promise(r => setTimeout(r, 100));
    await page.screenshot({ path: `${SHOTS}/states/02a-loading-100ms.png`, fullPage: false });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${SHOTS}/states/02b-loading-500ms.png`, fullPage: false });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${SHOTS}/states/02c-loading-1500ms.png`, fullPage: false });
    await navPromise;
    log('  Loading states captured at 100ms, 500ms, 1500ms');
    await ctx.close();
  }

  // ─── ERROR STATE (better capture) ──────────────────────────────
  log('=== Error state capture ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Block API after page loads
    await page.route('**/api/search**', route => route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      contentType: 'application/json',
    }));
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 500));

    // Type and submit search
    const searchInput = page.locator('input').first();
    await searchInput.fill('TypeScript San Francisco');
    await searchInput.press('Enter');
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: `${SHOTS}/states/06-error-state.png`, fullPage: true });

    const bodyText = await page.textContent('body');
    findings.interactions.errorState = {
      hasErrorMessage: /error|failed|sorry|try again|went wrong/i.test(bodyText),
      errorText: bodyText.match(/(?:error|failed|sorry|try again|went wrong)[^.]*\./i)?.[0] || 'none found',
    };
    log(`  Error visible: ${findings.interactions.errorState.hasErrorMessage}`);
    log(`  Error text: ${findings.interactions.errorState.errorText}`);
    await ctx.close();
  }

  // ─── CLICK RESULT → PROFILE ────────────────────────────────────
  log('=== Click result navigation ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);

    const firstLink = page.locator('a[href*="/profile/"]').first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      log(`  Clicking: ${href}`);
      await firstLink.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/01-clicked-result-profile.png`, fullPage: true });

      findings.interactions.clickToProfile = {
        clickedHref: href,
        landedUrl: page.url(),
        navigatedToProfile: page.url().includes('/profile/'),
      };
      log(`  Landed at: ${page.url()}`);

      // Browser back
      await page.goBack();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/02-browser-back.png`, fullPage: true });
      findings.interactions.browserBack = {
        returnedTo: page.url(),
        queryPreserved: page.url().includes('q='),
        resultsStillVisible: await page.locator('a[href*="/profile/"]').count() > 0,
      };
      log(`  Back to: ${page.url()}, results visible: ${findings.interactions.browserBack.resultsStillVisible}`);
    }
    await ctx.close();
  }

  // ─── SAVE BUTTON TEST ─────────────────────────────────────────
  log('=== Save button test ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Navigate to a profile page to find the save button
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);

    // Check for save/favorite buttons on cards
    const heartBtns = await page.locator('button').evaluateAll(btns =>
      btns.map(b => ({
        text: b.textContent?.trim().substring(0, 50),
        ariaLabel: b.getAttribute('aria-label'),
        classes: b.className?.substring(0, 80),
        hasSvg: b.querySelector('svg') !== null,
        innerHTML: b.innerHTML.substring(0, 100),
      })).filter(b => b.hasSvg || b.text?.toLowerCase().includes('save') || b.text?.toLowerCase().includes('favorite'))
    );
    findings.interactions.saveButtons = heartBtns;
    log(`  Found ${heartBtns.length} potential save buttons`);

    // Navigate to profile to test save button there
    const firstLink = page.locator('a[href*="/profile/"]').first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 3000));

      // Look for favorite button on profile page
      const profBtns = await page.locator('button').evaluateAll(btns =>
        btns.map(b => ({
          text: b.textContent?.trim().substring(0, 80),
          ariaLabel: b.getAttribute('aria-label'),
          hasSvg: b.querySelector('svg') !== null,
          innerHTML: b.innerHTML.substring(0, 150),
        }))
      );
      findings.interactions.profileButtons = profBtns;
      await page.screenshot({ path: `${SHOTS}/interactions/03-profile-save-area.png`, fullPage: false });
      log(`  Profile buttons found: ${profBtns.length}`);
    }
    await ctx.close();
  }

  // ─── FILTER & SORT TESTS (with results visible) ───────────────
  log('=== Filter & Sort with visible results ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);

    const beforeCount = await page.locator('a[href*="/profile/"]').count();
    log(`  Results before filter: ${beforeCount}`);

    // Sort by Stars
    const starsBtn = page.locator('button:has-text("Stars")').first();
    if (await starsBtn.count() > 0) {
      await starsBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/05a-sort-stars.png`, fullPage: true });
      findings.interactions.sortStars = { url: page.url(), resultCount: await page.locator('a[href*="/profile/"]').count() };
      log(`  Sort by Stars: ${page.url()}`);
    }

    // Sort by Followers
    const followersBtn = page.locator('button:has-text("Followers")').first();
    if (await followersBtn.count() > 0) {
      await followersBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/05b-sort-followers.png`, fullPage: true });
      log(`  Sort by Followers: ${page.url()}`);
    }

    // Back to Score sort
    const scoreBtn = page.locator('button:has-text("Score")').first();
    if (await scoreBtn.count() > 0) {
      await scoreBtn.click();
      await new Promise(r => setTimeout(r, 3000));
    }

    // Language filter — Python
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);
    const pythonBtn = page.locator('button:has-text("Python"), label:has-text("Python")').first();
    if (await pythonBtn.count() > 0) {
      await pythonBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/04b-after-language-filter.png`, fullPage: true });
      const afterCount = await page.locator('a[href*="/profile/"]').count();
      findings.interactions.languageFilter = {
        url: page.url(),
        beforeCount,
        afterCount,
        resultsChanged: beforeCount !== afterCount,
      };
      log(`  Language filter: ${beforeCount} → ${afterCount} results`);
    }

    // Hireable filter
    const hireableBox = page.locator('input[type="checkbox"]').first();
    if (await hireableBox.count() > 0) {
      await hireableBox.check();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/04c-hireable-filter.png`, fullPage: true });
      log(`  Hireable filter: ${page.url()}`);
    }

    await ctx.close();
  }

  // ─── RESPONSIVE (with results) ────────────────────────────────
  log('=== Responsive with results ===');
  const viewports = [
    { width: 1440, height: 900, name: 'desktop-1440' },
    { width: 1280, height: 800, name: 'desktop-1280' },
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 375, height: 812, name: 'mobile-375' },
  ];

  for (const vp of viewports) {
    log(`  ${vp.name}...`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);
    await page.screenshot({ path: `${SHOTS}/responsive/${vp.name}.png`, fullPage: true });

    // Check overflow and layout
    const metrics = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      overflow: document.body.scrollWidth > window.innerWidth,
    }));
    findings[vp.name] = metrics;
    await ctx.close();
  }

  // ─── DARK THEME (with results) ────────────────────────────────
  log('=== Dark theme with results ===');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const page = await ctx.newPage();

    // Empty state dark
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: `${SHOTS}/dark/01-dark-empty.png`, fullPage: true });

    // Results dark
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);
    await page.screenshot({ path: `${SHOTS}/dark/02-dark-results.png`, fullPage: true });

    // Check colors
    const colors = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const text = window.getComputedStyle(document.body).color;
      // Check a card's background
      const card = document.querySelector('a[href*="/profile/"]');
      const cardBg = card ? window.getComputedStyle(card).backgroundColor : 'N/A';
      const cardBorder = card ? window.getComputedStyle(card).borderColor : 'N/A';
      return { bodyBg: bg, bodyText: text, cardBg, cardBorder };
    });
    findings.darkColors = colors;
    log(`  Body bg: ${colors.bodyBg}, text: ${colors.bodyText}`);
    log(`  Card bg: ${colors.cardBg}, border: ${colors.cardBorder}`);

    // Profile page dark
    const profileLink = page.locator('a[href*="/profile/"]').first();
    if (await profileLink.count() > 0) {
      const href = await profileLink.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/dark/03-dark-profile.png`, fullPage: true });
    }

    // Dark mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);
    await page.screenshot({ path: `${SHOTS}/dark/04-dark-mobile.png`, fullPage: true });

    await ctx.close();
  }

  // ─── PAGINATION TEST ──────────────────────────────────────────
  log('=== Pagination test ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await waitForResults(page);

    // Check for pagination
    const nextBtn = page.locator('button:has-text("Next"), a:has-text("Next")').first();
    const prevBtn = page.locator('button:has-text("Previous"), a:has-text("Previous")').first();
    const pageInfo = await page.textContent('body');
    const pageMatch = pageInfo.match(/page\s*\d+\s*of\s*\d+/i);

    findings.interactions.pagination = {
      hasNext: await nextBtn.count() > 0,
      hasPrevious: await prevBtn.count() > 0,
      pageInfo: pageMatch ? pageMatch[0] : 'not found',
    };

    // Scroll to bottom to see pagination
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `${SHOTS}/interactions/06-pagination.png`, fullPage: false });

    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: `${SHOTS}/interactions/06b-page2.png`, fullPage: true });
      findings.interactions.pagination.page2Url = page.url();
      log(`  Page 2: ${page.url()}`);
    }

    await ctx.close();
  }

  writeFileSync(`${SHOTS}/../ui-ux-findings-pass2.json`, JSON.stringify(findings, null, 2));
  log('=== Pass 2 complete ===');
  await browser.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
