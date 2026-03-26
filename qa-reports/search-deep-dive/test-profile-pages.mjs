import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SS_DIR = 'qa-reports/search-deep-dive/screenshots/profile';
const RESULTS = [];
const CONSOLE_ERRORS = [];
const NETWORK_ERRORS = [];

function log(section, test, status, details = '') {
  const entry = { section, test, status, details, timestamp: new Date().toISOString() };
  RESULTS.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : 'ℹ️';
  console.log(`${icon} [${section}] ${test}${details ? ' — ' + details : ''}`);
}

async function screenshot(page, name, fullPage = true) {
  const filepath = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage });
  return filepath;
}

async function loadProfile(page, username, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await page.goto(`${BASE}/profile/${username}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const hasError = await page.$('h2:has-text("Something went wrong")');
    if (!hasError) return { success: true, status: response?.status(), attempt };

    if (attempt < maxRetries) {
      console.log(`  ↻ Retry ${attempt}/${maxRetries} for /profile/${username}...`);
      await page.waitForTimeout(2000);
    }
  }
  return { success: false, status: null, attempt: maxRetries };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// TEST 1: /profile/torvalds — Full Page Audit
// ============================================
async function testTorvaldsProfile(page) {
  const section = 'Profile: torvalds';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: /profile/torvalds — Full Page Audit');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'torvalds');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Page errored after all retries — database connection issue');
    await screenshot(page, '01-torvalds-error');
    return { error: true };
  }
  log(section, 'Page load', 'PASS', `Loaded on attempt ${load.attempt}`);

  // Wait for dynamic content
  await page.waitForTimeout(3000);
  await screenshot(page, '01-torvalds-full-page');

  const pageContent = await page.textContent('body');
  const html = await page.content();

  // --- Header Section ---
  // Avatar
  const avatar = await page.$('img[src*="avatar"], img[src*="githubusercontent"]');
  if (!avatar) {
    // Try broader: any image in the profile area
    const anyImg = await page.$('main img, [class*="profile"] img');
    log(section, 'Avatar image present', anyImg ? 'PASS' : 'FAIL', anyImg ? 'Found via broader selector' : 'No avatar image found');
  } else {
    log(section, 'Avatar image present', 'PASS');
  }

  // Name
  const headings = await page.$$eval('h1, h2, h3', els => els.map(e => e.textContent.trim()));
  const nameHeading = headings.find(h => h.toLowerCase().includes('linus') || h.toLowerCase().includes('torvalds'));
  log(section, 'Developer name displayed', nameHeading ? 'PASS' : 'WARN', nameHeading ? `Found: "${nameHeading.substring(0, 60)}"` : `Headings: ${headings.slice(0, 5).join(' | ')}`);

  // Username
  log(section, 'Username visible', pageContent.includes('torvalds') ? 'PASS' : 'FAIL');

  // Score
  const scoreMatch = pageContent.match(/(\d{1,3})\s*\/\s*100/) || pageContent.match(/score[:\s]*(\d+)/i);
  log(section, 'Score displayed', scoreMatch ? 'PASS' : 'WARN', scoreMatch ? `Score: ${scoreMatch[0]}` : 'No score pattern found');

  // Company
  const hasCompany = /linux|foundation/i.test(pageContent);
  log(section, 'Company/org info', hasCompany ? 'PASS' : 'WARN');

  // Location
  const hasLocation = /portland|oregon|location/i.test(pageContent);
  log(section, 'Location info', hasLocation ? 'PASS' : 'WARN');

  // Bio
  const hasBio = pageContent.length > 1000;
  log(section, 'Bio/description present', hasBio ? 'PASS' : 'WARN');

  // GitHub profile link
  const githubLink = await page.$('a[href*="github.com/torvalds"]');
  log(section, 'GitHub profile link', githubLink ? 'PASS' : 'FAIL');
  if (githubLink) {
    const target = await githubLink.getAttribute('target');
    const rel = await githubLink.getAttribute('rel');
    log(section, 'GitHub link opens in new tab', target === '_blank' ? 'PASS' : 'FAIL', `target="${target}" rel="${rel}"`);
  }

  // Stats (followers, repos, stars)
  const hasFollowers = /follower/i.test(pageContent);
  const hasRepos = /repositor|repos?\b/i.test(pageContent);
  const hasStars = /star/i.test(pageContent);
  log(section, 'Follower stat visible', hasFollowers ? 'PASS' : 'WARN');
  log(section, 'Repo stat visible', hasRepos ? 'PASS' : 'WARN');
  log(section, 'Star stat visible', hasStars ? 'PASS' : 'WARN');

  // --- Score Breakdown ---
  const pillars = ['impact', 'contribution', 'consistency', 'technical', 'reputation'];
  let pillarsFound = pillars.filter(p => pageContent.toLowerCase().includes(p));
  log(section, 'Score pillars visible (5 expected)', pillarsFound.length >= 4 ? 'PASS' : pillarsFound.length >= 2 ? 'WARN' : 'FAIL', `Found ${pillarsFound.length}/5: ${pillarsFound.join(', ')}`);

  // Progress bars / animated bars
  const bars = await page.$$('[role="progressbar"], progress, [class*="progress" i], [style*="width:"][style*="%"]');
  log(section, 'Score visualization bars', bars.length > 0 ? 'PASS' : 'WARN', `Found ${bars.length} bar elements`);

  // Check for animation (transition/animation CSS)
  const hasAnimation = html.includes('transition') || html.includes('animation') || html.includes('animate');
  log(section, 'Bars have animation/transition', hasAnimation ? 'PASS' : 'WARN');

  // --- Languages Bar ---
  const hasLanguages = /language/i.test(pageContent);
  log(section, 'Languages section present', hasLanguages ? 'PASS' : 'WARN');

  // Check for specific languages (avoid C++ regex issue)
  const langChecks = ['C', 'Assembly', 'Shell', 'Makefile', 'Python'];
  const foundLangs = langChecks.filter(l => pageContent.includes(l));
  log(section, 'Programming languages listed', foundLangs.length > 0 ? 'PASS' : 'WARN', `Found: ${foundLangs.join(', ') || 'none'}`);

  // --- Repository Grid ---
  // Look for repo cards more broadly
  const repoElements = await page.$$eval('a[href*="github.com"][href*="/torvalds/"], [class*="repo" i]', els => els.length);
  log(section, 'Repository cards displayed', repoElements > 0 ? 'PASS' : 'WARN', `Found ${repoElements} repo elements`);

  const hasLinux = pageContent.includes('linux');
  log(section, 'Linux repo visible', hasLinux ? 'PASS' : 'WARN');

  // --- Collect all buttons for later tests ---
  const allButtons = await page.$$eval('button', els => els.map(e => ({
    text: e.textContent.trim().substring(0, 80),
    disabled: e.disabled,
    visible: e.offsetParent !== null
  })));
  log(section, 'Buttons inventory', 'INFO', `Found ${allButtons.length}: ${allButtons.filter(b => b.visible).map(b => b.text).filter(t => t).slice(0, 15).join(' | ')}`);

  // Specific button checks
  const buttonTexts = allButtons.map(b => b.text.toLowerCase()).join(' ');
  log(section, 'Scouting Report button', /scout|report|generat/i.test(buttonTexts) ? 'PASS' : 'WARN');
  log(section, 'Outreach Draft button', /outreach|draft/i.test(buttonTexts) ? 'PASS' : 'WARN');
  log(section, 'Find Similar button', /similar|find/i.test(buttonTexts) ? 'PASS' : 'WARN');
  log(section, 'Share Card button', /share/i.test(buttonTexts) ? 'PASS' : 'WARN');

  return { error: false, buttonTexts: allButtons };
}

// ============================================
// TEST 2: /profile/sindresorhus — Full Page Audit
// ============================================
async function testSindresorhusProfile(page) {
  const section = 'Profile: sindresorhus';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: /profile/sindresorhus — Full Page Audit');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'sindresorhus');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Page errored — database connection issue');
    await screenshot(page, '02-sindresorhus-error');
    return;
  }
  log(section, 'Page load', 'PASS', `Loaded on attempt ${load.attempt}`);

  await page.waitForTimeout(3000);
  await screenshot(page, '02-sindresorhus-full-page');

  const pageContent = await page.textContent('body');

  // Avatar
  const avatar = await page.$('img[src*="avatar"], img[src*="githubusercontent"]');
  log(section, 'Avatar image present', avatar ? 'PASS' : 'FAIL');

  // Name
  const hasName = /sindre sorhus/i.test(pageContent) || pageContent.includes('sindresorhus');
  log(section, 'Developer name/username displayed', hasName ? 'PASS' : 'WARN');

  // Bio
  const hasBio = /open.source|full.time|maker/i.test(pageContent);
  log(section, 'Bio text present', hasBio ? 'PASS' : 'WARN');

  // Location
  const hasLocation = /thailand|bangkok|norway/i.test(pageContent);
  log(section, 'Location info', hasLocation ? 'PASS' : 'WARN');

  // Website link
  const websiteLink = await page.$('a[href*="sindresorhus.com"]');
  log(section, 'Personal website link', websiteLink ? 'PASS' : 'WARN');
  if (websiteLink) {
    const target = await websiteLink.getAttribute('target');
    log(section, 'Website opens in new tab', target === '_blank' ? 'PASS' : 'FAIL', `target="${target}"`);
  }

  // Languages (TypeScript, JavaScript, Swift)
  const langs = ['TypeScript', 'JavaScript', 'Swift'];
  const foundLangs = langs.filter(l => pageContent.includes(l));
  log(section, 'Expected languages found', foundLangs.length >= 2 ? 'PASS' : 'WARN', `Found: ${foundLangs.join(', ')}`);

  // Repos
  const repoElements = await page.$$eval('a[href*="github.com"][href*="sindresorhus/"], [class*="repo" i]', els => els.length);
  log(section, 'Repository cards displayed', repoElements > 0 ? 'PASS' : 'WARN', `Found ${repoElements}`);

  // Score pillars
  const pillars = ['impact', 'contribution', 'consistency', 'technical', 'reputation'];
  const found = pillars.filter(p => pageContent.toLowerCase().includes(p));
  log(section, 'Score pillars visible', found.length >= 4 ? 'PASS' : 'WARN', `${found.length}/5`);

  // GitHub link
  const ghLink = await page.$('a[href*="github.com/sindresorhus"]');
  log(section, 'GitHub profile link', ghLink ? 'PASS' : 'FAIL');
}

// ============================================
// TEST 3: /profile/nonexistent-user-xyz — 404
// ============================================
async function test404Page(page) {
  const section = '404 Page';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: /profile/nonexistent-user-xyz — 404');
  console.log('='.repeat(60));

  const response = await page.goto(`${BASE}/profile/nonexistent-user-xyz`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await screenshot(page, '03-404-page');

  const statusCode = response?.status();
  log(section, 'HTTP status code', statusCode === 404 ? 'PASS' : 'WARN', `Got ${statusCode}`);

  const pageContent = await page.textContent('body');
  const has404 = /not found|404|doesn.t exist|no .* found/i.test(pageContent);
  log(section, '404 message displayed', has404 ? 'PASS' : 'FAIL', has404 ? 'Error message found' : 'No clear 404 message');

  const backLink = await page.$('a[href*="search"], a[href="/"]');
  log(section, 'Back navigation link', backLink ? 'PASS' : 'WARN');

  // Should not show profile content
  const hasProfileContent = /score breakdown|repositories|languages/i.test(pageContent);
  log(section, 'No leaked profile content', !hasProfileContent ? 'PASS' : 'FAIL');
}

// ============================================
// TEST 4: XSS Protection
// ============================================
async function testXSSProtection(page) {
  const section = 'XSS Protection';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: XSS Protection');
  console.log('='.repeat(60));

  let alertFired = false;
  const dialogHandler = async (dialog) => {
    alertFired = true;
    await dialog.dismiss();
  };
  page.on('dialog', dialogHandler);

  // Test script tag in URL
  const xssVectors = [
    { name: '<script>alert(1)</script>', path: '/profile/%3Cscript%3Ealert(1)%3C%2Fscript%3E' },
    { name: 'img onerror', path: '/profile/%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E' },
    { name: 'javascript: URI', path: '/profile/javascript:alert(1)' },
    { name: 'onmouseover', path: '/profile/%27%20onmouseover%3D%27alert(1)' },
  ];

  for (const vector of xssVectors) {
    alertFired = false;
    try {
      await page.goto(`${BASE}${vector.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      // Navigation errors are fine — means the URL was rejected
    }
    log(section, `XSS vector: ${vector.name}`, !alertFired ? 'PASS' : 'FAIL', alertFired ? 'VULNERABILITY: alert executed!' : 'No script execution');
  }

  await screenshot(page, '04-xss-attempt');

  // Check the page content for the script tag vector
  try {
    const pageContent = await page.textContent('body');
    const scriptVisible = pageContent.includes('<script>');
    log(section, 'Script tag not rendered as HTML', !scriptVisible ? 'PASS' : 'WARN', scriptVisible ? 'Script text visible (but not executed)' : 'Properly escaped');
  } catch {}

  page.off('dialog', dialogHandler);
}

