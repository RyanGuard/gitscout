// QA: Overall search quality — do we find actual top developers?

import { test, expect } from "@playwright/test";
import { gradeResults, printGradeReport, type QualityGrade } from "./helpers";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

const QUALITY_SEARCHES = [
  { query: "karpathy", note: "Should find Andrej Karpathy" },
  { query: "sindresorhus", note: "Should find Sindre Sorhus" },
  { query: "typescript", note: "Should find top TS devs" },
  { query: "machine learning python", note: "Should find ML engineers" },
  { query: "kubernetes go", note: "Should find infra engineers" },
];

const grades: QualityGrade[] = [];

for (const { query, note } of QUALITY_SEARCHES) {
  test(`Quality: "${query}" — ${note}`, async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE}/api/search?q=${encodeURIComponent(query)}`);
    const loadTime = Date.now() - start;

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    const grade = gradeResults(query, data, loadTime);
    grades.push(grade);

    // Basic quality assertions
    expect(data.developers.length).toBeGreaterThan(0);

    // For named searches, verify the person appears
    if (query === "karpathy") {
      const found = data.developers.some(
        (d: { username: string }) => d.username.toLowerCase().includes("karpathy")
      );
      expect(found).toBeTruthy();
    }
    if (query === "sindresorhus") {
      const found = data.developers.some(
        (d: { username: string }) => d.username === "sindresorhus"
      );
      expect(found).toBeTruthy();
    }
  });
}

test.afterAll(() => {
  if (grades.length > 0) printGradeReport(grades);
});
