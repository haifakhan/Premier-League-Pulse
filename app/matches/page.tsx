"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMatchesByStatus, type Match } from "@/lib/api/sports";

interface TeamLogoProps {
  src: string | null;
  teamName: string;
}

interface MatchCardProps {
  match: Match;
  isCompleted: boolean;
}

interface MatchdayOption {
  id: string;
  label: string;
  kind: "all" | "matchday" | "stage";
  matchday: number | null;
  stage: string | null;
}

type StatusFilter = "all" | "upcoming" | "recent";

const ALL_MATCHDAY_ID = "all";
const DEFAULT_MATCHDAY_OPTION: MatchdayOption = {
  id: ALL_MATCHDAY_ID,
  label: "All",
  kind: "all",
  matchday: null,
  stage: null,
};

const STATUS_FILTER_OPTIONS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All Matches" },
  { id: "upcoming", label: "Upcoming" },
  { id: "recent", label: "Completed" },
];

function parseStatusFilter(value: string | null): StatusFilter {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "upcoming" || normalized === "recent" || normalized === "all") {
    return normalized;
  }
  return "all";
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

function formatDateRange(startDate: Date, endDate: Date): string {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  if (startTime === endTime) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(startDate);
  }

  const startLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(startDate);

  const endLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(endDate);

  return `${startLabel} - ${endLabel}`;
}

