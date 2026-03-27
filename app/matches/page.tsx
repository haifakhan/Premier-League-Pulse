"use client";

import { useEffect, useMemo, useState } from "react";
import { getMatchesByStatus, type Match } from "@/lib/api/sports";

interface TeamLogoProps {
  src: string | null;
  teamName: string;
}

interface MatchCardProps {
  match: Match;
  isCompleted: boolean;
}

type MatchdayKind = "all" | "matchday" | "stage";

interface Matchday {
  id: string;
  label: string;
  kind: MatchdayKind;
  matchday: number | null;
  stage: string | null;
}

const ALL_MATCHDAY_ID = "all";

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

function formatStageLabel(stage: string): string {
  return stage
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildStageId(stage: string): string {
  return `stage-${stage
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function buildMatchdayOptions(matches: Match[]): Matchday[] {
  const matchdays = Array.from(
    new Set(
      matches
        .map((match) => match.matchday)
        .filter((matchday): matchday is number => typeof matchday === "number")
    )
  )
    .sort((a, b) => a - b)
    .map((matchday) => ({
      id: `matchday-${matchday}`,
      label: `Matchday ${matchday}`,
      kind: "matchday" as const,
      matchday,
      stage: null,
    }));

  const stageLookup = new Map<string, string>();
  matches.forEach((match) => {
    if (match.matchday !== null) return;
    if (!match.stage || !match.stage.trim()) return;

    const stage = match.stage.trim();
    const normalizedKey = stage.toLowerCase();
    if (!stageLookup.has(normalizedKey)) {
      stageLookup.set(normalizedKey, stage);
    }
  });

  const stages = Array.from(stageLookup.values())
    .sort((a, b) => a.localeCompare(b))
    .map((stage) => ({
      id: buildStageId(stage),
      label: formatStageLabel(stage),
      kind: "stage" as const,
      matchday: null,
      stage,
    }));

  return [
    {
      id: ALL_MATCHDAY_ID,
      label: "All",
      kind: "all",
      matchday: null,
      stage: null,
    },
    ...matchdays,
    ...stages,
  ];
}

function filterMatchesByMatchday(matches: Match[], selectedMatchday: Matchday): Match[] {
  if (selectedMatchday.kind === "all") return matches;

  if (selectedMatchday.kind === "matchday") {
    return matches.filter((match) => match.matchday === selectedMatchday.matchday);
  }

  const selectedStage = selectedMatchday.stage?.trim().toLowerCase();
  if (!selectedStage) return matches;

  return matches.filter((match) => {
    if (match.matchday !== null) return false;
    if (!match.stage || !match.stage.trim()) return false;
    return match.stage.trim().toLowerCase() === selectedStage;
  });
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

function MatchdayPillsSkeleton() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-slate-100 via-slate-100/90 to-transparent dark:from-slate-950 dark:via-slate-950/90" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-slate-100 via-slate-100/90 to-transparent dark:from-slate-950 dark:via-slate-950/90" />
      <div className="scrollbar-hide overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 whitespace-nowrap py-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`matchday-pill-skeleton-${index}`}
              className="h-9 w-24 animate-pulse rounded-full border border-slate-200 bg-slate-200/80 dark:border-slate-700 dark:bg-slate-800"
            />
          ))}
        </div>
      </div>
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
  const [allUpcomingMatches, setAllUpcomingMatches] = useState<Match[]>([]);
  const [allRecentMatches, setAllRecentMatches] = useState<Match[]>([]);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string>(ALL_MATCHDAY_ID);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const matchdayOptions = useMemo(
    () => buildMatchdayOptions([...allUpcomingMatches, ...allRecentMatches]),
    [allUpcomingMatches, allRecentMatches]
  );

  const selectedMatchday = useMemo(
    () =>
      matchdayOptions.find((option) => option.id === selectedMatchdayId) ?? {
        id: ALL_MATCHDAY_ID,
        label: "All",
        kind: "all" as const,
        matchday: null,
        stage: null,
      },
    [matchdayOptions, selectedMatchdayId]
  );

  const upcomingMatches = useMemo(
    () => filterMatchesByMatchday(allUpcomingMatches, selectedMatchday),
    [allUpcomingMatches, selectedMatchday]
  );

  const recentMatches = useMemo(
    () => filterMatchesByMatchday(allRecentMatches, selectedMatchday),
    [allRecentMatches, selectedMatchday]
  );

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
        setAllUpcomingMatches(sortByUtcDate(upcomingResult.value, "asc"));
      } else {
        setAllUpcomingMatches([]);
        errors.push(toErrorMessage(upcomingResult.reason, "Unable to load upcoming matches."));
      }

      if (recentResult.status === "fulfilled") {
        setAllRecentMatches(sortByUtcDate(recentResult.value, "desc"));
      } else {
        setAllRecentMatches([]);
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
          title="Browse Matchdays"
          subtitle="Use matchday or stage pills to filter both upcoming matches and recent results."
        />
        {isLoading ? (
          <MatchdayPillsSkeleton />
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-slate-100 via-slate-100/90 to-transparent dark:from-slate-950 dark:via-slate-950/90" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-slate-100 via-slate-100/90 to-transparent dark:from-slate-950 dark:via-slate-950/90" />
            <div className="scrollbar-hide overflow-x-auto">
              <div className="inline-flex min-w-full gap-2 whitespace-nowrap py-1">
                {matchdayOptions.map((option) => {
                  const isSelected = option.id === selectedMatchday.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedMatchdayId(option.id)}
                      className={[
                        "rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70",
                        isSelected
                          ? "border-[#38003c] bg-[#38003c] text-white dark:border-fuchsia-500 dark:bg-fuchsia-500 dark:text-slate-950"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                      ].join(" ")}
                      aria-pressed={isSelected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Upcoming Matches"
          subtitle="Kickoff schedule with venue details and club matchups."
        />
        {isLoading ? (
          <MatchGridSkeleton />
        ) : upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid grid-cols-1 gap-4 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3">
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
