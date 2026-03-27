import { useState } from "react";

const SECTIONS = {
  source: {
    label: "Source",
    items: [
      { id: "search", label: "Developer search", icon: "search", badge: null },
      { id: "market-map", label: "Market map", icon: "map", badge: "NEW" },
    ],
  },
  connect: {
    label: "Connect",
    items: [
      { id: "connections", label: "Connection mapper", icon: "link", badge: "NEW" },
      { id: "outreach", label: "Outreach", icon: "send", badge: null },
    ],
  },
  manage: {
    label: "Manage",
    items: [
      { id: "pipeline", label: "Pipeline", icon: "funnel", badge: null },
      { id: "lists", label: "Saved lists", icon: "list", badge: null },
      { id: "templates", label: "Templates", icon: "copy", badge: null },
    ],
  },
  intelligence: {
    label: "Intelligence",
    items: [
      { id: "alerts", label: "Alerts", icon: "bell", badge: "SOON" },
      { id: "analytics", label: "Analytics", icon: "chart", badge: "SOON" },
    ],
  },
};

const ICONS = {
  search: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke={c} strokeWidth="1.2"/><path d="M10.5 10.5L14 14" stroke={c} strokeWidth="1.2" strokeLinecap="round"/></svg>,
  map: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 3.5l4.5-1.5 5 2 4.5-1.5v10l-4.5 1.5-5-2L1 13.5z" stroke={c} strokeWidth="1.1" strokeLinejoin="round"/><path d="M5.5 2v10M10.5 4v10" stroke={c} strokeWidth="1.1"/></svg>,
  link: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3 3 0 004 .5l2-2a3 3 0 00-4.24-4.24L7 5" stroke={c} strokeWidth="1.2" strokeLinecap="round"/><path d="M9.5 6.5a3 3 0 00-4-.5l-2 2a3 3 0 004.24 4.24L9 11" stroke={c} strokeWidth="1.2" strokeLinecap="round"/></svg>,
  send: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14.5 1.5l-6 13-2.5-5.5L.5 6.5z" stroke={c} strokeWidth="1.1" strokeLinejoin="round"/><path d="M14.5 1.5L6 9" stroke={c} strokeWidth="1.1"/></svg>,
  funnel: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1.5 2.5h13L9.5 8v4.5L6.5 14V8z" stroke={c} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
  list: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M5 3h9M5 8h9M5 13h7" stroke={c} strokeWidth="1.2" strokeLinecap="round"/><circle cx="2" cy="3" r="0.8" fill={c}/><circle cx="2" cy="8" r="0.8" fill={c}/><circle cx="2" cy="13" r="0.8" fill={c}/></svg>,
  copy: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke={c} strokeWidth="1.1"/><path d="M3 11V3a1.5 1.5 0 011.5-1.5H11" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>,
  bell: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 6.5a4 4 0 018 0c0 2 1 3.5 1.5 4.5H2.5C3 10 4 8.5 4 6.5z" stroke={c} strokeWidth="1.1"/><path d="M6.5 12a1.5 1.5 0 003 0" stroke={c} strokeWidth="1.1"/></svg>,
  chart: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 14V8M6 14V5M10 14V8M14 14V2" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  dashboard: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke={c} strokeWidth="1.1"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke={c} strokeWidth="1.1"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke={c} strokeWidth="1.1"/><rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke={c} strokeWidth="1.1"/></svg>,
  settings: (c) => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke={c} strokeWidth="1.1"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" stroke={c} strokeWidth="1.1" strokeLinecap="round"/></svg>,
};

const MOCK_STATS = { activeMaps: 4, candidatesTracked: 187, warmConnections: 23, responseRate: "34%" };

const MOCK_RECENT = [
  { name: "Sr. Platform Engineer — GPU Cloud", companies: 9, candidates: 23, connections: 6, updated: "2h ago", status: "ready" },
  { name: "Staff Backend — Fintech", companies: 12, candidates: 31, connections: 4, updated: "1d ago", status: "ready" },
  { name: "Engineering Manager — AI Infra", companies: 7, candidates: 18, connections: 2, updated: "3d ago", status: "stale" },
];

