"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMatchesByStatus, type Match } from "@/lib/api/sports";

const DASHBOARD_MATCH_LIMIT = 4;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function sortByUtcDate(matches: Match[], order: "asc" | "desc"): Match[] {
  return [...matches].sort((a, b) => {
    const first = new Date(a.utcDate).getTime();
    const second = new Date(b.utcDate).getTime();
    return order === "asc" ? first - second : second - first;
  });
}

function formatMatchDate(utcDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(utcDate));
}

function formatMatchTime(utcDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(utcDate));
}

function getShortName(name: string): string {
  const parts = name
    .split(" ")
    .map((piece) => piece.trim())
    .filter(Boolean);

  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function TeamLogo({ src, teamName }: { src: string | null; teamName: string }) {
  const [hasError, setHasError] = useState<boolean>(false);

  if (hasError || !src) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {getShortName(teamName)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- crest URLs come from upstream and are not preconfigured domains.
    <img
      src={src}
      alt={`${teamName} crest`}
      onError={() => setHasError(true)}
      className="h-8 w-8 rounded-full border border-slate-300 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-900"
      loading="lazy"
    />
  );
}

function MatchListItem({ match, isCompleted }: { match: Match; isCompleted: boolean }) {
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;
  const scoreLabel =
    isCompleted && homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : "vs";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-sky-500/60 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/60"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold">{formatMatchDate(match.utcDate)}</span>
        <span>{formatMatchTime(match.utcDate)}</span>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TeamLogo src={match.homeTeam.crest} teamName={match.homeTeam.name} />
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {match.homeTeam.name}
          </span>
        </div>

        <span className="text-xs font-extrabold tracking-[0.14em] text-slate-700 uppercase dark:text-slate-200">
          {scoreLabel}
        </span>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
            {match.awayTeam.name}
          </span>
          <TeamLogo src={match.awayTeam.crest} teamName={match.awayTeam.name} />
        </div>
      </div>
    </Link>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: DASHBOARD_MATCH_LIMIT }).map((_, index) => (
        <div
          key={`home-match-skeleton-${index}`}
          className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/70"
        />
      ))}
    </div>
  );
}

function MatchSection({
  title,
  emptyText,
  viewAllHref,
  matches,
  isLoading,
  isCompleted,
}: {
  title: string;
  emptyText: string;
  viewAllHref: string;
  matches: Match[];
  isLoading: boolean;
  isCompleted: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <Link
          href={viewAllHref}
          className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <SectionSkeleton />
      ) : matches.length > 0 ? (
        <div className="space-y-2.5">
          {matches.map((match) => (
            <MatchListItem key={match.id} match={match} isCompleted={isCompleted} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export default function HomeDashboardMatches() {
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMatches() {
      setIsLoading(true);
      setErrorMessage(null);

      const [upcomingResult, recentResult] = await Promise.allSettled([
        getMatchesByStatus("UPCOMING"),
        getMatchesByStatus("RECENT"),
      ]);

      if (!isMounted) return;

      const errors: string[] = [];

      if (upcomingResult.status === "fulfilled") {
        setUpcomingMatches(sortByUtcDate(upcomingResult.value, "asc"));
      } else {
        setUpcomingMatches([]);
        errors.push(toErrorMessage(upcomingResult.reason, "Unable to load upcoming matches."));
      }

      if (recentResult.status === "fulfilled") {
        setRecentMatches(sortByUtcDate(recentResult.value, "desc"));
      } else {
        setRecentMatches([]);
        errors.push(toErrorMessage(recentResult.reason, "Unable to load recent matches."));
      }

      setErrorMessage(errors.length > 0 ? errors.join(" ") : null);
      setIsLoading(false);
    }

    void loadMatches();

    return () => {
      isMounted = false;
    };
  }, []);

  const upcomingPreview = useMemo(
    () => upcomingMatches.slice(0, DASHBOARD_MATCH_LIMIT),
    [upcomingMatches]
  );
  const recentPreview = useMemo(
    () => recentMatches.slice(0, DASHBOARD_MATCH_LIMIT),
    [recentMatches]
  );

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-4 sm:px-6 lg:px-8">
      {errorMessage && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-amber-200">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MatchSection
          title="Upcoming Matches"
          emptyText="No upcoming matches available right now."
          viewAllHref="/matches?status=upcoming"
          matches={upcomingPreview}
          isLoading={isLoading}
          isCompleted={false}
        />
        <MatchSection
          title="Recent Matches"
          emptyText="No completed matches available right now."
          viewAllHref="/matches?status=recent"
          matches={recentPreview}
          isLoading={isLoading}
          isCompleted={true}
        />
      </div>
    </section>
  );
}