function formatStageLabel(stage: string): string {
  return stage
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function buildStageId(stage: string): string {
  return `stage-${normalizeStage(stage).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function buildMatchdayOptions(matches: Match[]): MatchdayOption[] {
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

  const stageMap = new Map<string, string>();
  matches.forEach((match) => {
    if (!match.stage || !match.stage.trim()) return;
    const normalized = normalizeStage(match.stage);
    if (!stageMap.has(normalized)) {
      stageMap.set(normalized, match.stage.trim());
    }
  });

  const stages = Array.from(stageMap.values())
    .sort((a, b) => formatStageLabel(a).localeCompare(formatStageLabel(b)))
    .map((stage) => ({
      id: buildStageId(stage),
      label: formatStageLabel(stage),
      kind: "stage" as const,
      matchday: null,
      stage,
    }));

  return [
    DEFAULT_MATCHDAY_OPTION,
    ...matchdays,
    ...stages,
  ];
}

function filterMatchesByMatchday(matches: Match[], selectedMatchday: MatchdayOption): Match[] {
  if (selectedMatchday.kind === "all") return matches;

  if (selectedMatchday.kind === "matchday") {
    return matches.filter((match) => match.matchday === selectedMatchday.matchday);
  }

  const selectedStage = selectedMatchday.stage;
  if (!selectedStage) return matches;
  const normalizedSelectedStage = normalizeStage(selectedStage);
  return matches.filter((match) => {
    if (!match.stage || !match.stage.trim()) return false;
    return normalizeStage(match.stage) === normalizedSelectedStage;
  });
}

function getDateRangeLabel(matches: Match[], selectedMatchday: MatchdayOption): string {
  const scopedMatches = filterMatchesByMatchday(matches, selectedMatchday);

  const timestamps = scopedMatches
    .map((match) => new Date(match.utcDate).getTime())
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => a - b);

  if (timestamps.length === 0) return "No fixtures available";

  return formatDateRange(new Date(timestamps[0]), new Date(timestamps[timestamps.length - 1]));
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M8 2.75v3.5M16 2.75v3.5M3.5 9.5h17" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path
        d="M12 21c-2.7-3.3-6-6.8-6-10.6A6 6 0 0 1 18 10.4C18 14.2 14.7 17.7 12 21Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  );
}

function TeamLogo({ src, teamName }: TeamLogoProps) {
  const [hasError, setHasError] = useState<boolean>(false);

  if (hasError || !src) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
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
      className="h-10 w-10 rounded-full border border-slate-300 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-900"
      loading="lazy"
    />
  );
}

function MatchCard({ match, isCompleted }: MatchCardProps) {
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;
  const resultLabel =
    isCompleted && homeScore !== null && awayScore !== null ? `${homeScore} - ${awayScore}` : "vs";
  const statusLabel = isCompleted ? "FT" : "Upcoming";

  return (
    <article
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:border-sky-500/70 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/70"
      aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name}`}
    >
      <Link
        href={`/matches/${match.id}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-500"
      >
        <div className="flex flex-col md:grid md:grid-cols-[180px_minmax(0,1fr)_190px]">
          <div className="border-b border-slate-200 px-4 py-4 md:border-r md:border-b-0 dark:border-slate-700">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
              {formatMatchDate(match.utcDate)}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatMatchTime(match.utcDate)}
            </p>
            <span
              className={[
                "mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase",
                isCompleted
                  ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  : "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-600 dark:bg-sky-700/20 dark:text-sky-300",
              ].join(" ")}
            >
              {statusLabel}
            </span>
          </div>

          <div className="px-4 py-4 md:flex md:h-full md:items-center md:px-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <TeamLogo src={match.homeTeam.crest} teamName={match.homeTeam.name} />
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {match.homeTeam.name}
                </p>
              </div>

              <span
                className={[
                  "min-w-16 text-center text-sm font-extrabold tracking-[0.16em] uppercase",
                  isCompleted ? "text-slate-900 dark:text-slate-100" : "text-sky-700 dark:text-sky-300",
                ].join(" ")}
              >
                {resultLabel}
              </span>

              <div className="flex min-w-0 items-center justify-end gap-2.5">
                <TeamLogo src={match.awayTeam.crest} teamName={match.awayTeam.name} />
                <p className="truncate text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {match.awayTeam.name}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 md:border-t-0 md:border-l dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
              <MapPinIcon className="h-4 w-4 text-sky-600 dark:text-sky-300" />
              <p className="text-xs font-semibold tracking-[0.12em] uppercase">Venue</p>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {match.venue || "Venue TBD"}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
        <Link
          href={`/matches/${match.id}`}
          className="text-xs font-semibold text-slate-700 transition hover:text-sky-700 dark:text-slate-200 dark:hover:text-sky-300"
        >
          Match Details
        </Link>
        <Link
          href={`/matches/${match.id}/discussion`}
          className="rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
        >
          Discuss
        </Link>
      </div>
    </article>
  );
}

function MatchListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`match-row-skeleton-${index}`}
          className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/70"
        />
      ))}
    </div>
  );
}

function MatchdaySelectorSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 h-18 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={`matchday-selector-skeleton-${index}`}
            className="h-9 w-16 shrink-0 animate-pulse rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  const emptyText =
    statusFilter === "all"
      ? "No matches found for the selected filter."
      : statusFilter === "upcoming"
        ? "No upcoming matches found for the selected filter."
        : "No completed matches found for the selected filter.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <CalendarIcon className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{emptyText}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Try another status, matchday, or stage.
      </p>
    </div>
  );
}

interface MatchesPageContentProps {
  initialStatusFilter: StatusFilter;
}

function MatchesPageContent({ initialStatusFilter }: MatchesPageContentProps) {
  const [allUpcomingMatches, setAllUpcomingMatches] = useState<Match[]>([]);
  const [allRecentMatches, setAllRecentMatches] = useState<Match[]>([]);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string>(ALL_MATCHDAY_ID);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const matchdayScrollRef = useRef<HTMLDivElement | null>(null);

  const allMatches = useMemo(
    () => [...allUpcomingMatches, ...allRecentMatches],
    [allUpcomingMatches, allRecentMatches]
  );

  const matchdayOptions = useMemo(() => buildMatchdayOptions(allMatches), [allMatches]);

  const selectedMatchday = useMemo(
    () => matchdayOptions.find((option) => option.id === selectedMatchdayId) ?? DEFAULT_MATCHDAY_OPTION,
    [matchdayOptions, selectedMatchdayId]
  );

  const selectedMatchdayIndex = useMemo(
    () => matchdayOptions.findIndex((option) => option.id === selectedMatchday.id),
    [matchdayOptions, selectedMatchday.id]
  );

  const upcomingMatches = useMemo(
    () => filterMatchesByMatchday(allUpcomingMatches, selectedMatchday),
    [allUpcomingMatches, selectedMatchday]
  );

  const recentMatches = useMemo(
    () => filterMatchesByMatchday(allRecentMatches, selectedMatchday),
    [allRecentMatches, selectedMatchday]
  );

  const dateRangeLabel = useMemo(
    () => getDateRangeLabel(allMatches, selectedMatchday),
    [allMatches, selectedMatchday]
  );

  const visibleMatches = useMemo(() => {
    if (statusFilter === "upcoming") {
      return upcomingMatches.map((match) => ({ match, isCompleted: false }));
    }

    if (statusFilter === "recent") {
      return recentMatches.map((match) => ({ match, isCompleted: true }));
    }

    return [
      ...upcomingMatches.map((match) => ({ match, isCompleted: false })),
      ...recentMatches.map((match) => ({ match, isCompleted: true })),
    ];
  }, [statusFilter, upcomingMatches, recentMatches]);

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

  function selectAdjacentMatchday(direction: "prev" | "next") {
    if (selectedMatchdayIndex < 0) return;

    const nextIndex = direction === "prev" ? selectedMatchdayIndex - 1 : selectedMatchdayIndex + 1;
    const nextMatchday = matchdayOptions[nextIndex];
    if (!nextMatchday) return;

    setSelectedMatchdayId(nextMatchday.id);
  }

  function scrollMatchdayChips(direction: "left" | "right") {
    const scroller = matchdayScrollRef.current;
    if (!scroller) return;

    const distance = Math.max(180, Math.round(scroller.clientWidth * 0.6));
    scroller.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const scroller = matchdayScrollRef.current;
    if (!scroller) return;

    const selectedButton = Array.from(
      scroller.querySelectorAll<HTMLButtonElement>("button[data-matchday-option-id]")
    ).find((button) => button.dataset.matchdayOptionId === selectedMatchday.id);

    if (!selectedButton) return;

    selectedButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedMatchday.id, matchdayOptions.length]);

  return (
    <div className="space-y-8">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen border-y border-slate-200 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-600 dark:bg-sky-700/20 dark:text-sky-300">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                Matches List
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                Explore all matchdays, switch between upcoming and completed fixtures, and open any match
                for details.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-5">
        {errorMessage && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-200">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <MatchdaySelectorSkeleton />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => selectAdjacentMatchday("prev")}
                disabled={selectedMatchdayIndex <= 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Previous matchday"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
                  {selectedMatchday.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{dateRangeLabel}</p>
              </div>

              <button
                type="button"
                onClick={() => selectAdjacentMatchday("next")}
                disabled={selectedMatchdayIndex === -1 || selectedMatchdayIndex >= matchdayOptions.length - 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Next matchday"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => scrollMatchdayChips("left")}
                className="absolute top-1/2 left-0 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Scroll matchday filters left"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>

              <div
                ref={matchdayScrollRef}
                className="scrollbar-hide overflow-x-auto overflow-y-hidden px-10 [touch-action:pan-x]"
              >
                <div className="flex w-max min-w-full gap-2 whitespace-nowrap pb-1 pr-1">
                  {matchdayOptions.map((option) => {
                    const isSelected = option.id === selectedMatchday.id;
                    const quickSelectLabel =
                      option.kind === "matchday" && option.matchday !== null
                        ? String(option.matchday)
                        : option.label;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedMatchdayId(option.id)}
                        className={[
                          "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-500",
                          isSelected
                            ? "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                        ].join(" ")}
                        aria-pressed={isSelected}
                        aria-label={option.label}
                        data-matchday-option-id={option.id}
                      >
                        {quickSelectLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => scrollMatchdayChips("right")}
                className="absolute top-1/2 right-0 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Scroll matchday filters right"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.1em] text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">
              <FilterIcon className="h-3.5 w-3.5" />
              Status Filter
            </span>
            {STATUS_FILTER_OPTIONS.map((option) => {
              const isSelected = statusFilter === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatusFilter(option.id)}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-500",
                    isSelected
                      ? "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                  ].join(" ")}
                  aria-pressed={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <MatchListSkeleton />
          ) : visibleMatches.length > 0 ? (
            <div className="space-y-3">
              {visibleMatches.map(({ match, isCompleted }) => (
                <MatchCard key={match.id} match={match} isCompleted={isCompleted} />
              ))}
            </div>
          ) : (
            <EmptyState statusFilter={statusFilter} />
          )}
        </section>
      </section>
    </div>
  );
}

function MatchesPageFromQuery() {
  const searchParams = useSearchParams();
  const statusFilterFromQuery = parseStatusFilter(searchParams.get("status"));

  return (
    <MatchesPageContent
      key={statusFilterFromQuery}
      initialStatusFilter={statusFilterFromQuery}
    />
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<MatchesPageContent initialStatusFilter="all" />}>
      <MatchesPageFromQuery />
    </Suspense>
  );
}