const MOCK_ALERTS = [
  { company: "CoreWeave", text: "VP Engineering departed — 3 engineers now high flight risk", time: "4h ago", severity: "urgent" },
  { company: "Lambda", text: "Series C announced ($150M) — hiring surge expected", time: "1d ago", severity: "info" },
  { company: "Anyscale", text: "15% workforce reduction reported", time: "2d ago", severity: "urgent" },
];

function NavItem({ item, active, onClick }) {
  const c = active ? "#E8E6DF" : "rgba(232,230,223,0.35)";
  const Icon = ICONS[item.icon];
  return (
    <div onClick={() => onClick(item.id)} style={{ padding: "7px 14px 7px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, background: active ? "rgba(232,230,223,0.06)" : "transparent", borderLeft: active ? "2px solid #C8A55A" : "2px solid transparent", transition: "all 0.1s" }}>
      {Icon && Icon(c)}
      <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? "#E8E6DF" : "rgba(232,230,223,0.5)", letterSpacing: "-0.01em" }}>{item.label}</span>
      {item.badge && (
        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, marginLeft: "auto", background: item.badge === "NEW" ? "rgba(200,165,90,0.12)" : "rgba(232,230,223,0.06)", color: item.badge === "NEW" ? "#C8A55A" : "rgba(232,230,223,0.25)", letterSpacing: "0.05em" }}>{item.badge}</span>
      )}
    </div>
  );
}

