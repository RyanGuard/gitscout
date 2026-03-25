import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SSDIR = path.resolve('qa-reports/search-deep-dive/screenshots');
mkdirSync(SSDIR, { recursive: true });

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440px' },
  { width: 1280, height: 800, label: '1280px' },
  { width: 768, height: 1024, label: '768px' },
  { width: 375, height: 812, label: '375px' },
];

const findings = [];
function log(category, detail) {
  findings.push({ category, detail });
  console.log(`[${category}] ${detail}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ───────────────────────────────────────────────
  // 1. EMPTY STATE
  // ───────────────────────────────────────────────
  console.log('\n=== 1. EMPTY STATE ===');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SSDIR}/01-empty-state.png`, fullPage: true });
  log('empty-state', 'Screenshot captured');

  // Document what's visible in empty state
  const emptyStateElements = {};
  emptyStateElements.hasSearchInput = await page.locator('input[type="text"], input[type="search"], input[placeholder]').count() > 0;
  emptyStateElements.hasFilters = await page.locator('[class*="filter"], [data-testid*="filter"], select, [role="combobox"]').count() > 0;
  emptyStateElements.hasEmptyMessage = await page.locator('text=/no results|start searching|enter a query|search for/i').count() > 0;
  emptyStateElements.hasResultsCount = await page.locator('text=/results|found|showing/i').count() > 0;

  const pageTitle = await page.title();
  const h1Text = await page.locator('h1, h2').first().textContent().catch(() => 'none');
  log('empty-state', `Page title: "${pageTitle}"`);
  log('empty-state', `Main heading: "${h1Text?.trim()}"`);
  log('empty-state', `Has search input: ${emptyStateElements.hasSearchInput}`);
  log('empty-state', `Has filters: ${emptyStateElements.hasFilters}`);
  log('empty-state', `Has empty message: ${emptyStateElements.hasEmptyMessage}`);
  log('empty-state', `Has results count: ${emptyStateElements.hasResultsCount}`);

  // Check all visible text in the main content area
  const bodyText = await page.locator('main, [role="main"], body').first().innerText().catch(() => '');
  log('empty-state', `Visible body text (first 500 chars): ${bodyText.substring(0, 500)}`);

  // ───────────────────────────────────────────────
  // 2. LOADING STATE
  // ───────────────────────────────────────────────
  console.log('\n=== 2. LOADING STATE ===');
  // Type search query and capture loading
  const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="earch" i]').first();
  await searchInput.fill('TypeScript San Francisco');

  // Try to capture loading by submitting and screenshotting quickly
  const submitButton = page.locator('button[type="submit"], button:has-text("Search"), button:has-text("search"), form button').first();

  // Start navigation/search and screenshot immediately
  let loadingCaptured = false;

  // Check if there's a form to submit or if it auto-searches
  const hasForm = await page.locator('form').count() > 0;

  if (await submitButton.count() > 0) {
    // Click and immediately screenshot
    const clickPromise = submitButton.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SSDIR}/02-loading-state.png`, fullPage: true });
    log('loading-state', 'Screenshot captured (after submit click + 200ms)');
    loadingCaptured = true;
    await clickPromise;
  } else if (hasForm) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SSDIR}/02-loading-state.png`, fullPage: true });
    log('loading-state', 'Screenshot captured (after Enter + 200ms)');
    loadingCaptured = true;
  } else {
    // Might auto-search on input
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SSDIR}/02-loading-state.png`, fullPage: true });
    log('loading-state', 'Screenshot captured (auto-search, 200ms after fill)');
    loadingCaptured = true;
  }

  // Check for loading indicators
  const hasSpinner = await page.locator('[class*="spinner"], [class*="loading"], [class*="animate-spin"], svg.animate-spin, [role="progressbar"]').count() > 0;
  const hasSkeletons = await page.locator('[class*="skeleton"], [class*="shimmer"], [class*="placeholder"], [class*="pulse"]').count() > 0;
  const hasLoadingText = await page.locator('text=/loading|searching|fetching/i').count() > 0;
  log('loading-state', `Has spinner: ${hasSpinner}`);
  log('loading-state', `Has skeletons: ${hasSkeletons}`);
  log('loading-state', `Has loading text: ${hasLoadingText}`);

  // ───────────────────────────────────────────────
  // 3. RESULTS STATE — 'TypeScript San Francisco'
  // ───────────────────────────────────────────────
  console.log('\n=== 3. RESULTS STATE ===');
  // Wait for results to load
  await page.waitForTimeout(8000); // GitHub API can be slow
  await page.screenshot({ path: `${SSDIR}/03-results-state.png`, fullPage: true });
  log('results-state', 'Screenshot captured');

  // Check current URL
  const currentUrl = page.url();
  log('results-state', `Current URL: ${currentUrl}`);

  // Count result cards
  const cardSelectors = [
    '[class*="card" i]', '[class*="result" i]', '[data-testid*="result"]',
    'article', '[role="article"]', 'li a[href*="profile"]',
    'a[href*="/profile/"]', '[class*="developer" i]'
  ];

  let resultCards = null;
  let cardSelector = '';
  for (const sel of cardSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0 && count < 200) {
      log('results-state', `Selector "${sel}" matched ${count} elements`);
      if (!resultCards || count > resultCards) {
        resultCards = count;
        cardSelector = sel;
      }
    }
  }

  // Try to identify actual result cards more precisely
  const links = await page.locator('a[href*="/profile/"]').count();
  log('results-state', `Profile links found: ${links}`);

  // Get all text from the results area to understand layout
  const resultsAreaText = await page.evaluate(() => {
    // Try to find the main results container
    const main = document.querySelector('main') || document.body;
    return main.innerText;
  });
  log('results-state', `Full results page text (first 2000 chars):\n${resultsAreaText.substring(0, 2000)}`);

  // ───────────────────────────────────────────────
  // 3a. DOCUMENT EVERY FIELD ON RESULT CARDS
  // ───────────────────────────────────────────────
  console.log('\n=== 3a. DOCUMENTING RESULT CARD FIELDS ===');

  // Get detailed info about the first few cards
  const cardDetails = await page.evaluate(() => {
    const cards = [];
    // Try multiple strategies to find cards
    const profileLinks = document.querySelectorAll('a[href*="/profile/"]');
    const seen = new Set();

    profileLinks.forEach((link) => {
      // Walk up to find the card container
      let card = link;
      for (let i = 0; i < 5; i++) {
        if (card.parentElement) card = card.parentElement;
      }

      const id = link.getAttribute('href');
      if (seen.has(id)) return;
      seen.add(id);

      if (cards.length < 5) {
        const imgs = card.querySelectorAll('img');
        const avatars = Array.from(imgs).map(i => ({ src: i.src, alt: i.alt, width: i.width }));

        // Get all text nodes
        const allText = card.innerText;

        // Look for specific data points
        const badges = Array.from(card.querySelectorAll('[class*="badge" i], [class*="tag" i], [class*="chip" i], span[class*="bg-"]'))
          .map(b => b.innerText.trim()).filter(Boolean);

        const svgIcons = card.querySelectorAll('svg');
        const iconCount = svgIcons.length;

        // Look for numbers that might be stats
        const numbers = allText.match(/[\d,]+\.?\d*/g) || [];

        cards.push({
          href: link.getAttribute('href'),
          linkText: link.innerText.trim(),
          fullText: allText.substring(0, 1000),
          avatars,
          badges,
          iconCount,
          numbers,
          childElementCount: card.childElementCount,
          tagName: card.tagName,
          className: card.className?.substring?.(0, 200) || '',
        });
      }
    });

    return cards;
  });

  for (let i = 0; i < cardDetails.length; i++) {
    const card = cardDetails[i];
    log('card-fields', `\n--- Card ${i + 1} (${card.href}) ---`);
    log('card-fields', `Link text: "${card.linkText}"`);
    log('card-fields', `Full text: "${card.fullText}"`);
    log('card-fields', `Avatars: ${JSON.stringify(card.avatars)}`);
    log('card-fields', `Badges: ${JSON.stringify(card.badges)}`);
    log('card-fields', `Icon count: ${card.iconCount}`);
    log('card-fields', `Numbers found: ${JSON.stringify(card.numbers)}`);
    log('card-fields', `Container: ${card.tagName}.${card.className}`);
  }

  // Also capture the raw HTML structure of the first card
  const firstCardHtml = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/profile/"]');
    if (!link) return 'NO CARD FOUND';
    let card = link;
    for (let i = 0; i < 4; i++) {
      if (card.parentElement) card = card.parentElement;
    }
    return card.outerHTML;
  });
  log('card-fields', `First card raw HTML (first 3000 chars):\n${firstCardHtml.substring(0, 3000)}`);

  // ───────────────────────────────────────────────
  // 3b. CHECK FILTERS AND SORT OPTIONS
  // ───────────────────────────────────────────────
  console.log('\n=== 3b. FILTERS AND SORT ===');

  const filterElements = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      name: s.name || s.id || s.getAttribute('aria-label') || 'unnamed',
      options: Array.from(s.options).map(o => ({ value: o.value, text: o.text })),
      currentValue: s.value,
    }));

    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim(),
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className?.substring?.(0, 100) || '',
    }));

    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      name: i.name || i.id || i.placeholder || 'unnamed',
      value: i.value,
      placeholder: i.placeholder,
    }));

    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]')).map(c => ({
      type: c.type,
      name: c.name || c.id,
      checked: c.checked,
      label: c.closest('label')?.innerText?.trim() || c.nextElementSibling?.innerText?.trim() || '',
    }));

    return { selects, buttons: buttons.filter(b => b.text), inputs, checkboxes };
  });

  log('filters', `Selects: ${JSON.stringify(filterElements.selects, null, 2)}`);
  log('filters', `Buttons: ${JSON.stringify(filterElements.buttons, null, 2)}`);
  log('filters', `Inputs: ${JSON.stringify(filterElements.inputs, null, 2)}`);
  log('filters', `Checkboxes: ${JSON.stringify(filterElements.checkboxes, null, 2)}`);

  // ───────────────────────────────────────────────
  // 4. ERROR STATE
  // ───────────────────────────────────────────────
  console.log('\n=== 4. ERROR STATE ===');
  // Try to trigger an error by searching with weird input
  await page.goto(`${BASE}/search?q=`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SSDIR}/04-error-empty-query.png`, fullPage: true });
  log('error-state', 'Empty query screenshot captured');

  // Try a very long query
  await page.goto(`${BASE}/search?q=${'a'.repeat(500)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SSDIR}/04-error-long-query.png`, fullPage: true });
  log('error-state', 'Long query screenshot captured');
  const longQueryText = await page.locator('main, body').first().innerText().catch(() => '');
  log('error-state', `Long query result text (first 500): ${longQueryText.substring(0, 500)}`);

  // Try special characters
  await page.goto(`${BASE}/search?q=${encodeURIComponent('<script>alert(1)</script>')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SSDIR}/04-error-xss-attempt.png`, fullPage: true });
  log('error-state', 'XSS attempt screenshot captured');
  const xssText = await page.locator('main, body').first().innerText().catch(() => '');
  log('error-state', `XSS query result text (first 500): ${xssText.substring(0, 500)}`);

  // Check for any script execution
  const xssExecuted = await page.evaluate(() => {
    // Check if alert was called (it won't be in headless, but check DOM)
    const scripts = document.querySelectorAll('script:not([src])');
    return { inlineScripts: scripts.length, documentContainsScript: document.body.innerHTML.includes('<script>') };
  });
  log('error-state', `XSS check: ${JSON.stringify(xssExecuted)}`);

  // ───────────────────────────────────────────────
  // 5. INTERACTION TESTS
  // ───────────────────────────────────────────────
  console.log('\n=== 5. INTERACTION TESTS ===');

  // Go back to results
  await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  // 5a. Click on a result card
  console.log('--- 5a. Click result ---');
  const firstProfileLink = page.locator('a[href*="/profile/"]').first();
  const firstProfileHref = await firstProfileLink.getAttribute('href').catch(() => null);
  log('interaction', `First profile link href: ${firstProfileHref}`);

  if (firstProfileHref) {
    await firstProfileLink.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SSDIR}/05a-profile-page.png`, fullPage: true });
    log('interaction', `Navigated to: ${page.url()}`);
    const profileTitle = await page.title();
    log('interaction', `Profile page title: "${profileTitle}"`);

    // Document profile page content
    const profileText = await page.locator('main, body').first().innerText().catch(() => '');
    log('interaction', `Profile page text (first 1000): ${profileText.substring(0, 1000)}`);

    // 5b. Browser back
    console.log('--- 5b. Browser back ---');
    await page.goBack();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SSDIR}/05b-after-back.png`, fullPage: true });
    log('interaction', `After back, URL: ${page.url()}`);
    const backResultCount = await page.locator('a[href*="/profile/"]').count();
    log('interaction', `Results still showing after back: ${backResultCount > 0} (${backResultCount} links)`);

    // Check if search query is preserved
    const searchValueAfterBack = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch" i]').first().inputValue().catch(() => 'N/A');
    log('interaction', `Search input value after back: "${searchValueAfterBack}"`);
  }

  // 5c. Save/Favorite button
  console.log('--- 5c. Save button ---');
  const saveButtons = await page.locator('button:has-text("Save"), button:has-text("Favorite"), button:has-text("save"), button[aria-label*="save" i], button[aria-label*="favorite" i], [class*="favorite" i] button, button:has(svg[class*="heart"]), button:has(svg)').count();
  log('interaction', `Save/favorite button candidates: ${saveButtons}`);

  // Look for heart or bookmark icons
  const heartButtons = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const results = [];
    buttons.forEach(b => {
      const svg = b.querySelector('svg');
      if (svg) {
        const paths = svg.querySelectorAll('path');
        const d = Array.from(paths).map(p => p.getAttribute('d')).join(' ');
        // Heart-like paths contain certain keywords
        if (d.includes('heart') || b.getAttribute('aria-label')?.toLowerCase().includes('fav') ||
            b.getAttribute('aria-label')?.toLowerCase().includes('save') ||
            b.className?.toLowerCase().includes('fav') || b.className?.toLowerCase().includes('save')) {
          results.push({ text: b.innerText.trim(), ariaLabel: b.getAttribute('aria-label'), class: b.className?.substring(0, 100) });
        }
      }
    });
    return results;
  });
  log('interaction', `Heart/save buttons found: ${JSON.stringify(heartButtons)}`);

  // 5d. Filter changes
  console.log('--- 5d. Filter changes ---');
  const selects = page.locator('select');
  const selectCount = await selects.count();

  for (let i = 0; i < selectCount; i++) {
    const sel = selects.nth(i);
    const name = await sel.getAttribute('name') || await sel.getAttribute('id') || await sel.getAttribute('aria-label') || `select-${i}`;
    const options = await sel.locator('option').allTextContents();
    log('interaction', `Filter "${name}" options: ${JSON.stringify(options)}`);

    // Change to a non-default option if available
    if (options.length > 1) {
      const optionValues = await sel.locator('option').evaluateAll(opts => opts.map(o => ({ value: o.value, text: o.text })));
      const nonDefault = optionValues.find(o => o.value && o.value !== optionValues[0].value);
      if (nonDefault) {
        await sel.selectOption(nonDefault.value);
        await page.waitForTimeout(2000);
        const newUrl = page.url();
        log('interaction', `Changed "${name}" to "${nonDefault.text}" → URL: ${newUrl}`);
        await page.screenshot({ path: `${SSDIR}/05d-filter-${name.replace(/[^a-z0-9]/gi, '')}.png`, fullPage: true });
      }
    }
  }

  // Also check for custom dropdowns (non-select elements)
  const customDropdowns = await page.locator('[role="listbox"], [role="menu"], [class*="dropdown" i], [class*="select" i]:not(select)').count();
  log('interaction', `Custom dropdown elements: ${customDropdowns}`);

  // 5e. Sort changes
  console.log('--- 5e. Sort changes ---');
  // Go back to base results
  await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  const sortElements = await page.evaluate(() => {
    const results = [];
    // Look for sort-related elements
    const allElements = document.querySelectorAll('select, button, [role="listbox"], [class*="sort" i]');
    allElements.forEach(el => {
      const text = el.innerText?.trim();
      const label = el.getAttribute('aria-label') || el.getAttribute('name') || '';
      if (text?.toLowerCase().includes('sort') || label.toLowerCase().includes('sort') ||
          el.className?.toLowerCase().includes('sort')) {
        results.push({
          tag: el.tagName,
          text: text?.substring(0, 100),
          label,
          class: el.className?.substring(0, 100),
        });
      }
    });
    return results;
  });
  log('interaction', `Sort elements found: ${JSON.stringify(sortElements, null, 2)}`);

  // Try clicking sort if it's a button
  for (const sortEl of sortElements) {
    if (sortEl.tag === 'SELECT') {
      const sortSelect = page.locator(`select[class*="sort" i], select[name*="sort" i], select[aria-label*="sort" i]`).first();
      if (await sortSelect.count() > 0) {
        const sortOptions = await sortSelect.locator('option').allTextContents();
        log('interaction', `Sort options: ${JSON.stringify(sortOptions)}`);
        if (sortOptions.length > 1) {
          const opts = await sortSelect.locator('option').evaluateAll(opts => opts.map(o => ({ value: o.value, text: o.text })));
          if (opts.length > 1) {
            await sortSelect.selectOption(opts[1].value);
            await page.waitForTimeout(3000);
            await page.screenshot({ path: `${SSDIR}/05e-sort-changed.png`, fullPage: true });
            log('interaction', `Sort changed to "${opts[1].text}" → URL: ${page.url()}`);
          }
        }
      }
    }
  }

  // ───────────────────────────────────────────────
  // 6. RESPONSIVE SCREENSHOTS (4 viewports)
  // ───────────────────────────────────────────────
  console.log('\n=== 6. RESPONSIVE SCREENSHOTS ===');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${SSDIR}/06-responsive-${vp.label}.png`, fullPage: true });
    log('responsive', `${vp.label} screenshot captured`);

    // Check layout info at this viewport
    const layoutInfo = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const cards = document.querySelectorAll('a[href*="/profile/"]');
      let columns = 1;
      if (cards.length >= 2) {
        const rect1 = cards[0]?.getBoundingClientRect();
        const rect2 = cards[1]?.getBoundingClientRect();
        if (rect1 && rect2 && Math.abs(rect1.top - rect2.top) < 20) {
          columns = 2; // At least 2 columns
          if (cards.length >= 3) {
            const rect3 = cards[2]?.getBoundingClientRect();
            if (rect3 && Math.abs(rect1.top - rect3.top) < 20) columns = 3;
          }
        }
      }

      // Check for horizontal overflow
      const hasHScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;

      // Check if header is visible
      const header = document.querySelector('header, nav');
      const headerVisible = header ? header.getBoundingClientRect().height > 0 : false;

      // Check for hamburger menu
      const hamburger = document.querySelector('[class*="hamburger" i], [aria-label*="menu" i], button:has(svg[class*="menu"])');

      return {
        columns,
        hasHScroll,
        headerVisible,
        hasHamburger: !!hamburger,
        bodyWidth: document.body.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    log('responsive', `${vp.label} layout: ${JSON.stringify(layoutInfo)}`);
  }

  // ───────────────────────────────────────────────
  // 7. DARK THEME
  // ───────────────────────────────────────────────
  console.log('\n=== 7. DARK THEME ===');

  // Reset viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  // Check if there's a theme toggle
  const themeToggle = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const results = [];
    buttons.forEach(b => {
      const text = b.innerText?.trim().toLowerCase();
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      const cls = (b.className || '').toLowerCase();
      if (text.includes('dark') || text.includes('theme') || text.includes('light') ||
          label.includes('dark') || label.includes('theme') || label.includes('light') ||
          cls.includes('theme') || cls.includes('dark') || cls.includes('mode')) {
        results.push({ text: b.innerText?.trim(), label: b.getAttribute('aria-label'), class: b.className?.substring(0, 100) });
      }
    });

    // Also check for theme via media query or class
    const htmlClass = document.documentElement.className;
    const bodyClass = document.body.className;
    const hasDarkClass = htmlClass.includes('dark') || bodyClass.includes('dark');
    const prefDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    return { toggleButtons: results, htmlClass, bodyClass, hasDarkClass, prefDark };
  });
  log('dark-theme', `Theme state: ${JSON.stringify(themeToggle, null, 2)}`);

  // Try toggling dark mode via class
  if (themeToggle.toggleButtons.length > 0) {
    // Click the toggle
    const toggleBtn = page.locator('button').filter({ hasText: /dark|theme|light/i }).first();
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SSDIR}/07-dark-theme-toggled.png`, fullPage: true });
      log('dark-theme', 'Toggled theme via button');
    }
  } else {
    // Force dark mode via class
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SSDIR}/07-dark-theme-forced.png`, fullPage: true });
    log('dark-theme', 'Forced dark class on <html>');

    // Check if styles actually change
    const darkStyles = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      const main = document.querySelector('main');
      const mainComputed = main ? window.getComputedStyle(main) : null;
      return {
        bodyBg: computed.backgroundColor,
        bodyColor: computed.color,
        mainBg: mainComputed?.backgroundColor,
        mainColor: mainComputed?.color,
      };
    });
    log('dark-theme', `Dark mode styles: ${JSON.stringify(darkStyles)}`);
  }

  // Also try prefers-color-scheme dark
  await context.close();
  const darkContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const darkPage = await darkContext.newPage();
  await darkPage.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
  await darkPage.waitForTimeout(8000);
  await darkPage.screenshot({ path: `${SSDIR}/07-dark-theme-prefers.png`, fullPage: true });
  log('dark-theme', 'Screenshot with prefers-color-scheme: dark');

  const darkModeCheck = await darkPage.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const computed = window.getComputedStyle(body);
    return {
      htmlClass: html.className,
      bodyBg: computed.backgroundColor,
      bodyColor: computed.color,
      hasDarkClass: html.classList.contains('dark'),
    };
  });
  log('dark-theme', `Dark mode check: ${JSON.stringify(darkModeCheck)}`);

  await darkPage.close();
  await darkContext.close();

  // ───────────────────────────────────────────────
  // 8. ADDITIONAL CHECKS
  // ───────────────────────────────────────────────
  console.log('\n=== 8. ADDITIONAL CHECKS ===');

  const lightContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const checkPage = await lightContext.newPage();
  await checkPage.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle' });
  await checkPage.waitForTimeout(8000);

  // Accessibility checks
  const a11y = await checkPage.evaluate(() => {
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(i => !i.getAttribute('alt'));

    const buttons = document.querySelectorAll('button');
    const buttonsWithoutLabel = Array.from(buttons).filter(b => !b.innerText?.trim() && !b.getAttribute('aria-label'));

    const inputs = document.querySelectorAll('input');
    const inputsWithoutLabel = Array.from(inputs).filter(i => {
      const id = i.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      return !hasLabel && !i.getAttribute('aria-label') && !i.getAttribute('placeholder');
    });

    const focusableElements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');

    return {
      totalImages: images.length,
      imagesWithoutAlt: imagesWithoutAlt.length,
      imagesWithoutAltSrcs: Array.from(imagesWithoutAlt).map(i => i.src).slice(0, 5),
      totalButtons: buttons.length,
      buttonsWithoutLabel: buttonsWithoutLabel.length,
      totalInputs: inputs.length,
      inputsWithoutLabel: inputsWithoutLabel.length,
      focusableElements: focusableElements.length,
    };
  });
  log('a11y', `Accessibility: ${JSON.stringify(a11y, null, 2)}`);

  // Check for console errors
  const consoleErrors = [];
  checkPage.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await checkPage.reload({ waitUntil: 'networkidle' });
  await checkPage.waitForTimeout(5000);
  log('console', `Console errors: ${JSON.stringify(consoleErrors)}`);

  await lightContext.close();
  await browser.close();

  // ───────────────────────────────────────────────
  // OUTPUT FINDINGS
  // ───────────────────────────────────────────────
  writeFileSync(`${SSDIR}/../findings.json`, JSON.stringify(findings, null, 2));
  console.log(`\n\nDone! ${findings.length} findings saved.`);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