// ============================================
// TEST 5: Action Button Interactions
// ============================================
async function testActionButtons(page) {
  const section = 'Action Buttons';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: Action Button Interactions');
  console.log('='.repeat(60));

  // --- Scouting Report ---
  console.log('\n--- Scouting Report ---');
  const load1 = await loadProfile(page, 'torvalds');
  if (!load1.success) {
    log(section, 'Scouting Report — page load', 'FAIL', 'Could not load profile');
  } else {
    await page.waitForTimeout(3000);

    // Find the Generate Scouting Report button - try multiple selectors
    let scoutBtn = await page.$('button:has-text("Generate Scouting Report")');
    if (!scoutBtn) scoutBtn = await page.$('button:has-text("Scouting Report")');
    if (!scoutBtn) scoutBtn = await page.$('button:has-text("Scout")');
    if (!scoutBtn) scoutBtn = await page.$('button:has-text("Generate")');

    if (scoutBtn) {
      const isVisible = await scoutBtn.isVisible();
      log(section, 'Scouting Report — button found', 'PASS', `Visible: ${isVisible}`);

      if (isVisible) {
        const beforeLen = (await page.textContent('body')).length;
        await scoutBtn.click();
        log(section, 'Scouting Report — clicked', 'PASS');

        // Wait for AI-generated content
        await page.waitForTimeout(10000);
        await screenshot(page, '05a-scouting-report');

        const afterContent = await page.textContent('body');
        const grew = afterContent.length > beforeLen + 100;
        log(section, 'Scouting Report — content generated', grew ? 'PASS' : 'WARN', `Content grew by ${afterContent.length - beforeLen} chars`);

        const hasAnalysis = /strength|weakness|recommend|skill|experience|expertise|notable|proficien|leadership/i.test(afterContent);
        log(section, 'Scouting Report — analytical content', hasAnalysis ? 'PASS' : 'WARN');
      }
    } else {
      log(section, 'Scouting Report — button', 'FAIL', 'Not found on page');
    }
  }

  // --- Draft Outreach ---
  console.log('\n--- Draft Outreach ---');
  const load2 = await loadProfile(page, 'torvalds');
  if (!load2.success) {
    log(section, 'Draft Outreach — page load', 'FAIL', 'Could not load profile');
  } else {
    await page.waitForTimeout(3000);

    let outreachBtn = await page.$('button:has-text("Draft Outreach")');
    if (!outreachBtn) outreachBtn = await page.$('button:has-text("Outreach")');
    if (!outreachBtn) outreachBtn = await page.$('button:has-text("Draft")');

    if (outreachBtn && await outreachBtn.isVisible()) {
      const beforeLen = (await page.textContent('body')).length;
      await outreachBtn.click();
      log(section, 'Draft Outreach — clicked', 'PASS');

      await page.waitForTimeout(10000);
      await screenshot(page, '05b-outreach-draft');

      const afterContent = await page.textContent('body');
      const grew = afterContent.length > beforeLen + 100;
      log(section, 'Draft Outreach — content generated', grew ? 'PASS' : 'WARN', `Grew by ${afterContent.length - beforeLen} chars`);

      // Check for 2 variants
      const subjectCount = (afterContent.match(/subject|variant|version|option/gi) || []).length;
      const greetingCount = (afterContent.match(/Hi |Hey |Dear |Hello /g) || []).length;
      const hasMultiple = subjectCount >= 2 || greetingCount >= 2;
      log(section, 'Draft Outreach — 2 variants', hasMultiple ? 'PASS' : 'WARN', `Subjects: ${subjectCount}, Greetings: ${greetingCount}`);
    } else {
      log(section, 'Draft Outreach — button', outreachBtn ? 'WARN' : 'FAIL', outreachBtn ? 'Found but not visible' : 'Not found');
    }
  }

  // --- Find Similar ---
  console.log('\n--- Find Similar ---');
  const load3 = await loadProfile(page, 'torvalds');
  if (!load3.success) {
    log(section, 'Find Similar — page load', 'FAIL', 'Could not load profile');
  } else {
    await page.waitForTimeout(3000);

    let similarBtn = await page.$('button:has-text("Find Similar")');
    if (!similarBtn) similarBtn = await page.$('button:has-text("Similar")');

    if (similarBtn && await similarBtn.isVisible()) {
      await similarBtn.click();
      log(section, 'Find Similar — clicked', 'PASS');
      await page.waitForTimeout(3000);

      const url = page.url();
      const modal = await page.$('[role="dialog"], [class*="modal" i]');
      log(section, 'Find Similar — response', url.includes('search') || modal ? 'PASS' : 'WARN', url.includes('search') ? `Navigated to ${url}` : modal ? 'Modal appeared' : 'No visible response');
      await screenshot(page, '05c-find-similar');
    } else {
      log(section, 'Find Similar — button', 'FAIL', 'Not found or not visible');
    }
  }

  // --- Share Card ---
  console.log('\n--- Share Card ---');
  const load4 = await loadProfile(page, 'torvalds');
  if (!load4.success) {
    log(section, 'Share Card — page load', 'FAIL', 'Could not load profile');
  } else {
    await page.waitForTimeout(3000);

    let shareBtn = await page.$('button:has-text("Share")');

    if (shareBtn && await shareBtn.isVisible()) {
      await shareBtn.click();
      log(section, 'Share Card — clicked', 'PASS');
      await page.waitForTimeout(2000);

      const modal = await page.$('[role="dialog"], [class*="modal" i], [class*="share" i]');
      log(section, 'Share Card — modal appeared', modal ? 'PASS' : 'WARN');
      await screenshot(page, '05d-share-card');
    } else {
      log(section, 'Share Card — button', 'FAIL', 'Not found or not visible');
    }
  }

  // --- GitHub Link ---
  console.log('\n--- GitHub Link ---');
  const load5 = await loadProfile(page, 'torvalds');
  if (load5.success) {
    await page.waitForTimeout(2000);
    const ghLink = await page.$('a[href*="github.com/torvalds"]');
    if (ghLink) {
      const href = await ghLink.getAttribute('href');
      const target = await ghLink.getAttribute('target');
      log(section, 'GitHub link', 'PASS', `href="${href}" target="${target}"`);
      log(section, 'GitHub link — new tab', target === '_blank' ? 'PASS' : 'FAIL', `target="${target}"`);
    } else {
      log(section, 'GitHub link', 'FAIL', 'Not found');
    }
  }
}

