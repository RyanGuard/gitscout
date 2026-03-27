import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// GitScout brand
const COLORS = {
  brand: "#0F6E56",
  brandLight: "#e6f4f0",
  dark: "#1a1a2e",
  text: "#333333",
  textLight: "#666666",
  textMuted: "#999999",
  border: "#e5e5e5",
  bgLight: "#f9fafb",
  tierA: "#059669",
  tierB: "#6366f1",
  tierC: "#3b82f6",
  fitHigh: "#059669",
  fitMid: "#d97706",
  fitLow: "#999999",
  flightHigh: "#dc2626",
  flightMedium: "#d97706",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text,
  },
  // Cover
  coverPage: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Helvetica",
  },
  coverLogo: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: COLORS.brand,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 40,
  },
  coverTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    textAlign: "center",
    marginBottom: 12,
  },
  coverMeta: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 4,
  },
  coverDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 20,
  },
  // Summary
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },
  // Tier
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 16,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tierLabel: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },
  tierSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  // Company
  companyRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
    backgroundColor: "#ffffff",
  },
  companyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },
  companyDomain: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  companyMeta: {
    fontSize: 9,
    color: COLORS.textLight,
    marginTop: 2,
  },
  companyStat: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
  },
  companyStatValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },
  companyStatLabel: {
    fontSize: 7,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Candidates
  candidateRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  candidateName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    width: "30%",
  },
  candidateTitle: {
    fontSize: 9,
    color: COLORS.textLight,
    width: "30%",
  },
  candidateLocation: {
    fontSize: 9,
    color: COLORS.textMuted,
    width: "20%",
  },
  candidateScore: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    width: "10%",
    textAlign: "center",
  },
  candidateRisk: {
    fontSize: 8,
    width: "10%",
    textAlign: "center",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    marginBottom: 16,
  },
  methodology: {
    fontSize: 9,
    color: COLORS.textLight,
    lineHeight: 1.6,
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapCompanyData = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CandidateData = Record<string, any>;

interface MapPdfProps {
  variant: "overview" | "full";
  mapName: string;
  roleTitle: string;
  roleLevel: string | null;
  roleStack: string[];
  geography: string[];
  recruiterName: string;
  tiers: Record<string, MapCompanyData[]>;
  stats: {
    totalCompanies: number;
    totalCandidates: number;
    avgFitScore: number;
    statusCounts: Record<string, number>;
  };
}

const TIER_META: Record<string, { label: string; sub: string; color: string }> =
  {
    A: { label: "Tier A", sub: "Direct competitors", color: COLORS.tierA },
    B: { label: "Tier B", sub: "Adjacent space", color: COLORS.tierB },
    C: { label: "Tier C", sub: "Upmarket talent", color: COLORS.tierC },
  };

function fitColor(score: number) {
  if (score >= 80) return COLORS.fitHigh;
  if (score >= 60) return COLORS.fitMid;
  return COLORS.fitLow;
}

function Footer({ pageLabel }: { pageLabel?: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>GitScout Market Map</Text>
      <Text>{pageLabel || ""}</Text>
      <Text>Confidential</Text>
    </View>
  );
}

export function MapPdfDocument(props: MapPdfProps) {
  const {
    variant,
    mapName,
    roleTitle,
    roleLevel,
    roleStack,
    geography,
    recruiterName,
    tiers,
    stats,
  } = props;

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverLogo}>GitScout</Text>
        <Text style={styles.coverSubtitle}>
          Talent Intelligence Platform
        </Text>
        <Text style={styles.coverTitle}>{mapName}</Text>
        <Text style={styles.coverMeta}>{roleTitle}{roleLevel ? ` · ${roleLevel}` : ""}</Text>
        {roleStack.length > 0 && (
          <Text style={styles.coverMeta}>{roleStack.join(", ")}</Text>
        )}
        {geography.length > 0 && (
          <Text style={styles.coverMeta}>{geography.join(", ")}</Text>
        )}
        <Text style={styles.coverDate}>
          Prepared by {recruiterName} · {date}
        </Text>
        <Footer />
      </Page>

      {/* Page 2: Executive Summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Companies Mapped</Text>
            <Text style={styles.summaryValue}>{stats.totalCompanies}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Candidates Identified</Text>
            <Text style={styles.summaryValue}>{stats.totalCandidates}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Avg Fit Score</Text>
            <Text style={styles.summaryValue}>{stats.avgFitScore}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>In Pipeline</Text>
            <Text style={styles.summaryValue}>
              {Object.entries(stats.statusCounts)
                .filter(([k]) => k !== "mapped" && k !== "rejected")
                .reduce((s, [, v]) => s + v, 0)}
            </Text>
          </View>
        </View>

        {/* Tier breakdown summary */}
        {(["A", "B", "C"] as const).map((tier) => {
          const companies = tiers[tier] || [];
          if (companies.length === 0) return null;
          const meta = TIER_META[tier];
          const candidateCount = companies.reduce(
            (s: number, c: MapCompanyData) =>
              s + (c.candidates?.length || c.candidateCount || 0),
            0
          );
          return (
            <View
              key={tier}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
                padding: 8,
                backgroundColor: COLORS.bgLight,
                borderRadius: 4,
              }}
            >
              <View
                style={[
                  styles.tierDot,
                  { backgroundColor: meta.color },
                ]}
              />
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: COLORS.dark }}>
                {meta.label}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 8 }}>
                {companies.length} companies · {candidateCount} candidates
              </Text>
            </View>
          );
        })}

        <Footer />
      </Page>

      {/* Tier detail pages */}
      {(["A", "B", "C"] as const).map((tier) => {
        const companies = tiers[tier] || [];
        if (companies.length === 0) return null;
        const meta = TIER_META[tier];

        return (
          <Page key={tier} size="A4" style={styles.page} wrap>
            <View style={styles.tierHeader}>
              <View
                style={[styles.tierDot, { backgroundColor: meta.color }]}
              />
              <Text style={styles.tierLabel}>{meta.label}</Text>
              <Text style={styles.tierSub}>
                {meta.sub} · {companies.length} companies
              </Text>
            </View>

            {companies.map((co: MapCompanyData) => {
              const candidateCount =
                co.candidates?.length || co.candidateCount || 0;
              const avgFit = co.avgFitScore || (co.candidates?.length > 0
                ? Math.round(
                    co.candidates.reduce(
                      (s: number, c: CandidateData) => s + (c.fitScore || 0),
                      0
                    ) / co.candidates.length
                  )
                : 0);

              return (
                <View key={co.id} wrap={false} style={{ marginBottom: 8 }}>
                  <View style={styles.companyRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles.companyName}>{co.companyName}</Text>
                        <Text style={styles.companyDomain}>{co.companyDomain}</Text>
                      </View>
                      <Text style={styles.companyMeta}>
                        {[
                          co.headcount && `${co.headcount} employees`,
                          co.hqCity,
                          co.fundingStage,
                          co.growthRate && `${co.growthRate} growth`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <View style={styles.companyStat}>
                      <Text style={styles.companyStatValue}>
                        {candidateCount}
                      </Text>
                      <Text style={styles.companyStatLabel}>candidates</Text>
                    </View>
                    {avgFit > 0 && (
                      <View style={styles.companyStat}>
                        <Text
                          style={[
                            styles.companyStatValue,
                            { color: fitColor(avgFit) },
                          ]}
                        >
                          {avgFit}
                        </Text>
                        <Text style={styles.companyStatLabel}>avg fit</Text>
                      </View>
                    )}
                  </View>

                  {/* Full variant: show candidates */}
                  {variant === "full" &&
                    co.candidates &&
                    co.candidates.length > 0 && (
                      <View style={{ marginLeft: 10, marginRight: 10 }}>
                        {/* Header row */}
                        <View
                          style={[
                            styles.candidateRow,
                            { backgroundColor: COLORS.bgLight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.candidateName,
                              { color: COLORS.textMuted, fontFamily: "Helvetica" },
                            ]}
                          >
                            Name
                          </Text>
                          <Text
                            style={[
                              styles.candidateTitle,
                              { color: COLORS.textMuted },
                            ]}
                          >
                            Title
                          </Text>
                          <Text
                            style={[
                              styles.candidateLocation,
                              { color: COLORS.textMuted },
                            ]}
                          >
                            Location
                          </Text>
                          <Text
                            style={[
                              styles.candidateScore,
                              { color: COLORS.textMuted, fontFamily: "Helvetica" },
                            ]}
                          >
                            Fit
                          </Text>
                          <Text
                            style={[
                              styles.candidateRisk,
                              { color: COLORS.textMuted },
                            ]}
                          >
                            Signal
                          </Text>
                        </View>
                        {co.candidates
                          .slice(0, 10)
                          .map((c: CandidateData) => (
                            <View key={c.id} style={styles.candidateRow}>
                              <Text style={styles.candidateName}>
                                {c.name}
                              </Text>
                              <Text style={styles.candidateTitle}>
                                {c.title || "—"}
                              </Text>
                              <Text style={styles.candidateLocation}>
                                {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                              </Text>
                              <Text
                                style={[
                                  styles.candidateScore,
                                  {
                                    color: c.fitScore
                                      ? fitColor(c.fitScore)
                                      : COLORS.textMuted,
                                  },
                                ]}
                              >
                                {c.fitScore || "—"}
                              </Text>
                              <Text
                                style={[
                                  styles.candidateRisk,
                                  {
                                    color:
                                      c.flightRisk === "high"
                                        ? COLORS.flightHigh
                                        : c.flightRisk === "medium"
                                          ? COLORS.flightMedium
                                          : COLORS.textMuted,
                                  },
                                ]}
                              >
                                {c.flightRisk === "high"
                                  ? "Open"
                                  : c.flightRisk === "medium"
                                    ? "Maybe"
                                    : "—"}
                              </Text>
                            </View>
                          ))}
                        {co.candidates.length > 10 && (
                          <Text
                            style={{
                              fontSize: 8,
                              color: COLORS.textMuted,
                              textAlign: "center",
                              marginTop: 4,
                            }}
                          >
                            + {co.candidates.length - 10} more candidates
                          </Text>
                        )}
                      </View>
                    )}
                </View>
              );
            })}

            <Footer pageLabel={meta.label} />
          </Page>
        );
      })}

      {/* Final page: Methodology */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Methodology</Text>
        <Text style={styles.methodology}>
          This market map was generated using GitScout&apos;s AI-powered talent
          intelligence platform. Companies were identified and classified by
          relevance to the role brief using a combination of industry analysis
          and AI classification.
        </Text>
        <Text style={[styles.methodology, { marginTop: 8 }]}>
          Candidate quality is scored using GitScout&apos;s evaluation engine,
          which considers role fit, seniority alignment, technical background,
          and location match. Scores range from 0 to 100, with higher scores
          indicating stronger fit for the target role.
        </Text>
        <Text style={[styles.methodology, { marginTop: 8 }]}>
          &quot;Likely open to opportunities&quot; signals are derived from
          multiple data points including tenure patterns, company news, team
          growth velocity, and market conditions. These are directional
          indicators, not certainties.
        </Text>
        <Footer />
      </Page>
    </Document>
  );
}
