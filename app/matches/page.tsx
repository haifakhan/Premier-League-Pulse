"use client";

import { useEffect, useState } from "react";
import { getMatchesByStatus, type Match } from "@/lib/api/sports";

interface TeamLogoProps {
  src: string | null;
  teamName: string;
}

interface MatchCardProps {
  match: Match;
  isCompleted: boolean;
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

function formatMatchDate(utcDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
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

function TeamLogo({ src, teamName }: TeamLogoProps) {
  const [hasError, setHasError] = useState<boolean>(false);

  if (hasError || !src) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
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
      className="h-12 w-12 rounded-full border border-slate-300 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-900"
      loading="lazy"
    />
  );
}

function MatchCard({ match, isCompleted }: MatchCardProps) {
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;

  return (
    <article
      className={[
        "group rounded-2xl border p-5 shadow-lg transition duration-300 hover:scale-[1.02] hover:border-fuchsia-500/70",
        isCompleted
          ? "border-slate-200 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-950"
          : "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/70",
      ].join(" ")}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
            {isCompleted ? "Recent Result" : "Upcoming Match"}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            {formatMatchDate(match.utcDate)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={[
              "text-xl font-extrabold",
              isCompleted ? "text-slate-800 dark:text-slate-50" : "text-[#38003c] dark:text-fuchsia-300",
            ].join(" ")}
          >
            {isCompleted ? "FT" : formatMatchTime(match.utcDate)}
          </p>
        </div>
      </header>

      {isCompleted && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            {homeScore ?? "-"} - {awayScore ?? "-"}
          </p>
          <p className="mt-1 text-xs font-semibold tracking-[0.15em] text-slate-500 uppercase dark:text-slate-400">
            Final Score
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo src={match.homeTeam.crest} teamName={match.homeTeam.name} />
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {match.homeTeam.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
          <span className="text-xs font-extrabold tracking-[0.2em] text-[#38003c] dark:text-fuchsia-300">
            VS
          </span>
          <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo src={match.awayTeam.crest} teamName={match.awayTeam.name} />
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {match.awayTeam.name}
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-5 border-t border-slate-200 pt-3 dark:border-slate-800">
        <p className="truncate text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400">
          Venue: {match.venue || "Venue TBD"}
        </p>
      </footer>
    </article>
  );
}

function MatchGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="h-60 animate-pulse rounded-2xl border border-slate-200 bg-slate-200/70 dark:border-slate-800 dark:bg-slate-900/70"
        />
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5 border-l-4 border-fuchsia-500 pl-4">
      <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

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

export default function MatchesPage() {
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
        errors.push(toErrorMessage(recentResult.reason, "Unable to load recent results."));
      }

      setErrorMessage(errors.length > 0 ? errors.join(" ") : null);
      setIsLoading(false);
    }

    void loadMatches();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="space-y-10 rounded-2xl bg-gradient-to-b from-slate-100 via-white to-slate-100 p-4 sm:p-6 lg:p-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-[0.18em] text-[#38003c] uppercase dark:text-fuchsia-300">
          Premier League
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
          Matches
        </h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          Follow upcoming fixtures and the latest full-time results across the league.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      <section>
        <SectionHeader
          title="Upcoming Matches"
          subtitle="Kickoff schedule with venue details and club matchups."
        />
        {isLoading ? (
          <MatchGridSkeleton />
        ) : upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} isCompleted={false} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            No upcoming matches available right now.
          </p>
        )}
      </section>

      <section>
        <SectionHeader
          title="Recent Results"
          subtitle="Latest completed matches and final scores."
        />
        {isLoading ? (
          <MatchGridSkeleton />
        ) : recentMatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentMatches.map((match) => (
              <MatchCard key={match.id} match={match} isCompleted />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            No recent results available right now.
          </p>
        )}
      </section>
    </section>
  );
}