// ============================================
// TEST 6: Enrich Button
// ============================================
async function testEnrichButton(page) {
  const section = 'Enrich Button';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: Enrich Button');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'torvalds');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Could not load profile');
    return;
  }
  await page.waitForTimeout(3000);

  // Check if index is required first
  let indexBtn = await page.$('button:has-text("Index")');
  if (indexBtn && await indexBtn.isVisible()) {
    log(section, 'Index required first', 'INFO', 'Profile needs to be indexed before enrichment');

    await indexBtn.click();
    log(section, 'Index button clicked', 'PASS');
    await page.waitForTimeout(6000);
    await screenshot(page, '06a-after-index');
  }

  const enrichBtn = await page.$('button:has-text("Enrich")');
  if (enrichBtn) {
    const isVisible = await enrichBtn.isVisible();
    const isDisabled = await enrichBtn.isDisabled();
    log(section, 'Enrich button found', 'PASS', `visible: ${isVisible}, disabled: ${isDisabled}`);

    if (isVisible && !isDisabled) {
      await enrichBtn.click();
      log(section, 'Enrich button clicked', 'PASS');
      await page.waitForTimeout(5000);
      await screenshot(page, '06b-enrich-result');

      const content = await page.textContent('body');
      const hasContact = /email|phone|linkedin|contact|twitter/i.test(content);
      const hasError = /error|failed|unavailable|api.*key/i.test(content);
      log(section, 'Enrich result', hasContact ? 'PASS' : hasError ? 'WARN' : 'WARN',
        hasContact ? 'Contact info appeared' : hasError ? 'Error (expected without API key)' : 'Unclear result');
    }
  } else {
    log(section, 'Enrich button', 'WARN', 'Not found — may require auth or indexing');
    await screenshot(page, '06-no-enrich');
  }
}

