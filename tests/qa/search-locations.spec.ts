// QA: Location-based search quality — does "in San Francisco" return SF devs?

import { test, expect } from "@playwright/test";
import { gradeResults, printGradeReport, type QualityGrade } from "./helpers";

const BASE = process.env.QA_BASE_URL || "https://gitscout-beta.vercel.app";

const LOCATION_SEARCHES = [
  { query: "react developers in san francisco", expectedLang: "JavaScript", expectedLoc: "San Francisco" },
  { query: "python engineers in new york", expectedLang: "Python", expectedLoc: "New York" },
  { query: "go developers in seattle", expectedLang: "Go", expectedLoc: "Seattle" },
  { query: "typescript in austin", expectedLang: "TypeScript", expectedLoc: "Austin" },
  { query: "rust developers in berlin", expectedLang: "Rust", expectedLoc: "Berlin" },
  { query: "frontend engineer in london", expectedLang: "JavaScript", expectedLoc: "London" },
];

const grades: QualityGrade[] = [];

for (const { query, expectedLang, expectedLoc } of LOCATION_SEARCHES) {
  test(`Location search: "${query}"`, async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE}/api/search?q=${encodeURIComponent(query)}`);
    const loadTime = Date.now() - start;

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    const grade = gradeResults(query, data, loadTime, expectedLang, expectedLoc);
    grades.push(grade);

    expect(data.developers.length).toBeGreaterThan(0);
  });
}

test.afterAll(() => {
  if (grades.length > 0) printGradeReport(grades);
});
