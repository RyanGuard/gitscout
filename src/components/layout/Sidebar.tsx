"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

const SECTIONS = [
  {
    label: "Source",
    items: [
      { id: "search", label: "Developer search", href: "/search", icon: "search", badge: null },
      { id: "market-map", label: "Market map", href: "/map", icon: "map", badge: "NEW" as const },
    ],
  },
  {
    label: "Connect",
    items: [
      { id: "connections", label: "Connection mapper", href: "/connections", icon: "link", badge: "NEW" as const },
      { id: "outreach", label: "Outreach", href: "/outreach", icon: "send", badge: null },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: "funnel", badge: null },
      { id: "lists", label: "Saved lists", href: "/lists", icon: "list", badge: null },
      { id: "templates", label: "Templates", href: "/templates", icon: "copy", badge: null },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { id: "alerts", label: "Alerts", href: "/alerts", icon: "bell", badge: "SOON" as const },
      { id: "analytics", label: "Analytics", href: "/analytics", icon: "chart", badge: "SOON" as const },
    ],
  },
];

function Icon({ name, color }: { name: string; color: string }) {
  const props = { width: 15, height: 15, fill: "none" as const };
  switch (name) {
    case "dashboard":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.1" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.1" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.1" />
          <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case "search":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.2" />
          <path d="M10.5 10.5L14 14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "map":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M1 3.5l4.5-1.5 5 2 4.5-1.5v10l-4.5 1.5-5-2L1 13.5z" stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M5.5 2v10M10.5 4v10" stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case "link":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M6.5 9.5a3 3 0 004 .5l2-2a3 3 0 00-4.24-4.24L7 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M9.5 6.5a3 3 0 00-4-.5l-2 2a3 3 0 004.24 4.24L9 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "send":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M14.5 1.5l-6 13-2.5-5.5L.5 6.5z" stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M14.5 1.5L6 9" stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case "funnel":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M1.5 2.5h13L9.5 8v4.5L6.5 14V8z" stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case "list":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M5 3h9M5 8h9M5 13h7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="2" cy="3" r="0.8" fill={color} />
          <circle cx="2" cy="8" r="0.8" fill={color} />
          <circle cx="2" cy="13" r="0.8" fill={color} />
        </svg>
      );
    case "copy":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke={color} strokeWidth="1.1" />
          <path d="M3 11V3a1.5 1.5 0 011.5-1.5H11" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M4 6.5a4 4 0 018 0c0 2 1 3.5 1.5 4.5H2.5C3 10 4 8.5 4 6.5z" stroke={color} strokeWidth="1.1" />
          <path d="M6.5 12a1.5 1.5 0 003 0" stroke={color} strokeWidth="1.1" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <path d="M2 14V8M6 14V5M10 14V8M14 14V2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props} viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.1" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  href,
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  badge: "NEW" | "SOON" | null;
  active: boolean;
  onClick?: () => void;
}) {
  const c = active ? "#E8E6DF" : "rgba(232,230,223,0.35)";
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        padding: "7px 14px 7px 16px",
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: active ? "rgba(232,230,223,0.06)" : "transparent",
        borderLeft: active ? "2px solid #C8A55A" : "2px solid transparent",
        transition: "all 0.1s",
        textDecoration: "none",
      }}
    >
      <Icon name={icon} color={c} />
      <span
        style={{
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          color: active ? "#E8E6DF" : "rgba(232,230,223,0.5)",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
      {badge && (
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 3,
            marginLeft: "auto",
            background: badge === "NEW" ? "rgba(200,165,90,0.12)" : "rgba(232,230,223,0.06)",
            color: badge === "NEW" ? "#C8A55A" : "rgba(232,230,223,0.25)",
            letterSpacing: "0.05em",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userName = session?.user?.name || "User";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: "22px 16px 28px", display: "flex", alignItems: "center", gap: 11 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: "#C8A55A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.5" stroke="#19191A" strokeWidth="2" />
            <path d="M12 12.5c-4 0-7 2.5-7 5.5h14c0-3-3-5.5-7-5.5z" stroke="#19191A" strokeWidth="2" strokeLinejoin="round" />
            <path d="M18 4l2.5 2.5M18 9l2.5-2.5" stroke="#19191A" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#E8E6DF", letterSpacing: "-0.03em" }}>Scout</div>
          <div style={{ fontSize: 9, color: "rgba(232,230,223,0.3)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: -1 }}>
            Recruiting intelligence
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <NavItem
        href="/"
        icon="dashboard"
        label="Dashboard"
        badge={null}
        active={isActive(pathname, "/")}
        onClick={() => setMobileOpen(false)}
      />
      <div style={{ height: 12 }} />

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <div style={{ padding: "0 16px", marginBottom: 5 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(232,230,223,0.2)",
              }}
            >
              {section.label}
            </span>
          </div>
          {section.items.map((item) => (
            <NavItem
              key={item.id}
              href={item.href}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              active={isActive(pathname, item.href)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </div>
      ))}

      {/* Spacer */}
      <div style={{ marginTop: "auto" }} />

      {/* Settings */}
      <NavItem
        href="/settings"
        icon="settings"
        label="Settings"
        badge={null}
        active={isActive(pathname, "/settings")}
        onClick={() => setMobileOpen(false)}
      />

      {/* User card */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: "0.5px solid rgba(232,230,223,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(200,165,90,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "#C8A55A",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(232,230,223,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </div>
          <div style={{ fontSize: 10, color: "rgba(232,230,223,0.25)" }}>Pro plan</div>
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 6.5a4 4 0 018 0c0 2 1 3.5 1.5 4.5H2.5C3 10 4 8.5 4 6.5z" stroke="rgba(232,230,223,0.3)" strokeWidth="1.1" />
            <path d="M6.5 12a1.5 1.5 0 003 0" stroke="rgba(232,230,223,0.3)" strokeWidth="1.1" />
          </svg>
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#C2413C",
              border: "1.5px solid #19191A",
            }}
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-lg md:hidden"
        style={{ background: "#19191A", border: "1px solid rgba(232,230,223,0.1)" }}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 4l10 10M14 4L4 14" stroke="#E8E6DF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 5h14M2 9h14M2 13h14" stroke="#E8E6DF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop always visible, mobile slides in */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-40 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: 224,
          background: "#19191A",
          flexShrink: 0,
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