// ============================================
// TEST 7: Save/Favorite Button (needs auth)
// ============================================
async function testFavoriteButton(page) {
  const section = 'Favorite Button';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 7: Favorite Button (auth required)');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'torvalds');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Could not load profile');
    return;
  }
  await page.waitForTimeout(3000);

  let favBtn = await page.$('button:has-text("Save"), button:has-text("Favorite"), [aria-label*="favorite" i], [aria-label*="save" i]');
  if (!favBtn) {
    // Check if hidden behind index
    const indexBtn = await page.$('button:has-text("Index")');
    if (indexBtn && await indexBtn.isVisible()) {
      log(section, 'Favorite button hidden behind Index', 'INFO', 'Need to index first');
      await indexBtn.click();
      await page.waitForTimeout(5000);
      favBtn = await page.$('button:has-text("Save"), button:has-text("Favorite"), [aria-label*="favorite" i]');
    }
  }

  if (favBtn) {
    log(section, 'Favorite button found', 'PASS');
    await favBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '07-favorite-click');

    const content = await page.textContent('body');
    const needsAuth = /sign in|log in|auth|login/i.test(content);
    const toast = await page.$('[class*="toast" i], [data-sonner-toast]');
    log(section, 'Favorite button response', 'INFO', needsAuth ? 'Auth required message' : toast ? 'Toast notification shown' : 'Button responded');
  } else {
    log(section, 'Favorite button', 'WARN', 'Not found on page');
    await screenshot(page, '07-no-favorite');
  }
}

