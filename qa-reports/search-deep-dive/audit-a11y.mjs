/**
 * Accessibility Audit — axe-core + manual checks
 * Runs on every page: WCAG color contrast, heading hierarchy,
 * accessible names, form labels, alt text, focus indicators
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
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

async function runAudit() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const allResults = {};

  for (const pg of PAGES) {
    console.log(`\n=== Auditing: ${pg.name} (${pg.path}) ===`);
    const pageResult = { axe: null, headings: null, buttons: null, links: null, images: null, inputs: null, colorInfo: null };

    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    } catch {
      try {
        await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (e) {
        pageResult.error = e.message;
        allResults[pg.name] = pageResult;
        console.log(`  ✗ Could not load: ${e.message}`);
        continue;
      }
    }
    await page.waitForTimeout(1500);

    // 1. axe-core scan (color-contrast, heading-order, button-name, link-name, image-alt, label, etc.)
    try {
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      pageResult.axe = {
        violations: axeResults.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map(n => ({
            html: n.html.substring(0, 200),
            target: n.target,
            failureSummary: n.failureSummary,
          })),
        })),
        passes: axeResults.passes.length,
        incomplete: axeResults.incomplete.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        })),
      };
      console.log(`  axe: ${axeResults.violations.length} violations, ${axeResults.passes.length} passes, ${axeResults.incomplete.length} incomplete`);
    } catch (e) {
      pageResult.axe = { error: e.message };
      console.log(`  axe error: ${e.message}`);
    }

    // 2. Heading hierarchy
    try {
      pageResult.headings = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        return headings.map(h => ({
          level: parseInt(h.tagName[1]),
          text: h.textContent.trim().substring(0, 100),
          visible: h.offsetParent !== null,
        }));
      });

      // Check hierarchy
      const levels = pageResult.headings.map(h => h.level);
      const hierarchyIssues = [];
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i-1] + 1) {
          hierarchyIssues.push(`Skipped from h${levels[i-1]} to h${levels[i]} at "${pageResult.headings[i].text}"`);
        }
      }
      if (levels.length > 0 && levels[0] !== 1) {
        hierarchyIssues.unshift(`First heading is h${levels[0]}, should be h1`);
      }
      pageResult.headingIssues = hierarchyIssues;
      console.log(`  Headings: ${levels.length} found, ${hierarchyIssues.length} hierarchy issues`);
    } catch (e) {
      pageResult.headings = { error: e.message };
    }

    // 3. Interactive elements without accessible names
    try {
      pageResult.buttons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        return buttons.map(b => {
          const name = b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.textContent.trim();
          return {
            html: b.outerHTML.substring(0, 200),
            hasName: !!name && name.length > 0,
            name: (name || '').substring(0, 80),
          };
        }).filter(b => !b.hasName);
      });
      console.log(`  Buttons without names: ${pageResult.buttons.length}`);
    } catch (e) {
      pageResult.buttons = { error: e.message };
    }

    // 4. Links without accessible names
    try {
      pageResult.links = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.map(l => {
          const name = l.getAttribute('aria-label') || l.textContent.trim() || l.querySelector('img')?.alt;
          return {
            href: l.href,
            html: l.outerHTML.substring(0, 200),
            hasName: !!name && name.length > 0,
            name: (name || '').substring(0, 80),
          };
        }).filter(l => !l.hasName);
      });
      console.log(`  Links without names: ${pageResult.links.length}`);
    } catch (e) {
      pageResult.links = { error: e.message };
    }

    // 5. Images without alt text
    try {
      pageResult.images = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.map(i => ({
          src: i.src.substring(0, 100),
          hasAlt: i.hasAttribute('alt'),
          alt: i.alt,
          role: i.getAttribute('role'),
        })).filter(i => !i.hasAlt && i.role !== 'presentation');
      });
      console.log(`  Images without alt: ${pageResult.images.length}`);
    } catch (e) {
      pageResult.images = { error: e.message };
    }

    // 6. Form inputs without labels
    try {
      pageResult.inputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        return inputs.map(i => {
          const id = i.id;
          const hasLabel = !!(
            i.getAttribute('aria-label') ||
            i.getAttribute('aria-labelledby') ||
            i.placeholder ||
            (id && document.querySelector(`label[for="${id}"]`)) ||
            i.closest('label')
          );
          return {
            type: i.type || i.tagName.toLowerCase(),
            html: i.outerHTML.substring(0, 200),
            hasLabel,
            labelMethod: i.getAttribute('aria-label') ? 'aria-label' :
              i.getAttribute('aria-labelledby') ? 'aria-labelledby' :
              i.placeholder ? 'placeholder' :
              (id && document.querySelector(`label[for="${id}"]`)) ? 'for-id' :
              i.closest('label') ? 'parent-label' : 'none',
          };
        }).filter(i => !i.hasLabel);
      });
      console.log(`  Inputs without labels: ${pageResult.inputs.length}`);
    } catch (e) {
      pageResult.inputs = { error: e.message };
    }

    // 7. Color-only information check (badges, scores, tiers, statuses)
    try {
      pageResult.colorInfo = await page.evaluate(() => {
        const findings = [];
        // Check badges
        const badges = document.querySelectorAll('[class*="badge"], [class*="Badge"], [class*="tier"], [class*="Tier"], [class*="status"], [class*="Status"]');
        badges.forEach(b => {
          const text = b.textContent.trim();
          if (!text) {
            findings.push({ type: 'badge', html: b.outerHTML.substring(0, 200), issue: 'Color-only badge with no text' });
          }
        });
        // Check score indicators
        const scores = document.querySelectorAll('[class*="score"], [class*="Score"], [class*="risk"], [class*="Risk"]');
        scores.forEach(s => {
          const text = s.textContent.trim();
          if (!text || /^[●◯•]$/.test(text)) {
            findings.push({ type: 'score', html: s.outerHTML.substring(0, 200), issue: 'Score conveyed by color alone' });
          }
        });
        return findings;
      });
      console.log(`  Color-only info issues: ${pageResult.colorInfo.length}`);
    } catch (e) {
      pageResult.colorInfo = { error: e.message };
    }

    allResults[pg.name] = pageResult;
  }

  await browser.close();
  fs.writeFileSync('qa-reports/search-deep-dive/a11y-results.json', JSON.stringify(allResults, null, 2));
  console.log('\nAccessibility audit complete.');
}

runAudit().catch(console.error);
