"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, Heart, Settings } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function AuthButton() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn()}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={session.user.image || ""}
          alt={session.user.name || "User"}
          className="h-8 w-8 rounded-full border-2 border-neutral-200 dark:border-neutral-700"
        />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              {session.user.name}
            </p>
            <p className="text-xs text-neutral-500">{session.user.email}</p>
          </div>
          <Link
            href="/favorites"
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Heart className="h-3.5 w-3.5" />
            My Favorites
          </Link>
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings & Ashby
          </Link>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