// ============================================
// TEST 8: Push to Ashby (needs auth)
// ============================================
async function testAshbyButton(page) {
  const section = 'Push to Ashby';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 8: Push to Ashby (auth required)');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'torvalds');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Could not load profile');
    return;
  }
  await page.waitForTimeout(3000);

  // Index first if needed
  const indexBtn = await page.$('button:has-text("Index")');
  if (indexBtn && await indexBtn.isVisible()) {
    await indexBtn.click();
    await page.waitForTimeout(5000);
  }

  const ashbyBtn = await page.$('button:has-text("Ashby"), button:has-text("Push to"), button:has-text("ATS")');
  if (ashbyBtn) {
    log(section, 'Push to Ashby button found', 'PASS');
    await ashbyBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, '08-ashby-click');

    const content = await page.textContent('body');
    const needsAuth = /sign in|log in|auth/i.test(content);
    const needsConfig = /api.key|configure|setup|connect/i.test(content);
    const toast = await page.$('[class*="toast" i], [data-sonner-toast]');
    log(section, 'Ashby button response', 'INFO',
      needsAuth ? 'Auth required' : needsConfig ? 'Configuration needed' : toast ? 'Toast shown' : 'Button responded');
  } else {
    log(section, 'Push to Ashby button', 'WARN', 'Not found');
    await screenshot(page, '08-no-ashby');
  }
}

