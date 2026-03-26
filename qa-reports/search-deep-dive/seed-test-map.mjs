/**
 * Seeds test data for market map QA via pg driver to DIRECT_DATABASE_URL (Supabase).
 * Outputs JSON: { userId, mapId }
 * Usage: node seed-test-map.mjs [seed|cleanup <userId>]
 */

import pg from "pg";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DIRECT_DATABASE_URL;
if (!DB_URL) { console.error("DIRECT_DATABASE_URL not set"); process.exit(1); }

async function getClient() {
  const c = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

export async function seedTestMap() {
  const c = await getClient();
  const userId = crypto.randomUUID();
  const mapId = crypto.randomUUID();

  // Create user
  const ur = await c.query(
    `INSERT INTO "User" (id, name, email, "emailVerified", image)
     VALUES ($1, 'QA Tester', 'qa-map-tester@gitscout.test', NOW(), 'https://github.com/ghost.png')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [userId]
  );
  const uid = ur.rows[0].id;

  // Create market map
  await c.query(
    `INSERT INTO "MarketMap" (id, "userId", name, "roleTitle", "roleLevel", "roleStack", geography, status, "createdAt", "updatedAt")
     VALUES ($1, $2, 'Sr. Platform Engineer — San Francisco', 'Sr. Platform Engineer', 'senior',
       '{Go,Kubernetes,AWS}', '{San Francisco}', 'ready', NOW(), NOW())`,
    [mapId, uid]
  );

  // Companies
  const companies = [
    { name: "Datadog", domain: "datadoghq.com", tier: "A", hq: "New York", eng: 2100, growth: "+22%", flight: "medium", news: "Recent Series H at $35B valuation" },
    { name: "HashiCorp", domain: "hashicorp.com", tier: "A", hq: "San Francisco", eng: 850, growth: "+15%", flight: "high", news: "IBM acquisition pending, engineering leadership changes" },
    { name: "Cloudflare", domain: "cloudflare.com", tier: "B", hq: "San Francisco", eng: 1200, growth: "+28%", flight: "low", news: null },
    { name: "Grafana Labs", domain: "grafana.com", tier: "B", hq: "New York", eng: 600, growth: "+32%", flight: "low", news: null },
    { name: "Google Cloud", domain: "cloud.google.com", tier: "C", hq: "Mountain View", eng: 8000, growth: "+5%", flight: "medium", news: "Restructuring cloud division" },
    { name: "Stripe", domain: "stripe.com", tier: "C", hq: "San Francisco", eng: 2500, growth: "+10%", flight: "low", news: null },
  ];

  const companyIds = [];
  for (const co of companies) {
    const coId = crypto.randomUUID();
    companyIds.push({ id: coId, ...co });
    await c.query(
      `INSERT INTO "MapCompany" (id, "mapId", "companyName", "companyDomain", tier, "hqCity", "engHeadcount", "growthRate",
        "flightRiskCompany", "newsSummary", "enrichmentStatus", hidden, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'complete', false, NOW())`,
      [coId, mapId, co.name, co.domain, co.tier, co.hq, co.eng, co.growth, co.flight, co.news]
    );
  }

  // Candidates
  const candidateGroups = [
    { company: "Datadog", candidates: [
      { name: "Alex Chen", first: "Alex", last: "Chen", title: "Senior Platform Engineer", seniority: "senior", city: "New York", fit: 92, fitR: "Strong Go and Kubernetes background, 6 years in platform engineering at scale", fr: "medium", frS: "{company_reorg,leadership_change}", frR: "Recent leadership transition may create uncertainty", status: "mapped", linkedin: "https://linkedin.com/in/alex-chen-platform", email: null },
      { name: "Sarah Kim", first: "Sarah", last: "Kim", title: "Staff Infrastructure Engineer", seniority: "staff", city: "San Francisco", fit: 88, fitR: "Deep Kubernetes expertise, led migration of core services to K8s", fr: "low", frS: "{}", frR: null, status: "mapped", linkedin: "https://linkedin.com/in/sarah-kim-infra", email: null },
      { name: "Marcus Johnson", first: "Marcus", last: "Johnson", title: "Platform Team Lead", seniority: "senior", city: "Remote", fit: 85, fitR: "Strong leadership skills with Go microservices experience", fr: "high", frS: "{short_tenure,company_layoffs}", frR: "Only 8 months in current role, company announced layoffs in Q1", status: "shortlisted", linkedin: "https://linkedin.com/in/marcus-johnson-dev", email: null },
    ]},
    { company: "HashiCorp", candidates: [
      { name: "Emily Zhang", first: "Emily", last: "Zhang", title: "Senior Software Engineer, Cloud", seniority: "senior", city: "San Francisco", fit: 90, fitR: "Core contributor to Terraform, deep Go expertise", fr: "high", frS: "{company_reorg,leadership_change,company_layoffs}", frR: "IBM acquisition creates significant uncertainty; team restructuring in progress", status: "mapped", linkedin: "https://linkedin.com/in/emily-zhang-cloud", email: null },
      { name: "Jordan Rivera", first: "Jordan", last: "Rivera", title: "Platform Engineer", seniority: "mid", city: "Portland", fit: 78, fitR: "Good Kubernetes skills but limited at-scale experience", fr: "medium", frS: "{rapid_growth_hire}", frR: "Hired during 2022 growth phase, team has contracted since", status: "mapped", linkedin: null, email: null },
    ]},
    { company: "Cloudflare", candidates: [
      { name: "David Park", first: "David", last: "Park", title: "Systems Engineer", seniority: "senior", city: "San Francisco", fit: 84, fitR: "Strong systems programming background, Rust/Go, familiar with distributed systems", fr: "low", frS: "{}", frR: null, status: "contacted", linkedin: "https://linkedin.com/in/david-park-sys", email: null },
      { name: "Priya Patel", first: "Priya", last: "Patel", title: "Senior Infrastructure Engineer", seniority: "senior", city: "Austin", fit: 86, fitR: "Kubernetes-native infrastructure, AWS/GCP multi-cloud experience", fr: "low", frS: "{}", frR: null, status: "mapped", linkedin: "https://linkedin.com/in/priya-patel-infra", email: null },
    ]},
    { company: "Grafana Labs", candidates: [
      { name: "Tom Müller", first: "Tom", last: "Müller", title: "Platform Engineer", seniority: "senior", city: "Berlin", fit: 82, fitR: "Observability stack expert, Go + Kubernetes, remote-first background", fr: "low", frS: "{}", frR: null, status: "mapped", linkedin: "https://linkedin.com/in/tom-mueller-grafana", email: "tom.mueller@grafana.com" },
    ]},
    { company: "Google Cloud", candidates: [
      { name: "Lisa Wang", first: "Lisa", last: "Wang", title: "Staff Software Engineer", seniority: "staff", city: "Mountain View", fit: 94, fitR: "Built GKE autoscaling at Google scale, deep Kubernetes internals expertise", fr: "medium", frS: "{company_reorg}", frR: "Cloud division restructuring may impact team composition", status: "mapped", linkedin: "https://linkedin.com/in/lisa-wang-gke", email: null },
      { name: "Chris Taylor", first: "Chris", last: "Taylor", title: "Senior Site Reliability Engineer", seniority: "senior", city: "Seattle", fit: 80, fitR: "Strong SRE practices, Go + Kubernetes, but less platform engineering focus", fr: "low", frS: "{}", frR: null, status: "screening", linkedin: "https://linkedin.com/in/chris-taylor-sre", email: null },
    ]},
    { company: "Stripe", candidates: [
      { name: "Anna Lee", first: "Anna", last: "Lee", title: "Infrastructure Engineer", seniority: "senior", city: "San Francisco", fit: 87, fitR: "Payments infrastructure at scale, Ruby-to-Go migration experience", fr: "low", frS: "{}", frR: null, status: "mapped", linkedin: "https://linkedin.com/in/anna-lee-stripe", email: null },
      { name: "James Rodriguez", first: "James", last: "Rodriguez", title: "Senior Platform Engineer", seniority: "senior", city: "New York", fit: 91, fitR: "Platform team at Stripe, internal developer tooling with Go/K8s", fr: "low", frS: "{}", frR: null, status: "mapped", linkedin: "https://linkedin.com/in/james-rodriguez-platform", email: null },
    ]},
  ];

  for (const group of candidateGroups) {
    const co = companyIds.find(x => x.name === group.company);
    if (!co) continue;
    for (const ca of group.candidates) {
      const candId = crypto.randomUUID();
      await c.query(
        `INSERT INTO "MapCandidate" (id, "mapId", "companyId", name, "firstName", "lastName", title, seniority,
          city, country, "linkedinUrl", "fitScore", "fitReasoning", "flightRisk",
          "flightRiskSignals", "flightRiskReasoning", status, email, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'US', $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
        [candId, mapId, co.id, ca.name, ca.first, ca.last, ca.title, ca.seniority,
         ca.city, ca.linkedin, ca.fit, ca.fitR, ca.fr, ca.frS, ca.frR, ca.status, ca.email]
      );
    }
  }

  await c.end();
  return { userId: uid, mapId };
}

