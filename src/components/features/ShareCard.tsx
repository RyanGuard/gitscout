"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, Link2, X, Loader2 } from "lucide-react";

interface ShareCardProps {
  username: string;
  displayName: string;
  score: number;
}

export function ShareCard({ username, displayName, score }: ShareCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const cardUrl = `/api/developer-card?username=${encodeURIComponent(username)}`;
  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/profile/${username}`
      : `/profile/${username}`;

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setLoading(true);
  }, []);

  const showCopied = useCallback((label: string) => {
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleCopyImage = useCallback(async () => {
    try {
      // Fetch the SVG and render to canvas for clipboard copy
      const res = await fetch(cardUrl);
      const svgText = await res.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 1200, 630);
        URL.revokeObjectURL(url);

        canvas.toBlob(async (pngBlob) => {
          if (!pngBlob) return;
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": pngBlob }),
            ]);
            showCopied("image");
          } catch {
            // Fallback: download instead
            downloadBlob(pngBlob, `${username}-gitscout-card.png`);
            showCopied("downloaded");
          }
        }, "image/png");
      };
      img.src = url;
    } catch {
      // silently fail
    }
  }, [cardUrl, username, showCopied]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(cardUrl);
      const svgText = await res.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 1200, 630);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          downloadBlob(pngBlob, `${username}-gitscout-card.png`);
          showCopied("downloaded");
        }, "image/png");
      };
      img.src = url;
    } catch {
      // silently fail
    }
  }, [cardUrl, username, showCopied]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      showCopied("link");
    } catch {
      // silently fail
    }
  }, [profileUrl, showCopied]);

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        <Share2 className="h-4 w-4" />
        Share Card
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-3xl rounded-xl border border-neutral-700 bg-neutral-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Share Card — {displayName}
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Card Preview */}
              <div className="relative mb-4 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
                    <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={cardUrl}
                  alt={`GitScout card for ${username}`}
                  className="w-full"
                  onLoad={() => setLoading(false)}
                  onError={() => setLoading(false)}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCopyImage}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                >
                  <Share2 className="h-4 w-4" />
                  {copied === "image" ? "Copied!" : "Copy Image"}
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  <Download className="h-4 w-4" />
                  {copied === "downloaded" ? "Downloaded!" : "Download PNG"}
                </button>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  <Link2 className="h-4 w-4" />
                  {copied === "link" ? "Copied!" : "Copy Profile Link"}
                </button>
              </div>

              {/* Score note */}
              {score > 0 && (
                <p className="mt-3 text-xs text-neutral-500">
                  GitScout Score: {score}/100
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
