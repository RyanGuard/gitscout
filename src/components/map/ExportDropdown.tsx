"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface ExportDropdownProps {
  mapId: string;
}

export function ExportDropdown({ mapId }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function exportPdf(variant: "overview" | "full") {
    setLoading(variant);
    setOpen(false);
    try {
      const res = await fetch(`/api/market-map/${mapId}/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        `market_map_${variant}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-700/50 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating..." : "Export PDF"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-neutral-700/50 bg-neutral-900 p-1 shadow-xl">
            <button
              onClick={() => exportPdf("overview")}
              className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-neutral-800/50 transition-colors"
            >
              <div className="font-medium text-white">Overview PDF</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                Company-level only
              </div>
            </button>
            <button
              onClick={() => exportPdf("full")}
              className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-neutral-800/50 transition-colors"
            >
              <div className="font-medium text-white">Full detail PDF</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                Includes candidate details
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