// ============================================
// TEST 9: Add to List (needs auth)
// ============================================
async function testAddToListButton(page) {
  const section = 'Add to List';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 9: Add to List (auth required)');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'torvalds');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Could not load profile');
    return;
  }
  await page.waitForTimeout(3000);

  // Index first if needed
  const indexBtn = await page.$('button:has-text("Index")');
  if (indexBtn && await indexBtn.isVisible()) {
    await indexBtn.click();
    await page.waitForTimeout(5000);
  }

  const listBtn = await page.$('button:has-text("Add to List"), button:has-text("Add to"), button:has-text("List")');
  if (listBtn) {
    log(section, 'Add to List button found', 'PASS');
    await listBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, '09-add-to-list');

    const content = await page.textContent('body');
    const needsAuth = /sign in|log in|auth/i.test(content);
    const modal = await page.$('[role="dialog"], [class*="modal" i]');
    log(section, 'Add to List response', 'INFO',
      needsAuth ? 'Auth required' : modal ? 'Modal appeared' : 'Button responded');
  } else {
    log(section, 'Add to List button', 'WARN', 'Not found');
    await screenshot(page, '09-no-list-btn');
  }
}

// ============================================
// TEST 10: Responsive Screenshots
// ============================================
async function testResponsive(browser) {
  const section = 'Responsive';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 10: Responsive Design');
  console.log('='.repeat(60));

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'laptop-1024', width: 1024, height: 768 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-375', width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    const load = await loadProfile(page, 'torvalds');
    if (!load.success) {
      log(section, `${vp.name} — page load`, 'FAIL', 'Could not load profile');
      await screenshot(page, `10-responsive-${vp.name}-error`);
      await page.close();
      await ctx.close();
      continue;
    }
    await page.waitForTimeout(3000);
    await screenshot(page, `10-responsive-${vp.name}`);

    // Check horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const hasOverflow = bodyWidth > vp.width + 5;
    log(section, `${vp.name} — no horizontal overflow`, !hasOverflow ? 'PASS' : 'FAIL', `body=${bodyWidth}px viewport=${vp.width}px`);

    // Check avatar visible
    const avatar = await page.$('img[src*="avatar"], img[src*="githubusercontent"]');
    const avatarVisible = avatar ? await avatar.isVisible() : false;
    log(section, `${vp.name} — avatar visible`, avatarVisible ? 'PASS' : 'WARN');

    // Check buttons not clipped
    const clipped = await page.evaluate((vpWidth) => {
      let count = 0;
      document.querySelectorAll('button').forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && (rect.right > vpWidth + 2 || rect.left < -2)) count++;
      });
      return count;
    }, vp.width);
    log(section, `${vp.name} — buttons within viewport`, clipped === 0 ? 'PASS' : 'WARN', clipped > 0 ? `${clipped} buttons clipped` : '');

    // Check text not overflowing
    const textOverflow = await page.evaluate((vpWidth) => {
      let count = 0;
      document.querySelectorAll('p, h1, h2, h3, span, a').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > vpWidth + 10) count++;
      });
      return count;
    }, vp.width);
    log(section, `${vp.name} — text within viewport`, textOverflow === 0 ? 'PASS' : 'WARN', textOverflow > 0 ? `${textOverflow} elements overflow` : '');

    await page.close();
    await ctx.close();
  }
}

