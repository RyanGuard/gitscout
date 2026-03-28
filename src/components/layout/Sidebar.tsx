"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Search, Target, List, Map, Link2, BarChart3, Bell,
  Settings, ChevronLeft, ChevronRight, Sparkles, Send,
} from "lucide-react";

const SECTIONS = [
  {
    label: "Find",
    items: [
      { id: "search", label: "Search", href: "/search", icon: Search },
      { id: "market-map", label: "Market map", href: "/map", icon: Map },
      { id: "connections", label: "Connections", href: "/connections", icon: Link2 },
    ],
  },
  {
    label: "Engage",
    items: [
      { id: "outreach", label: "Sequences", href: "/outreach", icon: Send },
      { id: "match", label: "Match", href: "/match", icon: Target },
      { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: Sparkles, soon: true },
    ],
  },
  {
    label: "Track",
    items: [
      { id: "lists", label: "Saved lists", href: "/lists", icon: List },
      { id: "alerts", label: "Alerts", href: "/alerts", icon: Bell, soon: true },
      { id: "analytics", label: "Analytics", href: "/analytics", icon: BarChart3, soon: true },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("scout-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("scout-sidebar-collapsed", String(next));
  }

  const userName = session?.user?.name || "User";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sidebarWidth = collapsed ? 56 : 224;

  const sidebarContent = (
    <>
      {/* Logo + Collapse toggle */}
      <div className="flex items-center justify-between px-3 pt-4 pb-5">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" stroke="var(--sidebar-bg)" strokeWidth="2" />
              <path d="M12 12.5c-4 0-7 2.5-7 5.5h14c0-3-3-5.5-7-5.5z" stroke="var(--sidebar-bg)" strokeWidth="2" strokeLinejoin="round" />
              <path d="M18 4l2.5 2.5M18 9l2.5-2.5" stroke="var(--sidebar-bg)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-sidebar-text truncate" style={{ letterSpacing: "-0.03em" }}>Scout</div>
            </div>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex h-6 w-6 items-center justify-center rounded-md text-sidebar-muted hover:text-sidebar-text hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-section">
                  {section.label}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = !item.soon && isActive(pathname, item.href);
                const Icon = item.icon;

                if (item.soon) {
                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-muted/40 cursor-default"
                      title={collapsed ? `${item.label} (coming soon)` : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-sidebar-muted/30 bg-sidebar-hover">
                            Soon
                          </span>
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                      active
                        ? "bg-sidebar-active text-sidebar-text font-medium border-l-2 border-l-gold -ml-[2px] pl-[calc(0.625rem+2px)]"
                        : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-sidebar-border px-2 py-2 space-y-0.5">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
            isActive(pathname, "/settings")
              ? "bg-sidebar-active text-sidebar-text font-medium"
              : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
          }`}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        {/* User card */}
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold bg-gold-bg-strong text-gold">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-sidebar-text/70">{userName}</div>
              <div className="text-[10px] text-sidebar-muted">Pro plan</div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-bg border border-sidebar-border md:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? (
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="var(--sidebar-text)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M2 5h14M2 9h14M2 13h14" stroke="var(--sidebar-text)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-40 flex flex-col bg-sidebar-bg transition-all duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: sidebarWidth, flexShrink: 0 }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
