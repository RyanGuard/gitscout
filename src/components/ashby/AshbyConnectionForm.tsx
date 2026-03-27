"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Check, Unplug, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

export function AshbyConnectionForm() {
  const { data: session } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    setChecking(true);
    try {
      const res = await fetch("/api/ashby/connect");
      const data = await res.json();
      setConnected(data.connected);
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (!session) return null;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/ashby/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Connection failed");
        return;
      }
      setConnected(true);
      setApiKey("");
      setSuccess(
        data.organizationName
          ? `Connected to ${data.organizationName}`
          : "Connected successfully"
      );
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await fetch("/api/ashby/connect", { method: "DELETE" });
      setConnected(false);
      setSuccess("Disconnected from Ashby");
    } catch {
      setError("Failed to disconnect");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking connection...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {connected ? (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <Check className="h-4 w-4" />
            Ashby connected
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Unplug className="h-3 w-3" />
            )}
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label
              htmlFor="ashby-api-key"
              className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Ashby API Key
            </label>
            <input
              id="ashby-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Ashby API key"
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
                "border-neutral-300 bg-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
                "dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:focus:border-gold dark:focus:ring-gold"
              )}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Find your API key in Ashby &rarr; Settings &rarr; API Keys
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "bg-gold text-white hover:bg-gold-hover disabled:opacity-50",
              "dark:bg-gold dark:hover:bg-gold-hover"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            Connect
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
      )}
    </div>
  );
}