// ============================================
// TEST 11: Dark Mode Consistency
// ============================================
async function testDarkMode(browser) {
  const section = 'Dark Mode';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 11: Dark Mode Consistency');
  console.log('='.repeat(60));

  // Light mode
  const lightCtx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1440, height: 900 } });
  const lightPage = await lightCtx.newPage();
  const lightLoad = await loadProfile(lightPage, 'torvalds');

  let lightBg = 'unknown';
  if (lightLoad.success) {
    await lightPage.waitForTimeout(3000);
    await screenshot(lightPage, '11-light-mode');
    lightBg = await lightPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    log(section, 'Light mode captured', 'PASS', `BG: ${lightBg}`);
  } else {
    log(section, 'Light mode page load', 'FAIL', 'Could not load profile');
    await screenshot(lightPage, '11-light-mode-error');
  }
  await lightPage.close();
  await lightCtx.close();

  // Dark mode
  const darkCtx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
  const darkPage = await darkCtx.newPage();
  const darkLoad = await loadProfile(darkPage, 'torvalds');

  let darkBg = 'unknown';
  if (darkLoad.success) {
    await darkPage.waitForTimeout(3000);
    await screenshot(darkPage, '11-dark-mode');
    darkBg = await darkPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    log(section, 'Dark mode captured', 'PASS', `BG: ${darkBg}`);
  } else {
    log(section, 'Dark mode page load', 'FAIL', 'Could not load profile');
    await screenshot(darkPage, '11-dark-mode-error');
  }

  if (lightBg !== 'unknown' && darkBg !== 'unknown') {
    log(section, 'Light/dark themes differ', lightBg !== darkBg ? 'PASS' : 'FAIL', `Light: ${lightBg}, Dark: ${darkBg}`);
  }

  // Check for white backgrounds in dark mode that shouldn't be there
  if (darkLoad.success) {
    const whiteElements = await darkPage.evaluate(() => {
      const issues = [];
      document.querySelectorAll('div, section, article, main, aside').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.backgroundColor === 'rgb(255, 255, 255)' && el.offsetWidth > 100 && el.offsetHeight > 40) {
          issues.push({ tag: el.tagName, class: el.className?.substring(0, 40), size: `${el.offsetWidth}x${el.offsetHeight}` });
        }
      });
      return issues.slice(0, 5);
    });
    log(section, 'Dark mode — no white backgrounds', whiteElements.length === 0 ? 'PASS' : 'WARN', whiteElements.length > 0 ? `${whiteElements.length} white elements: ${JSON.stringify(whiteElements[0])}` : 'All themed properly');

    // Check text contrast in dark mode
    const textContrast = await darkPage.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return { text: 'no h1', bg: 'n/a' };
      return {
        text: window.getComputedStyle(h1).color,
        bg: window.getComputedStyle(document.body).backgroundColor
      };
    });
    log(section, 'Dark mode — text contrast', 'INFO', `Text: ${textContrast.text}, BG: ${textContrast.bg}`);
  }

  await darkPage.close();
  await darkCtx.close();
}

