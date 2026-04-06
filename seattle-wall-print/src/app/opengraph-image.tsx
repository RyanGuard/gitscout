import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "linear-gradient(135deg, #121a24, #1e2a3a 60%, #0c1017)",
          color: "#eef2f6",
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: -1,
        }}
      >
        <div style={{ fontSize: 26, color: "#d4b458", textTransform: "uppercase", letterSpacing: 3 }}>
          Seattle · Bellevue · Eastside
        </div>
        <div style={{ marginTop: 16 }}>{site.name}</div>
        <div style={{ marginTop: 24, fontSize: 28, fontWeight: 400, maxWidth: 820, color: "#cbd5e1" }}>
          Large-format wall printing for workplaces, retail, and events.
        </div>
      </div>
    ),
    { ...size },
  );
}
