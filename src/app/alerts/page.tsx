"use client";

export default function AlertsPage() {
  return (
    <div style={{ maxWidth: 1020, padding: "28px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1a", letterSpacing: "-0.03em" }}>
          Alerts
        </h1>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 4,
          background: "rgba(200,165,90,0.12)",
          color: "#C8A55A",
          letterSpacing: "0.05em",
        }}>
          COMING SOON
        </span>
      </div>
      <p style={{ fontSize: 14, color: "#999", lineHeight: 1.6, maxWidth: 480 }}>
        Company news, departure signals, and hiring surge alerts. Stay informed about your target companies.
      </p>
      <div style={{
        marginTop: 40,
        padding: "48px",
        borderRadius: 12,
        border: "1px dashed rgba(200,165,90,0.25)",
        background: "rgba(200,165,90,0.03)",
        textAlign: "center" as const,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(200,165,90,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#666", marginBottom: 4 }}>
          Under development
        </p>
        <p style={{ fontSize: 12, color: "#999" }}>
          This feature is being built. Check back soon.
        </p>
      </div>
    </div>
  );
}
