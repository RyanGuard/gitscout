// QA: Role-based search quality — does "frontend engineer" return actual frontend devs?

import { test, expect } from "@playwright/test";
import { gradeResults, printGradeReport, type QualityGrade } from "./helpers";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

const ROLE_SEARCHES = [
  { query: "frontend engineer", expectedLang: "JavaScript", expectedLoc: undefined },
  { query: "backend developer", expectedLang: "Python", expectedLoc: undefined },
  { query: "ml engineer", expectedLang: "Python", expectedLoc: undefined },
  { query: "rust systems developer", expectedLang: "Rust", expectedLoc: undefined },
  { query: "devops engineer", expectedLang: "Go", expectedLoc: undefined },
  { query: "mobile developer", expectedLang: "Swift", expectedLoc: undefined },
];

const grades: QualityGrade[] = [];

for (const { query, expectedLang } of ROLE_SEARCHES) {
  test(`Role search: "${query}"`, async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE}/api/search?q=${encodeURIComponent(query)}`);
    const loadTime = Date.now() - start;

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    const grade = gradeResults(query, data, loadTime, expectedLang);
    grades.push(grade);

    // Assertions
    expect(data.developers.length).toBeGreaterThan(0);
    expect(grade.avgFollowers).toBeGreaterThan(20);
  });
}

test.afterAll(() => {
  if (grades.length > 0) printGradeReport(grades);
});
