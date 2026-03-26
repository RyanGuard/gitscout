/**
 * Keyboard Navigation & Focus Indicator Audit
 * Tests tab navigation, focus visibility, and keyboard-only workflows
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';

async function runKeyboardAudit() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const results = {};

  // === Test 1: Focus indicators on search page ===
  console.log('=== Focus Indicator Test (Search Page) ===');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
    page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded', timeout: 10000 })
  );
  await page.waitForTimeout(1500);

  const focusResults = [];
  // Tab through elements and capture focus state
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;

      const styles = window.getComputedStyle(el);
      const outlineStyle = styles.outline;
      const outlineWidth = styles.outlineWidth;
      const outlineColor = styles.outlineColor;
      const boxShadow = styles.boxShadow;
      const borderColor = styles.borderColor;

      // Check if focus indicator is visible
      const hasOutline = outlineWidth !== '0px' && outlineStyle !== 'none';
      const hasBoxShadow = boxShadow !== 'none';
      const hasFocusRing = el.classList.contains('focus-visible') || el.matches(':focus-visible');

      return {
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.type,
        text: (el.textContent || '').trim().substring(0, 60),
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className?.toString().substring(0, 100),
        hasOutline,
        hasBoxShadow,
        hasFocusRing,
        outlineStyle,
        outlineColor,
        boxShadow: boxShadow.substring(0, 100),
        focusVisible: hasOutline || hasBoxShadow || hasFocusRing,
      };
    });

    if (focusInfo) {
      focusResults.push(focusInfo);
      const status = focusInfo.focusVisible ? '✓' : '✗ NO FOCUS INDICATOR';
      console.log(`  Tab ${i+1}: <${focusInfo.tag}> "${focusInfo.text?.substring(0,30) || focusInfo.ariaLabel || ''}" ${status}`);
    }
  }

  // Screenshot the focus state
  await page.screenshot({ path: 'qa-reports/search-deep-dive/screenshots/desktop/search-focus-state.png', fullPage: true });

  results.focusIndicators = {
    total: focusResults.length,
    withVisible: focusResults.filter(f => f.focusVisible).length,
    withoutVisible: focusResults.filter(f => !f.focusVisible).length,
    elements: focusResults,
  };

  // === Test 2: Keyboard search workflow ===
  console.log('\n=== Keyboard Search Workflow ===');
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
    page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded', timeout: 10000 })
  );
  await page.waitForTimeout(1000);

  const searchWorkflow = [];

  // Try to find and focus search input
  const searchInput = await page.$('input[type="search"], input[type="text"], input[name*="search"], input[name*="query"], input[placeholder*="earch"]');
  if (searchInput) {
    await searchInput.focus();
    await page.keyboard.type('torvalds', { delay: 50 });
    await page.waitForTimeout(500);
    searchWorkflow.push({ step: 'type-query', status: 'success', detail: 'Typed "torvalds" in search input' });

    // Try Enter to submit
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const url = page.url();
    searchWorkflow.push({ step: 'submit-enter', status: url.includes('torvalds') ? 'success' : 'partial', detail: `URL: ${url}` });

    // Check if results appeared
    const hasResults = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="result"], [class*="Result"]');
      return cards.length;
    });
    searchWorkflow.push({ step: 'results-visible', status: hasResults > 0 ? 'success' : 'fail', detail: `${hasResults} result cards found` });

    // Try tabbing to first result
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    const firstResultFocusable = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        href: el?.href || null,
        text: (el?.textContent || '').trim().substring(0, 60),
      };
    });
    searchWorkflow.push({ step: 'tab-to-result', status: firstResultFocusable.href ? 'success' : 'partial', detail: JSON.stringify(firstResultFocusable) });

    // Try Enter on result
    if (firstResultFocusable.href) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      const profileUrl = page.url();
      searchWorkflow.push({ step: 'enter-on-result', status: profileUrl.includes('profile') ? 'success' : 'partial', detail: `Navigated to: ${profileUrl}` });
    }

    await page.screenshot({ path: 'qa-reports/search-deep-dive/screenshots/desktop/keyboard-workflow.png', fullPage: true });
  } else {
    searchWorkflow.push({ step: 'find-input', status: 'fail', detail: 'Could not find search input' });
  }

  results.searchWorkflow = searchWorkflow;

  // === Test 3: Dark mode contrast spot check ===
  console.log('\n=== Dark Mode Contrast Spot Check ===');
  await page.goto(`${BASE}/search?q=react&language=javascript`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
    page.goto(`${BASE}/search?q=react&language=javascript`, { waitUntil: 'domcontentloaded', timeout: 10000 })
  );
  await page.waitForTimeout(2000);

  const contrastCheck = await page.evaluate(() => {
    function getContrast(rgb1, rgb2) {
      function luminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }
      const l1 = luminance(...rgb1);
      const l2 = luminance(...rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function parseColor(color) {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
      return null;
    }

    function getEffectiveBg(el) {
      let current = el;
      while (current) {
        const bg = window.getComputedStyle(current).backgroundColor;
        const parsed = parseColor(bg);
        if (parsed && !(parsed[0] === 0 && parsed[1] === 0 && parsed[2] === 0 && bg.includes('0)'))) {
          // Not fully transparent
          const alpha = bg.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)/);
          if (!alpha || parseFloat(alpha[1]) > 0.1) return parsed;
        }
        current = current.parentElement;
      }
      // Dark mode default: assume dark background
      return [0, 0, 0];
    }

    const checks = [];
    const selectors = [
      { name: 'body-text', sel: 'p, span, div', filter: el => el.textContent.trim().length > 10 && el.children.length === 0 },
      { name: 'headings', sel: 'h1, h2, h3, h4, h5, h6', filter: () => true },
      { name: 'buttons', sel: 'button', filter: () => true },
      { name: 'links', sel: 'a', filter: el => el.textContent.trim().length > 0 },
      { name: 'badges', sel: '[class*="badge"], [class*="Badge"]', filter: () => true },
      { name: 'placeholders', sel: 'input[placeholder]', filter: () => true },
    ];

    for (const { name, sel, filter } of selectors) {
      const elements = Array.from(document.querySelectorAll(sel)).filter(filter).slice(0, 10);
      for (const el of elements) {
        const styles = window.getComputedStyle(el);
        let textColor;

        // For placeholders, we need special handling
        if (name === 'placeholders') {
          // Can't directly get placeholder color via JS, use the element's color as approximation
          textColor = parseColor(styles.color);
        } else {
          textColor = parseColor(styles.color);
        }

        const bgColor = getEffectiveBg(el);
        if (!textColor || !bgColor) continue;

        const ratio = getContrast(textColor, bgColor);
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = parseInt(styles.fontWeight) || 400;
        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const minRatio = isLargeText ? 3.0 : 4.5;
        const passes = ratio >= minRatio;

        if (!passes || ratio < 5.0) {  // Report failures and near-failures
          checks.push({
            category: name,
            text: (el.textContent || el.placeholder || '').trim().substring(0, 50),
            textColor: `rgb(${textColor.join(',')})`,
            bgColor: `rgb(${bgColor.join(',')})`,
            ratio: Math.round(ratio * 100) / 100,
            fontSize,
            fontWeight,
            isLargeText,
            minRequired: minRatio,
            passes,
          });
        }
      }
    }
    return checks;
  });

  results.contrastCheck = contrastCheck;
  console.log(`  Contrast issues found: ${contrastCheck.filter(c => !c.passes).length}`);
  console.log(`  Near-fails (< 5.0): ${contrastCheck.filter(c => c.passes && c.ratio < 5.0).length}`);

  // === Test 4: Visual consistency check ===
  console.log('\n=== Visual Consistency Check ===');
  const visualCheck = await page.evaluate(() => {
    const findings = [];

    // Check border radius consistency
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
    const radii = new Set();
    cards.forEach(c => {
      const r = window.getComputedStyle(c).borderRadius;
      radii.add(r);
    });
    if (radii.size > 2) {
      findings.push({ type: 'border-radius', detail: `Cards use ${radii.size} different border radii: ${[...radii].join(', ')}` });
    }

    // Check padding consistency on similar elements
    const buttons = document.querySelectorAll('button');
    const paddings = new Map();
    buttons.forEach(b => {
      const p = window.getComputedStyle(b).padding;
      paddings.set(p, (paddings.get(p) || 0) + 1);
    });
    if (paddings.size > 4) {
      findings.push({ type: 'button-padding', detail: `Buttons use ${paddings.size} different padding values: ${[...paddings.keys()].slice(0, 5).join(', ')}` });
    }

    // Check font sizes used
    const textElements = document.querySelectorAll('p, span, div, a, button, h1, h2, h3, h4, h5, h6, label');
    const fontSizes = new Map();
    textElements.forEach(t => {
      if (t.offsetParent === null) return; // skip hidden
      const fs = window.getComputedStyle(t).fontSize;
      fontSizes.set(fs, (fontSizes.get(fs) || 0) + 1);
    });
    if (fontSizes.size > 10) {
      findings.push({ type: 'font-sizes', detail: `${fontSizes.size} different font sizes used: ${[...fontSizes.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8).map(([s,c]) => `${s}(${c})`).join(', ')}` });
    }

    return findings;
  });

  results.visualConsistency = visualCheck;

  await browser.close();
  fs.writeFileSync('qa-reports/search-deep-dive/keyboard-results.json', JSON.stringify(results, null, 2));
  console.log('\nKeyboard & visual audit complete.');
}

runKeyboardAudit().catch(console.error);
