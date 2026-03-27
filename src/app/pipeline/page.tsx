"use client";

export default function PipelinePage() {
  return (
    <div style={{ maxWidth: 1020, padding: "28px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1a", letterSpacing: "-0.03em" }}>
          Pipeline
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
        Track candidates across all your searches. From first contact to offer, see every stage at a glance.
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
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
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
