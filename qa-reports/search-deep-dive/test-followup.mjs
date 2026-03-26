import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = path.join(import.meta.dirname, 'screenshots');

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  return fp;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const findings = {};

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 1: Verify XSS — is the script tag actually rendered as HTML or just text?
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: XSS verification ══');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  const searchInput = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();
  await searchInput.fill('<script>alert(1)</script>');
  await searchInput.press('Enter');
  await page.waitForTimeout(3000);

  // Check if a script tag actually exists in the DOM (not just as escaped text)
  const xssCheck = await page.evaluate(() => {
    // Check for any injected script elements (not from the app)
    const scripts = document.querySelectorAll('script');
    const injectedScripts = Array.from(scripts).filter(s => s.textContent.includes('alert(1)'));

    // Check if <script> appears as raw HTML in innerHTML of any element
    const allElements = document.querySelectorAll('*');
    let rawScriptInInnerHTML = false;
    for (const el of allElements) {
      if (el.innerHTML && el.innerHTML.includes('<script>alert(1)</script>') && el.tagName !== 'SCRIPT') {
        rawScriptInInnerHTML = true;
        break;
      }
    }

    // Check if the text appears escaped (as &lt;script&gt;)
    const bodyHTML = document.body.innerHTML;
    const hasEscaped = bodyHTML.includes('&lt;script&gt;') || bodyHTML.includes('&lt;script&gt;alert');

    // Check the search input value
    const inputs = document.querySelectorAll('input');
    let inputHasXSS = false;
    for (const inp of inputs) {
      if (inp.value.includes('<script>')) inputHasXSS = true;
    }

    // Check URL encoding
    const urlHasXSS = window.location.href.includes('<script>');
    const urlEncoded = window.location.href.includes('%3Cscript%3E') || window.location.href.includes('script');

    return {
      injectedScriptCount: injectedScripts.length,
      rawScriptInInnerHTML,
      hasEscapedVersion: hasEscaped,
      inputHasXSS,
      urlHasXSS,
      urlEncoded,
      currentUrl: window.location.href,
      bodyTextSample: document.body.textContent.substring(0, 500)
    };
  });

  console.log('XSS check results:', JSON.stringify(xssCheck, null, 2));
  findings.xss = xssCheck;
  await screenshot(page, 'followup-xss-verification');

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 2: Search actually working — check network and try different approach
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Search mechanism ══');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Monitor network requests
  const apiRequests = [];
  page.on('response', async resp => {
    if (resp.url().includes('/api/')) {
      const body = await resp.text().catch(() => '');
      apiRequests.push({
        url: resp.url(),
        status: resp.status(),
        bodyLength: body.length,
        bodyPreview: body.substring(0, 300)
      });
    }
  });

  // Try searching via URL directly
  console.log('\nTrying URL-based search...');
  await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const resultCount1 = await page.locator('a[href*="/profile/"]').count();
  console.log(`URL-based search results: ${resultCount1}`);
  await screenshot(page, 'followup-search-url-based');

  // Try typing in the search box
  console.log('\nTrying input-based search...');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  const input = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();
  await input.fill('TypeScript San Francisco');

  // Try pressing Enter
  await input.press('Enter');
  await page.waitForTimeout(5000);

  const resultCount2 = await page.locator('a[href*="/profile/"]').count();
  console.log(`Input-based search (Enter): ${resultCount2}`);
  await screenshot(page, 'followup-search-input-enter');

  // If no results, check if there's a search button to click
  if (resultCount2 === 0) {
    const searchButton = await page.locator('button[type="submit"], button:has-text("Search"), button[aria-label*="search"]').first();
    if (await searchButton.isVisible().catch(() => false)) {
      await searchButton.click();
      await page.waitForTimeout(5000);
      const resultCount3 = await page.locator('a[href*="/profile/"]').count();
      console.log(`Input-based search (button click): ${resultCount3}`);
      await screenshot(page, 'followup-search-button-click');
    }
  }

  console.log('\nAPI requests captured:', JSON.stringify(apiRequests, null, 2));
  findings.search = { resultCount1, resultCount2, apiRequests };

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 3: Card field audit — take detailed screenshots of actual cards
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Card field audit ══');
  await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const cards = await page.locator('a[href*="/profile/"]').all();
  console.log(`Found ${cards.length} profile links`);

  if (cards.length > 0) {
    // Get the first card's parent container
    for (let i = 0; i < Math.min(3, cards.length); i++) {
      const card = cards[i];
      const href = await card.getAttribute('href');

      // Try to find the card's container
      const cardContainer = await card.evaluate(el => {
        // Walk up to find the card-like container
        let current = el;
        for (let j = 0; j < 10; j++) {
          if (!current.parentElement) break;
          current = current.parentElement;
          const classes = current.className || '';
          if (/card|result|item|developer/i.test(classes) || current.tagName === 'LI' || current.tagName === 'ARTICLE') {
            return {
              tag: current.tagName,
              classes: current.className,
              text: current.textContent.trim().substring(0, 500),
              innerHTML: current.innerHTML.substring(0, 2000)
            };
          }
        }
        // Fallback: get grandparent
        return {
          tag: el.parentElement?.parentElement?.tagName || 'unknown',
          classes: el.parentElement?.parentElement?.className || '',
          text: (el.parentElement?.parentElement?.textContent || '').trim().substring(0, 500),
          innerHTML: (el.parentElement?.parentElement?.innerHTML || '').substring(0, 2000)
        };
      });

      console.log(`\nCard ${i + 1} (${href}):`);
      console.log(`  Tag: ${cardContainer.tag}, Classes: ${cardContainer.classes}`);
      console.log(`  Text: ${cardContainer.text}`);
    }

    // Take a zoomed screenshot of the first 3 cards area
    const firstCard = cards[0];
    const bbox = await firstCard.boundingBox();
    if (bbox) {
      await page.screenshot({
        path: path.join(SCREENSHOTS, 'followup-card-closeup.png'),
        clip: { x: 0, y: Math.max(0, bbox.y - 20), width: 1440, height: 600 }
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 4: Profile navigation — click cards and verify
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Profile navigation ══');
  if (cards.length > 0) {
    for (let i = 0; i < Math.min(3, cards.length); i++) {
      const card = cards[i];
      const href = await card.getAttribute('href');
      const username = href?.split('/profile/')[1]?.split(/[?#]/)[0];

      console.log(`\nClicking card ${i + 1}: ${href}`);
      await card.click();

      try {
        await page.waitForURL(/\/profile\//, { timeout: 10000 });
        await page.waitForTimeout(2000);
        await screenshot(page, `followup-profile-${i + 1}-${username}`);

        const profileText = await page.textContent('body');
        console.log(`  Profile loaded: ${profileText.length} chars, URL: ${page.url()}`);
        console.log(`  Has username: ${profileText.toLowerCase().includes(username?.toLowerCase() || '')}`);

        // Go back
        await page.goBack();
        await page.waitForTimeout(2000);
        console.log(`  Back URL: ${page.url()}`);

        findings[`profile_${i + 1}`] = {
          username,
          loaded: true,
          url: page.url()
        };
      } catch (e) {
        console.log(`  Error: ${e.message}`);
        findings[`profile_${i + 1}`] = { username, loaded: false, error: e.message };
        await page.goto(`${BASE}/search?q=TypeScript+San+Francisco`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(3000);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 5: Edge cases — more careful error detection
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Edge case error analysis ══');
  const edgeCases = [
    { name: 'empty', query: '' },
    { name: 'single-letter', query: 'a' },
    { name: 'long-200', query: 'a'.repeat(200) },
    { name: 'emoji', query: '🚀🔥💻' },
  ];

  for (const { name, query } of edgeCases) {
    const url = query ? `${BASE}/search?q=${encodeURIComponent(query)}` : `${BASE}/search?q=`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    const hasVisibleError = /unhandled|exception|500|internal server error/i.test(bodyText);
    const hasGenericError = /error/i.test(bodyText);
    const hasResults = await page.locator('a[href*="/profile/"]').count();

    // Check the actual page state more carefully
    const pageState = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent || '',
        hasErrorBoundary: !!document.querySelector('[class*="error"]'),
        bodyLength: document.body.textContent.length,
        statusIndicators: Array.from(document.querySelectorAll('[class*="status"], [class*="error"], [class*="empty"], [class*="message"]')).map(el => el.textContent.trim().substring(0, 100))
      };
    });

    console.log(`\nEdge case "${name}" (query="${query.slice(0, 20)}"):`);
    console.log(`  Results: ${hasResults}, Visible error: ${hasVisibleError}, Generic 'error' in text: ${hasGenericError}`);
    console.log(`  Page state:`, JSON.stringify(pageState));

    await screenshot(page, `followup-edge-${name}`);

    findings[`edge_${name}`] = {
      hasResults,
      hasVisibleError,
      hasGenericError,
      pageState
    };
  }

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 6: Cmd+K — check how the shortcut is actually implemented
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Cmd+K implementation ══');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Check what keyboard shortcuts are registered
  const shortcutInfo = await page.evaluate(() => {
    // Check for any kbd elements showing shortcuts
    const kbdElements = Array.from(document.querySelectorAll('kbd')).map(el => el.textContent);
    // Check for any elements with shortcut hints
    const shortcutHints = Array.from(document.querySelectorAll('[data-shortcut], [aria-keyshortcuts]')).map(el => ({
      shortcut: el.getAttribute('data-shortcut') || el.getAttribute('aria-keyshortcuts'),
      text: el.textContent.trim().substring(0, 50)
    }));
    // Check for "⌘K" text anywhere
    const hasCmdKText = document.body.textContent.includes('⌘K') || document.body.textContent.includes('Cmd+K') || document.body.textContent.includes('⌘ K');
    return { kbdElements, shortcutHints, hasCmdKText };
  });

  console.log('Shortcut info:', JSON.stringify(shortcutInfo, null, 2));

  // Try Ctrl+K as well (in case headless doesn't support Meta)
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(1000);
  const afterCtrlK = page.url();
  console.log(`After Ctrl+K: ${afterCtrlK}`);
  await screenshot(page, 'followup-ctrl-k');

  findings.cmdK = { ...shortcutInfo, afterCtrlK };

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 7: Rapid fire — gentler test
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Rapid fire (gentler) ══');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  const rapidErrors = [];
  const rapidResponses = [];
  page.on('pageerror', err => rapidErrors.push(err.message));
  page.on('response', resp => {
    if (resp.url().includes('/api/search')) {
      rapidResponses.push({ status: resp.status(), url: resp.url() });
    }
  });

  const rapidInput = await page.locator('input[type="text"], input[type="search"], input[placeholder*="earch"], input[placeholder*="GitHub"]').first();
  const queries = ['React', 'Python', 'Go', 'Rust', 'Java'];

  const t0 = Date.now();
  for (const q of queries) {
    await rapidInput.fill(q);
    await rapidInput.press('Enter');
    await page.waitForTimeout(600);
  }
  const rapidTime = Date.now() - t0;

  await page.waitForTimeout(5000); // Let all responses settle

  console.log(`Rapid fire: ${queries.length} queries in ${rapidTime}ms`);
  console.log(`API responses: ${rapidResponses.length}`);
  console.log(`Failed responses: ${rapidResponses.filter(r => r.status >= 400).length}`);
  console.log(`Page errors: ${rapidErrors.length}`);
  if (rapidErrors.length > 0) console.log(`Errors: ${rapidErrors.join(', ')}`);

  await screenshot(page, 'followup-rapid-fire');

  findings.rapidFire = {
    elapsed: rapidTime,
    apiResponses: rapidResponses.length,
    failed: rapidResponses.filter(r => r.status >= 400).length,
    errors: rapidErrors,
    failedDetails: rapidResponses.filter(r => r.status >= 400)
  };

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 8: Pagination deep check
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: Pagination deep check ══');
  await page.goto(`${BASE}/search?q=TypeScript`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const p1Links = (await page.locator('a[href*="/profile/"]').allTextContents()).slice(0, 5);
  console.log(`Page 1 first 5: ${JSON.stringify(p1Links)}`);
  const p1Count = await page.locator('a[href*="/profile/"]').count();

  // Check for pagination UI
  const paginationHTML = await page.evaluate(() => {
    const paginationEls = document.querySelectorAll('[class*="pagination"], [class*="Pagination"], [class*="pager"], nav[aria-label*="page"]');
    return Array.from(paginationEls).map(el => el.innerHTML.substring(0, 500));
  });
  console.log('Pagination HTML:', paginationHTML);

  // Try page 2
  await page.goto(`${BASE}/search?q=TypeScript&page=2`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const p2Links = (await page.locator('a[href*="/profile/"]').allTextContents()).slice(0, 5);
  console.log(`Page 2 first 5: ${JSON.stringify(p2Links)}`);
  const p2Count = await page.locator('a[href*="/profile/"]').count();

  await page.goto(`${BASE}/search?q=TypeScript&page=3`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const p3Count = await page.locator('a[href*="/profile/"]').count();
  console.log(`Page 3 count: ${p3Count}`);

  await screenshot(page, 'followup-pagination-p2');

  findings.pagination = { p1Count, p2Count, p3Count, p1Links, p2Links, paginationHTML };

  // ═══════════════════════════════════════════════════════
  // FOLLOWUP 9: Location filter — check all filter UI
  // ═══════════════════════════════════════════════════════
  console.log('\n══ FOLLOWUP: All filter UI elements ══');
  await page.goto(`${BASE}/search?q=TypeScript`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  const filterUI = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
      type: el.type, name: el.name, id: el.id, placeholder: el.placeholder,
      classes: el.className, ariaLabel: el.getAttribute('aria-label'),
      visible: el.offsetParent !== null
    }));
    const selects = Array.from(document.querySelectorAll('select')).map(el => ({
      name: el.name, id: el.id, classes: el.className,
      options: Array.from(el.options).map(o => o.textContent)
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.textContent.trim().substring(0, 50),
      classes: el.className.substring(0, 100),
      ariaLabel: el.getAttribute('aria-label')
    }));
    return { inputs, selects, buttons };
  });

  console.log('Filter inputs:', JSON.stringify(filterUI.inputs, null, 2));
  console.log('Selects:', JSON.stringify(filterUI.selects, null, 2));
  console.log('Buttons (filter-related):', JSON.stringify(filterUI.buttons.filter(b =>
    /sort|filter|language|location|star|min|open|hide|view/i.test(b.text + b.classes + (b.ariaLabel || ''))
  ), null, 2));

  await screenshot(page, 'followup-all-filters');
  findings.filterUI = filterUI;

  // Write all findings
  fs.writeFileSync(path.join(import.meta.dirname, 'followup-findings.json'), JSON.stringify(findings, null, 2));
  console.log('\nFollowup findings written.');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