export async function cleanupTestData(userId) {
  const c = await getClient();
  try {
    const maps = await c.query(`SELECT id FROM "MarketMap" WHERE "userId" = $1`, [userId]);
    const mapIds = maps.rows.map(m => m.id);
    if (mapIds.length > 0) {
      await c.query(`DELETE FROM "MapCandidate" WHERE "mapId" = ANY($1)`, [mapIds]);
      await c.query(`DELETE FROM "MapCompany" WHERE "mapId" = ANY($1)`, [mapIds]);
      await c.query(`DELETE FROM "MarketMap" WHERE "userId" = $1`, [userId]);
    }
    await c.query(`DELETE FROM "MapTemplate" WHERE "userId" = $1`, [userId]).catch(() => {});
    await c.query(`DELETE FROM "Session" WHERE "userId" = $1`, [userId]).catch(() => {});
    await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]).catch(() => {});
  } catch (e) {
    console.error("Cleanup:", e.message);
  }
  await c.end();
}

// CLI
const cmd = process.argv[2] || "seed";
if (cmd === "cleanup") {
  const uid = process.argv[3];
  if (!uid) { console.error("Usage: cleanup <userId>"); process.exit(1); }
  await cleanupTestData(uid);
  console.log("Cleaned up");
} else {
  const result = await seedTestMap();
  console.log(JSON.stringify(result));
}