function SidebarSection({ section, activeItem, onSelect }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ padding: "0 16px", marginBottom: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(232,230,223,0.2)" }}>{section.label}</span>
      </div>
      {section.items.map((item) => (
        <NavItem key={item.id} item={item} active={activeItem === item.id} onClick={onSelect} />
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: "var(--color-background-primary,#fff)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary,#e5e4e0)", padding: "16px 20px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-tertiary,#999)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || "var(--color-text-primary,#1c1c1a)", letterSpacing: "-0.03em" }}>{value}</div>
    </div>
  );
}

function MapCard({ map }) {
  const isStale = map.status === "stale";
  return (
    <div style={{ background: "var(--color-background-primary,#fff)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary,#e5e4e0)", padding: "16px 20px", cursor: "pointer", transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary,#1c1c1a)" }}>{map.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isStale && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(186,117,23,0.08)", color: "#8B6914", fontWeight: 500 }}>Stale</span>}
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary,#999)" }}>{map.updated}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-secondary,#666)" }}>{map.companies} companies</span>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-secondary,#666)" }}>{map.candidates} candidates</span>
        {map.connections > 0 && (
          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "rgba(200,165,90,0.08)", color: "#8B6914" }}>{map.connections} warm paths</span>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  const isUrgent = alert.severity === "urgent";
  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: isUrgent ? "rgba(194,65,60,0.04)" : "var(--color-background-secondary,#f7f7f5)", border: `0.5px solid ${isUrgent ? "rgba(194,65,60,0.12)" : "var(--color-border-tertiary,#e5e4e0)"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {isUrgent && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C2413C" }} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary,#1c1c1a)" }}>{alert.company}</span>
        <span style={{ fontSize: 10, color: "var(--color-text-tertiary,#bbb)", marginLeft: "auto" }}>{alert.time}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary,#666)", lineHeight: 1.5 }}>{alert.text}</div>
    </div>
  );
}

function QuickAction({ label, desc, onClick }) {
  return (
    <div onClick={onClick} style={{ flex: 1, minWidth: 180, padding: "18px 22px", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary,#e5e4e0)", background: "var(--color-background-primary,#fff)", cursor: "pointer", transition: "border-color 0.15s, transform 0.1s" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary,#1c1c1a)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-tertiary,#999)", lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

export default function ScoutPlatform() {
  const [activeItem, setActiveItem] = useState("dashboard");

  return (
    <div style={{ fontFamily: "'Instrument Sans','Helvetica Neue',sans-serif", display: "flex", minHeight: "100vh", background: "var(--color-background-tertiary,#f5f5f3)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={{ width: 224, background: "#19191A", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "22px 16px 28px", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#C8A55A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" stroke="#19191A" strokeWidth="2"/>
              <path d="M12 12.5c-4 0-7 2.5-7 5.5h14c0-3-3-5.5-7-5.5z" stroke="#19191A" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M18 4l2.5 2.5M18 9l2.5-2.5" stroke="#19191A" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#E8E6DF", letterSpacing: "-0.03em" }}>Scout</div>
            <div style={{ fontSize: 9, color: "rgba(232,230,223,0.3)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: -1 }}>Recruiting intelligence</div>
          </div>
        </div>

        {/* Dashboard */}
        <NavItem item={{ id: "dashboard", label: "Dashboard", icon: "dashboard", badge: null }} active={activeItem === "dashboard"} onClick={setActiveItem} />
        <div style={{ height: 12 }} />

        {/* Sections */}
        {Object.values(SECTIONS).map((section, i) => (
          <SidebarSection key={i} section={section} activeItem={activeItem} onSelect={setActiveItem} />
        ))}

        {/* Bottom */}
        <div style={{ marginTop: "auto" }}>
          <NavItem item={{ id: "settings", label: "Settings", icon: "settings", badge: null }} active={activeItem === "settings"} onClick={setActiveItem} />
          <div style={{ padding: "14px 16px", borderTop: "0.5px solid rgba(232,230,223,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(200,165,90,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#C8A55A" }}>RG</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(232,230,223,0.7)" }}>Ryan Guard</div>
              <div style={{ fontSize: 10, color: "rgba(232,230,223,0.25)" }}>Pro plan</div>
            </div>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6.5a4 4 0 018 0c0 2 1 3.5 1.5 4.5H2.5C3 10 4 8.5 4 6.5z" stroke="rgba(232,230,223,0.3)" strokeWidth="1.1"/><path d="M6.5 12a1.5 1.5 0 003 0" stroke="rgba(232,230,223,0.3)" strokeWidth="1.1"/></svg>
              <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: "#C2413C", border: "1.5px solid #19191A" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
        <div style={{ padding: "28px 36px", maxWidth: 1020 }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary,#1c1c1a)", letterSpacing: "-0.03em", marginBottom: 4 }}>Good evening, Ryan</div>
            <div style={{ fontSize: 13, color: "var(--color-text-tertiary,#999)" }}>4 active searches · 12 candidates in pipeline · 3 new alerts</div>
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <QuickAction label="New market map" desc="Map the talent landscape for a role" onClick={() => setActiveItem("market-map")} />
            <QuickAction label="Search developers" desc="Find engineers by skills and activity" onClick={() => setActiveItem("search")} />
            <QuickAction label="Map connections" desc="Find warm paths into any company" onClick={() => setActiveItem("connections")} />
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
            <StatCard label="Active maps" value={MOCK_STATS.activeMaps} />
            <StatCard label="Candidates tracked" value={MOCK_STATS.candidatesTracked} />
            <StatCard label="Warm connections" value={MOCK_STATS.warmConnections} accent="#8B6914" />
            <StatCard label="Response rate" value={MOCK_STATS.responseRate} accent="#2D6A4F" />
          </div>

          {/* Two column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 20, alignItems: "start" }}>

            {/* Recent */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary,#1c1c1a)" }}>Recent searches</span>
                <span style={{ fontSize: 12, color: "#8B6914", cursor: "pointer", fontWeight: 500 }} onClick={() => setActiveItem("market-map")}>View all</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MOCK_RECENT.map((m, i) => <MapCard key={i} map={m} />)}
              </div>
            </div>

            {/* Right column */}
            <div>
              {/* Alerts */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary,#1c1c1a)" }}>Alerts</span>
                  <span style={{ fontSize: 9, fontWeight: 700, width: 17, height: 17, borderRadius: "50%", background: "#C2413C", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>3</span>
                </div>
                <span style={{ fontSize: 12, color: "#8B6914", cursor: "pointer", fontWeight: 500 }} onClick={() => setActiveItem("alerts")}>View all</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {MOCK_ALERTS.map((a, i) => <AlertCard key={i} alert={a} />)}
              </div>

              {/* Connection CTA */}
              <div style={{ padding: "18px 20px", borderRadius: 10, background: "rgba(200,165,90,0.05)", border: "0.5px solid rgba(200,165,90,0.15)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B5418", marginBottom: 4 }}>Connection mapper</div>
                <div style={{ fontSize: 12, color: "#8B6914", lineHeight: 1.5, marginBottom: 12 }}>Set up your company to find warm intros on every market map automatically.</div>
                <button onClick={() => setActiveItem("connections")} style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 7, background: "#C8A55A", color: "#19191A", border: "none", cursor: "pointer", letterSpacing: "-0.01em" }}>Set up connections</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
