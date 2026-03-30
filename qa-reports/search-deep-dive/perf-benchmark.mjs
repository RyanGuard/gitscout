/**
 * Scout Performance Benchmark Suite
 * Playwright-based performance testing
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = {};

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  return { min: Math.round(min), max: Math.round(max), avg: Math.round(avg), median: Math.round(median), runs: arr };
}

async function timePageLoad(page, url, label) {
  const start = performance.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const elapsed = performance.now() - start;
  return elapsed;
}

async function timePageLoadFull(page, url) {
  const start = performance.now();
  await page.goto(url, { waitUntil: 'load' });
  const elapsed = performance.now() - start;
  return elapsed;
}

async function getDOMNodeCount(page) {
  return await page.evaluate(() => document.querySelectorAll('*').length);
}

async function getJSHeapSize(page) {
  // Only works in chromium with specific flags
  return await page.evaluate(() => {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
      };
    }
    return null;
  });
}

// ============================================================
// BENCHMARKS
// ============================================================

async function bench1_homepageLoad(browser) {
  console.log('\n=== Benchmark 1: Homepage Load Time (3 runs) ===');
  const times = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    const t = await timePageLoad(page, BASE, 'homepage');
    times.push(t);
    console.log(`  Run ${i + 1}: ${Math.round(t)}ms`);
    await page.close();
  }
  results.homepageLoad = stats(times);
  results.homepageLoad.target = 500;
  results.homepageLoad.pass = results.homepageLoad.avg < 500;
  console.log(`  Avg: ${results.homepageLoad.avg}ms | Target: <500ms | ${results.homepageLoad.pass ? 'PASS' : 'FAIL'}`);
}

async function bench2_searchPageLoad(browser) {
  console.log('\n=== Benchmark 2: Search Page Load Time (3 runs) ===');
  const times = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    const t = await timePageLoad(page, `${BASE}/search`, 'search');
    times.push(t);
    console.log(`  Run ${i + 1}: ${Math.round(t)}ms`);
    await page.close();
  }
  results.searchPageLoad = stats(times);
}

async function bench3_searchPythonAPI(browser) {
  console.log('\n=== Benchmark 3: Search "python" API Response (5 runs) ===');
  const times = [];
  const page = await browser.newPage();
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const resp = await page.request.get(`${BASE}/api/search?q=python`);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    const status = resp.status();
    console.log(`  Run ${i + 1}: ${Math.round(elapsed)}ms (status: ${status})`);
  }
  await page.close();
  results.searchPythonAPI = stats(times);
  results.searchPythonAPI.target = 3000;
  results.searchPythonAPI.pass = results.searchPythonAPI.avg < 3000;
  console.log(`  Min: ${results.searchPythonAPI.min}ms | Avg: ${results.searchPythonAPI.avg}ms | Max: ${results.searchPythonAPI.max}ms | Target: <3s | ${results.searchPythonAPI.pass ? 'PASS' : 'FAIL'}`);
}

async function bench4_searchTSSF(browser) {
  console.log('\n=== Benchmark 4: Search "TypeScript San Francisco" API (5 runs) ===');
  const times = [];
  const page = await browser.newPage();
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const resp = await page.request.get(`${BASE}/api/search?q=TypeScript+San+Francisco`);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    const status = resp.status();
    console.log(`  Run ${i + 1}: ${Math.round(elapsed)}ms (status: ${status})`);
  }
  await page.close();
  results.searchTSSF = stats(times);
  console.log(`  Min: ${results.searchTSSF.min}ms | Avg: ${results.searchTSSF.avg}ms | Max: ${results.searchTSSF.max}ms`);
}

async function bench5_profilePageLoad(browser) {
  console.log('\n=== Benchmark 5: Profile Page /profile/torvalds Load (3 runs) ===');
  const times = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage();
    const t = await timePageLoadFull(page, `${BASE}/profile/torvalds`);
    times.push(t);
    console.log(`  Run ${i + 1}: ${Math.round(t)}ms`);
    await page.close();
  }
  results.profilePageLoad = stats(times);
}

async function bench6_scoreAPI(browser) {
  console.log('\n=== Benchmark 6: Score API /api/score/torvalds (3 runs) ===');
  const times = [];
  const statuses = [];
  const page = await browser.newPage();
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const resp = await page.request.get(`${BASE}/api/score/torvalds`);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    statuses.push(resp.status());
    console.log(`  Run ${i + 1}: ${Math.round(elapsed)}ms (status: ${resp.status()})`);
  }
  await page.close();
  results.scoreAPI = stats(times);
  results.scoreAPI.statuses = statuses;
}

async function bench7_statsAPI(browser) {
  console.log('\n=== Benchmark 7: Stats API /api/stats (3 runs) ===');
  const times = [];
  const page = await browser.newPage();
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const resp = await page.request.get(`${BASE}/api/stats`);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    console.log(`  Run ${i + 1}: ${Math.round(elapsed)}ms (status: ${resp.status()})`);
  }
  await page.close();
  results.statsAPI = stats(times);
  results.statsAPI.target = 500;
  results.statsAPI.pass = results.statsAPI.avg < 500;
  console.log(`  Avg: ${results.statsAPI.avg}ms | Target: <500ms | ${results.statsAPI.pass ? 'PASS' : 'FAIL'}`);
}

async function bench8_concurrentSearches(browser) {
  console.log('\n=== Benchmark 8: 5 Concurrent Searches ===');
  const queries = ['python', 'rust', 'go', 'typescript', 'frontend'];
  const page = await browser.newPage();
  const start = performance.now();
  const promises = queries.map(async (q) => {
    const s = performance.now();
    const resp = await page.request.get(`${BASE}/api/search?q=${q}`);
    const elapsed = performance.now() - s;
    return { query: q, status: resp.status(), time: Math.round(elapsed) };
  });
  const all = await Promise.all(promises);
  const totalTime = performance.now() - start;
  await page.close();

  const allSucceeded = all.every(r => r.status === 200);
  results.concurrentSearches = {
    results: all,
    totalTime: Math.round(totalTime),
    allSucceeded,
  };
  all.forEach(r => console.log(`  ${r.query}: ${r.time}ms (${r.status})`));
  console.log(`  Total wall time: ${Math.round(totalTime)}ms | All succeeded: ${allSucceeded}`);
}

async function bench9_sequentialSearches(browser) {
  console.log('\n=== Benchmark 9: 10 Sequential Searches ===');
  const queries = ['python', 'rust', 'go', 'typescript', 'frontend', 'react', 'node', 'django', 'kubernetes', 'machine learning'];
  const page = await browser.newPage();
  const searchResults = [];
  let failures = 0;

  const heapBefore = await getJSHeapSize(page);

  for (let i = 0; i < queries.length; i++) {
    const start = performance.now();
    const resp = await page.request.get(`${BASE}/api/search?q=${encodeURIComponent(queries[i])}`);
    const elapsed = performance.now() - start;
    const status = resp.status();
    if (status !== 200) failures++;
    searchResults.push({ query: queries[i], time: Math.round(elapsed), status });
    console.log(`  ${i + 1}. "${queries[i]}": ${Math.round(elapsed)}ms (${status})`);
  }

  const heapAfter = await getJSHeapSize(page);
  await page.close();

  results.sequentialSearches = {
    results: searchResults,
    failures,
    heapBefore,
    heapAfter,
    memoryGrowth: heapBefore && heapAfter
      ? Math.round((heapAfter.usedJSHeapSize - heapBefore.usedJSHeapSize) / 1024)
      : 'N/A (memory API not available)',
  };
  console.log(`  Failures: ${failures} | Memory growth: ${results.sequentialSearches.memoryGrowth}KB`);
}

async function bench10_caching(browser) {
  console.log('\n=== Benchmark 10: Caching — Same Query Twice ===');
  const page = await browser.newPage();

  const start1 = performance.now();
  await page.request.get(`${BASE}/api/search?q=caching-test-python`);
  const first = performance.now() - start1;

  const start2 = performance.now();
  await page.request.get(`${BASE}/api/search?q=caching-test-python`);
  const second = performance.now() - start2;

  await page.close();

  const isFaster = second < first;
  const speedup = first > 0 ? Math.round((1 - second / first) * 100) : 0;
  results.caching = {
    firstRun: Math.round(first),
    secondRun: Math.round(second),
    isFaster,
    speedupPercent: speedup,
  };
  console.log(`  First: ${Math.round(first)}ms | Second: ${Math.round(second)}ms | Faster: ${isFaster} (${speedup}% speedup)`);
}

async function bench11_domNodeCount(browser) {
  console.log('\n=== Benchmark 11: DOM Node Count Growth ===');
  const page = await browser.newPage();

  // After page load
  await page.goto(`${BASE}/search`, { waitUntil: 'load' });
  const afterLoad = await getDOMNodeCount(page);
  console.log(`  After page load: ${afterLoad} nodes`);

  // After one search
  await page.fill('input[type="text"], input[type="search"], input[name="q"], input[placeholder*="earch"]', 'python');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const afterSearch1 = await getDOMNodeCount(page);
  console.log(`  After 1 search: ${afterSearch1} nodes`);

  // After 5 searches
  const queries = ['rust', 'go', 'typescript', 'react'];
  for (const q of queries) {
    try {
      const input = page.locator('input[type="text"], input[type="search"], input[name="q"], input[placeholder*="earch"]').first();
      await input.fill(q);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log(`  Warning: search for "${q}" failed: ${e.message}`);
    }
  }
  const after5Searches = await getDOMNodeCount(page);
  console.log(`  After 5 searches: ${after5Searches} nodes`);

  await page.close();

  const growth = after5Searches - afterLoad;
  const growthPercent = Math.round((growth / afterLoad) * 100);
  results.domNodeCount = {
    afterLoad,
    afterSearch1,
    after5Searches,
    growth,
    growthPercent,
    unbounded: growthPercent > 100, // flag if nodes doubled
  };
  console.log(`  Growth: ${growth} nodes (${growthPercent}%) | Unbounded: ${results.domNodeCount.unbounded}`);
}

async function bench12_bundleSize(browser) {
  console.log('\n=== Benchmark 12: JS Bundle Size ===');
  const page = await browser.newPage();

  const jsResources = [];
  page.on('response', async (response) => {
    const url = response.url();
    const headers = response.headers();
    if (url.includes('.js') || (headers['content-type'] && headers['content-type'].includes('javascript'))) {
      const size = headers['content-length'] ? parseInt(headers['content-length']) : null;
      jsResources.push({ url: url.replace(BASE, ''), size, contentEncoding: headers['content-encoding'] || 'none' });
    }
  });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Also get transfer sizes from performance API
  const perfEntries = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(e => e.initiatorType === 'script' || e.name.includes('.js'))
      .map(e => ({
        name: e.name.replace(window.location.origin, ''),
        transferSize: e.transferSize,
        decodedBodySize: e.decodedBodySize,
        encodedBodySize: e.encodedBodySize,
        duration: Math.round(e.duration),
      }));
  });

  await page.close();

  const totalTransfer = perfEntries.reduce((s, e) => s + (e.transferSize || 0), 0);
  const totalDecoded = perfEntries.reduce((s, e) => s + (e.decodedBodySize || 0), 0);

  results.bundleSize = {
    resources: perfEntries,
    totalTransferKB: Math.round(totalTransfer / 1024),
    totalDecodedKB: Math.round(totalDecoded / 1024),
    count: perfEntries.length,
  };
  console.log(`  JS resources: ${perfEntries.length}`);
  console.log(`  Total transfer: ${results.bundleSize.totalTransferKB}KB`);
  console.log(`  Total decoded: ${results.bundleSize.totalDecodedKB}KB`);
  perfEntries.sort((a, b) => (b.decodedBodySize || 0) - (a.decodedBodySize || 0));
  perfEntries.slice(0, 5).forEach(e => {
    console.log(`    ${e.name}: ${Math.round((e.decodedBodySize || 0) / 1024)}KB decoded, ${Math.round(e.duration)}ms`);
  });
}

async function bench13_renderBlocking(browser) {
  console.log('\n=== Benchmark 13: Render-Blocking Resources ===');
  const page = await browser.newPage();

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const blocking = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries
      .filter(e => e.renderBlockingStatus === 'blocking')
      .map(e => ({
        name: e.name.replace(window.location.origin, ''),
        type: e.initiatorType,
        duration: Math.round(e.duration),
        transferSize: e.transferSize,
      }));
  });

  await page.close();

  results.renderBlocking = {
    count: blocking.length,
    resources: blocking,
  };
  console.log(`  Render-blocking resources: ${blocking.length}`);
  blocking.forEach(r => console.log(`    ${r.name} (${r.type}): ${r.duration}ms`));
}

async function bench15_memoryLeaks(browser) {
  console.log('\n=== Benchmark 15: Memory Leak Check (10 navigation cycles) ===');
  const context = await browser.newContext();
  const page = await context.newPage();

  const snapshots = [];

  for (let i = 0; i < 10; i++) {
    await page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/profile/torvalds`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const heap = await getJSHeapSize(page);
    const domCount = await getDOMNodeCount(page);
    snapshots.push({
      cycle: i + 1,
      heap: heap ? Math.round(heap.usedJSHeapSize / 1024) : null,
      domNodes: domCount,
    });
    console.log(`  Cycle ${i + 1}: heap=${heap ? Math.round(heap.usedJSHeapSize / 1024) + 'KB' : 'N/A'}, DOM=${domCount}`);
  }

  await page.close();
  await context.close();

  const firstDom = snapshots[0].domNodes;
  const lastDom = snapshots[snapshots.length - 1].domNodes;
  const domGrowth = lastDom - firstDom;
  const firstHeap = snapshots[0].heap;
  const lastHeap = snapshots[snapshots.length - 1].heap;
  const heapGrowth = firstHeap && lastHeap ? lastHeap - firstHeap : null;

  results.memoryLeaks = {
    snapshots,
    domGrowth,
    heapGrowthKB: heapGrowth,
    leakSuspected: domGrowth > 500 || (heapGrowth && heapGrowth > 10000),
  };
  console.log(`  DOM growth: ${domGrowth} nodes | Heap growth: ${heapGrowth ? heapGrowth + 'KB' : 'N/A'}`);
  console.log(`  Leak suspected: ${results.memoryLeaks.leakSuspected}`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('Scout Performance Benchmark Suite');
  console.log('====================================');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE}`);

  const browser = await chromium.launch({
    args: ['--enable-precise-memory-info'],
  });

  try {
    await bench1_homepageLoad(browser);
    await bench2_searchPageLoad(browser);
    await bench3_searchPythonAPI(browser);
    await bench4_searchTSSF(browser);
    await bench5_profilePageLoad(browser);
    await bench6_scoreAPI(browser);
    await bench7_statsAPI(browser);
    await bench8_concurrentSearches(browser);
    await bench9_sequentialSearches(browser);
    await bench10_caching(browser);
    await bench11_domNodeCount(browser);
    await bench12_bundleSize(browser);
    await bench13_renderBlocking(browser);
    // Bench 14 (Lighthouse) runs separately via CLI
    await bench15_memoryLeaks(browser);
  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    await browser.close();
  }

  // Write raw results
  const fs = await import('fs');
  fs.writeFileSync(
    'qa-reports/search-deep-dive/perf-raw-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults written to qa-reports/search-deep-dive/perf-raw-results.json');
  console.log(`Finished: ${new Date().toISOString()}`);
}

main().catch(console.error);
