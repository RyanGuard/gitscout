"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export function LinkedinImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ count: number; date: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setImporting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/connections/linkedin-import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ count: data.count, date: new Date().toISOString() });
      } else {
        setError(data.error || "Import failed");
      }
    } catch {
      setError("Failed to upload file");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Export your LinkedIn connections as CSV, then upload here. These will be
        cross-referenced on all future connection lookups.
      </p>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        LinkedIn &rarr; Settings &rarr; Data Privacy &rarr; Get a copy of your
        data &rarr; Connections
      </p>

      <div className="mt-4">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {importing ? "Importing..." : "Upload CSV"}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {result.count} connections imported successfully
        </div>
      )}
    </div>
  );
}
