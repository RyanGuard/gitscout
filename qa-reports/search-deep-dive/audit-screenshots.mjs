/**
 * Visual & Accessibility Audit — Screenshot capture for all pages
 * Desktop (1440px) and Mobile (375px) in dark mode
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';

const PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'search-empty', path: '/search' },
  { name: 'search-results', path: '/search?q=react&language=javascript' },
  { name: 'profile-torvalds', path: '/profile/torvalds' },
  { name: 'map', path: '/map' },
  { name: 'lists', path: '/lists' },
  { name: 'match', path: '/match' },
  { name: 'favorites', path: '/favorites' },
  { name: 'settings', path: '/settings' },
  { name: 'map-templates', path: '/map/templates' },
];

async function captureAll() {
  const browser = await chromium.launch();
  const results = { desktop: {}, mobile: {} };

  // Desktop: 1440px dark mode
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const desktopPage = await desktopCtx.newPage();

  for (const pg of PAGES) {
    const file = `screenshots/desktop/${pg.name}.png`;
    try {
      await desktopPage.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await desktopPage.waitForTimeout(1000); // let animations settle
      await desktopPage.screenshot({ path: `qa-reports/search-deep-dive/${file}`, fullPage: true });
      results.desktop[pg.name] = { status: 'captured', path: file };
      console.log(`✓ Desktop: ${pg.name}`);
    } catch (e) {
      // Try with domcontentloaded fallback
      try {
        await desktopPage.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await desktopPage.waitForTimeout(2000);
        await desktopPage.screenshot({ path: `qa-reports/search-deep-dive/${file}`, fullPage: true });
        results.desktop[pg.name] = { status: 'captured-fallback', path: file };
        console.log(`✓ Desktop (fallback): ${pg.name}`);
      } catch (e2) {
        results.desktop[pg.name] = { status: 'error', error: e2.message };
        console.log(`✗ Desktop: ${pg.name} — ${e2.message}`);
      }
    }
  }
  await desktopCtx.close();

  // Mobile: 375px dark mode
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const mobilePage = await mobileCtx.newPage();

  for (const pg of PAGES) {
    const file = `screenshots/mobile/${pg.name}.png`;
    try {
      await mobilePage.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await mobilePage.waitForTimeout(1000);
      await mobilePage.screenshot({ path: `qa-reports/search-deep-dive/${file}`, fullPage: true });
      results.mobile[pg.name] = { status: 'captured', path: file };
      console.log(`✓ Mobile: ${pg.name}`);
    } catch (e) {
      try {
        await mobilePage.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await mobilePage.waitForTimeout(2000);
        await mobilePage.screenshot({ path: `qa-reports/search-deep-dive/${file}`, fullPage: true });
        results.mobile[pg.name] = { status: 'captured-fallback', path: file };
        console.log(`✓ Mobile (fallback): ${pg.name}`);
      } catch (e2) {
        results.mobile[pg.name] = { status: 'error', error: e2.message };
        console.log(`✗ Mobile: ${pg.name} — ${e2.message}`);
      }
    }
  }
  await mobileCtx.close();

  await browser.close();
  fs.writeFileSync('qa-reports/search-deep-dive/screenshot-results.json', JSON.stringify(results, null, 2));
  console.log('\nScreenshot capture complete.');
}

captureAll().catch(console.error);