// ============================================
// TEST 12: External Links — New Tab
// ============================================
async function testExternalLinks(page) {
  const section = 'External Links';
  console.log('\n' + '='.repeat(60));
  console.log('TEST 12: External Links Open in New Tab');
  console.log('='.repeat(60));

  const load = await loadProfile(page, 'torvalds');
  if (!load.success) {
    log(section, 'Page load', 'FAIL', 'Could not load profile');
    return;
  }
  await page.waitForTimeout(3000);

  const linkData = await page.$$eval('a[href]', els => els.map(e => ({
    href: e.href,
    target: e.target || '',
    rel: e.rel || '',
    text: e.textContent?.trim()?.substring(0, 40) || '',
    visible: e.offsetParent !== null
  })));

  const externalLinks = linkData.filter(l => l.href.startsWith('http') && !l.href.includes('localhost'));
  const visibleExternal = externalLinks.filter(l => l.visible);

  log(section, 'External links found', externalLinks.length > 0 ? 'PASS' : 'WARN', `${externalLinks.length} total (${visibleExternal.length} visible)`);

  let missingBlank = [];
  let missingNoopener = [];

  for (const link of visibleExternal) {
    if (link.target !== '_blank') {
      missingBlank.push({ href: link.href.substring(0, 60), text: link.text });
    }
    if (link.target === '_blank' && !link.rel.includes('noopener')) {
      missingNoopener.push({ href: link.href.substring(0, 60) });
    }
  }

  log(section, 'All visible external links → new tab', missingBlank.length === 0 ? 'PASS' : 'FAIL',
    missingBlank.length > 0 ? `${missingBlank.length} missing target="_blank": ${JSON.stringify(missingBlank.slice(0, 3))}` : `All ${visibleExternal.length} links correct`);

  log(section, 'rel="noopener" on _blank links', missingNoopener.length === 0 ? 'PASS' : 'WARN',
    missingNoopener.length > 0 ? `${missingNoopener.length} missing rel="noopener"` : 'All secured');

  // List all external links for the report
  for (const link of visibleExternal.slice(0, 10)) {
    log(section, `Link: ${link.text || link.href.substring(0, 40)}`, link.target === '_blank' ? 'PASS' : 'FAIL', `→ ${link.href.substring(0, 60)} target="${link.target}"`);
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('🔬 GitScout QA — Profile Pages Deep Dive');
  console.log('Started:', new Date().toISOString());
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text().substring(0, 200);
      CONSOLE_ERRORS.push(text);
    }
  });

  // Track network errors
  page.on('requestfailed', request => {
    NETWORK_ERRORS.push({ url: request.url().substring(0, 100), failure: request.failure()?.errorText });
  });

  try {
    const torvaldsResult = await testTorvaldsProfile(page);
    await testSindresorhusProfile(page);
    await test404Page(page);
    await testXSSProtection(page);
    await testActionButtons(page);
    await testEnrichButton(page);
    await testFavoriteButton(page);
    await testAshbyButton(page);
    await testAddToListButton(page);
    await testResponsive(browser);
    await testDarkMode(browser);
    await testExternalLinks(page);
  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err.message);
    log('FATAL', err.message, 'FAIL', err.stack?.substring(0, 300));
  }

  // Report console/network errors
  if (CONSOLE_ERRORS.length > 0) {
    console.log(`\n--- Console Errors (${CONSOLE_ERRORS.length}) ---`);
    [...new Set(CONSOLE_ERRORS)].slice(0, 10).forEach(e => console.log('  ❌', e.substring(0, 150)));
    log('Console', 'Browser console errors', CONSOLE_ERRORS.length > 5 ? 'FAIL' : 'WARN', `${CONSOLE_ERRORS.length} total errors`);
  }
  if (NETWORK_ERRORS.length > 0) {
    console.log(`\n--- Network Errors (${NETWORK_ERRORS.length}) ---`);
    NETWORK_ERRORS.slice(0, 5).forEach(e => console.log('  ❌', e.url, '—', e.failure));
    log('Network', 'Network request failures', 'WARN', `${NETWORK_ERRORS.length} failures`);
  }

  await context.close();
  await browser.close();

  // Write results
  fs.writeFileSync('qa-reports/search-deep-dive/profile-pages-results.json', JSON.stringify({
    results: RESULTS,
    consoleErrors: [...new Set(CONSOLE_ERRORS)],
    networkErrors: NETWORK_ERRORS.slice(0, 20),
    timestamp: new Date().toISOString()
  }, null, 2));

  // Summary
  const pass = RESULTS.filter(r => r.status === 'PASS').length;
  const fail = RESULTS.filter(r => r.status === 'FAIL').length;
  const warn = RESULTS.filter(r => r.status === 'WARN').length;
  const info = RESULTS.filter(r => r.status === 'INFO').length;

  console.log('\n' + '='.repeat(60));
  console.log(`📊 SUMMARY: ${pass} PASS | ${fail} FAIL | ${warn} WARN | ${info} INFO`);
  console.log('='.repeat(60));
}

main().catch(console.error);
