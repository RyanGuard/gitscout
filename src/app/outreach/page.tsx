"use client";

export default function OutreachPage() {
  return (
    <div style={{ maxWidth: 1020, padding: "28px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1a", letterSpacing: "-0.03em" }}>
          Outreach
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
        AI-personalized messaging for every candidate. Generate, review, and track outreach at scale.
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
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
