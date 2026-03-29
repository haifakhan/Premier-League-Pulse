"use client";

import { useEffect, useMemo, useState } from "react";
import { getDailyDigest, type DailyDigest } from "@/lib/api/digest";

function formatUpdatedTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  const datePart = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `Updated ${datePart} · ${timePart}`;
}

function DigestSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200/90 dark:bg-slate-700/80" />
      <div className="h-4 w-full animate-pulse rounded bg-slate-200/90 dark:bg-slate-700/80" />
      <div className="h-4 w-9/12 animate-pulse rounded bg-slate-200/90 dark:bg-slate-700/80" />
    </div>
  );
}

export default function HomeDailyDigest() {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDigest() {
      setIsLoading(true);
      setHasError(false);

      try {
        const payload = await getDailyDigest();
        if (!cancelled) {
          setDigest(payload);
        }
      } catch {
        if (!cancelled) {
          setDigest(null);
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDigest();

    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo(
    () => (digest?.sections ?? []).filter((section) => section.title && section.content).slice(0, 4),
    [digest?.sections]
  );
  const fallbackSummary = (digest?.summary ?? "").trim();
  const hasDigestContent = sections.length > 0 || fallbackSummary.length > 0;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 border-l-sky-500 bg-gradient-to-br from-sky-50/70 via-white to-white p-4 shadow-sm dark:border-slate-700/80 dark:border-l-sky-400 dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-900 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:text-base">
              Daily Digest
            </h2>
            <span className="inline-flex items-center rounded-full border border-slate-300/90 bg-slate-100/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-slate-300">
              AI Generated
            </span>
          </div>

          {!isLoading && digest ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatUpdatedTimestamp(digest.updatedAt)}
            </p>
          ) : null}
        </div>

        <div className="mt-3">
          {isLoading ? (
            <DigestSkeleton />
          ) : hasError || !digest || !hasDigestContent ? (
            <p className="rounded-xl border border-slate-200/90 bg-white/70 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">
              No digest available yet — check back later.
            </p>
          ) : sections.length > 0 ? (
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={`${section.title}-${index}`} className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {section.title}
                  </p>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
              {fallbackSummary}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
