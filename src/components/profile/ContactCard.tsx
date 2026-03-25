"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  Link as LinkIcon,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Briefcase,
  Building2,
  AtSign,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { ContactInfo } from "@/types";

interface ContactCardProps {
  contactInfo: ContactInfo;
  onReEnrich: () => void;
  loading: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1 inline-flex items-center rounded p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

const SENIORITY_COLORS: Record<string, string> = {
  junior:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  mid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  senior:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  staff:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  principal:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function ContactCard({
  contactInfo,
  onReEnrich,
  loading,
}: ContactCardProps) {
  const hasContactData =
    contactInfo.primaryEmail ||
    contactInfo.phone ||
    contactInfo.linkedinUrl ||
    contactInfo.twitterUrl;

  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Contact Info
        </h2>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {contactInfo.enrichedAt && (
            <span>Enriched {timeAgo(contactInfo.enrichedAt)}</span>
          )}
          {contactInfo.enrichmentSource && (
            <Badge
              className={cn(
                "text-xs",
                contactInfo.enrichmentSource === "apollo"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
              )}
            >
              {contactInfo.enrichmentSource === "apollo"
                ? "Apollo"
                : "GitHub"}
            </Badge>
          )}
          <button
            onClick={onReEnrich}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            title="Re-enrich profile"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Re-enrich
          </button>
        </div>
      </div>

      {/* Title and seniority */}
      {(contactInfo.currentTitle ||
        contactInfo.seniorityLevel ||
        contactInfo.normalizedCompany) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {contactInfo.currentTitle && (
            <span className="flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Briefcase className="h-4 w-4 text-neutral-400" />
              {contactInfo.currentTitle}
            </span>
          )}
          {contactInfo.normalizedCompany && (
            <span className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
              <Building2 className="h-4 w-4 text-neutral-400" />
              {contactInfo.normalizedCompany}
            </span>
          )}
          {contactInfo.seniorityLevel && (
            <Badge
              className={
                SENIORITY_COLORS[contactInfo.seniorityLevel] ||
                "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }
            >
              {contactInfo.seniorityLevel.charAt(0).toUpperCase() +
                contactInfo.seniorityLevel.slice(1)}
            </Badge>
          )}
        </div>
      )}

      {/* Contact details */}
      {hasContactData ? (
        <div className="space-y-2">
          {/* Emails */}
          {contactInfo.emails.length > 0 && (
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {contactInfo.emails.map((email) => (
                  <span
                    key={email}
                    className={cn(
                      "inline-flex items-center text-sm",
                      email === contactInfo.primaryEmail
                        ? "font-medium text-neutral-900 dark:text-white"
                        : "text-neutral-600 dark:text-neutral-400",
                    )}
                  >
                    {email}
                    <CopyButton text={email} />
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Phone */}
          {contactInfo.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                {contactInfo.phone}
              </span>
              <CopyButton text={contactInfo.phone} />
            </div>
          )}

          {/* LinkedIn */}
          {contactInfo.linkedinUrl && (
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 shrink-0 text-neutral-400" />
              <a
                href={contactInfo.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                LinkedIn
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Twitter */}
          {contactInfo.twitterUrl && (
            <div className="flex items-center gap-2">
              <AtSign className="h-4 w-4 shrink-0 text-neutral-400" />
              <a
                href={contactInfo.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Twitter / X
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Personal site */}
          {contactInfo.personalSite && (
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 shrink-0 text-neutral-400" />
              <a
                href={contactInfo.personalSite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          No contact information found.
        </p>
      )}

      {/* Employment history */}
      {contactInfo.employmentHistory &&
        contactInfo.employmentHistory.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <h3 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Employment History
            </h3>
            <div className="space-y-1.5">
              {contactInfo.employmentHistory.map((job, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      job.current
                        ? "bg-green-500"
                        : "bg-neutral-300 dark:bg-neutral-600",
                    )}
                  />
                  <span>
                    {job.title && (
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        {job.title}
                      </span>
                    )}
                    {job.title && job.organization_name && " at "}
                    {job.organization_name}
                    {job.start_date && (
                      <span className="ml-1 text-neutral-400">
                        ({job.start_date})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
