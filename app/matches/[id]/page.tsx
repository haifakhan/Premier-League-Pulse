"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Match } from "@/lib/api/sports";
import { getMatchThreadAvailability, type MatchThreadAvailability } from "@/lib/api/threads";

type MatchApiResponse = {
  data: Match | null;
  error?: { message?: string; details?: string } | string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
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

function formatDateTime(utcDate: string): string {
  const parsed = new Date(utcDate);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatWindowDate(value: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function TeamLogo({ src, teamName }: { src: string | null; teamName: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
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

async function fetchMatchById(matchId: string): Promise<Match> {
  const response = await fetch(`/api/sports/matches/${matchId}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as MatchApiResponse | null;

  if (!response.ok || !payload?.data) {
    const fallback =
      response.status >= 500
        ? "Match service is temporarily unavailable."
        : "Unable to load this match.";
    const apiMessage =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message || payload?.error?.details;
    throw new Error(apiMessage || fallback);
  }

  return payload.data;
}

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const matchId = params?.id ?? "";
  const discussionQuery = searchParams?.get("discussion");

  const [match, setMatch] = useState<Match | null>(null);
  const [threadAvailability, setThreadAvailability] = useState<MatchThreadAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      if (!matchId) {
        setErrorMessage("Invalid match id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [matchData, discussionData] = await Promise.all([
          fetchMatchById(matchId),
          getMatchThreadAvailability(matchId),
        ]);

        if (cancelled) return;
        setMatch(matchData);
        setThreadAvailability(discussionData);
      } catch (error) {
        if (cancelled) return;
        setMatch(null);
        setThreadAvailability(null);
        setErrorMessage(toErrorMessage(error, "Unable to load this match."));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const resultLabel = useMemo(() => {
    if (!match) return "vs";
    const home = match.score?.fullTime?.home;
    const away = match.score?.fullTime?.away;
    if (home == null || away == null) return "vs";
    return `${home} - ${away}`;
  }, [match]);

  if (isLoading) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Loading match details...</p>;
  }

  if (errorMessage) {
    return (
      <section className="mx-auto max-w-4xl rounded-2xl border border-red-300/80 bg-red-100/80 p-6 dark:border-red-600/70 dark:bg-red-900/20">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Match unavailable</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        <Link
          href="/matches"
          className="mt-4 inline-flex rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600"
        >
          Back to Matches
        </Link>
      </section>
    );
  }

  if (!match || !threadAvailability) {
    return null;
  }

  const thread = threadAvailability.thread;
  const isOpenThread = thread?.status === "OPEN";
  const opensAtLabel = formatWindowDate(threadAvailability.window.opensAt);
  const closesAtLabel = formatWindowDate(threadAvailability.window.closesAt);

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-300/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/matches"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80"
          >
            Back to Matches
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo src={match.homeTeam.crest} teamName={match.homeTeam.name} />
            <div>
              <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase dark:text-slate-400">
                Home
              </p>
              <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{match.homeTeam.name}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xl font-black tracking-[0.18em] text-slate-900 uppercase dark:text-slate-100">
              {resultLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(match.utcDate)}</p>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase dark:text-slate-400">
                Away
              </p>
              <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{match.awayTeam.name}</p>
            </div>
            <TeamLogo src={match.awayTeam.crest} teamName={match.awayTeam.name} />
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Venue: {match.venue || "Venue TBD"}</p>
      </header>

      <section className="rounded-2xl border border-slate-300/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {thread ? (
            <span
              className={[
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
                isOpenThread
                  ? "border-emerald-400/70 bg-emerald-100/80 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200"
                  : "border-amber-400/70 bg-amber-100/80 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-200",
              ].join(" ")}
            >
              {thread.status}
            </span>
          ) : (
            <span className="rounded-full border border-slate-300/80 bg-slate-100/80 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700 uppercase dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-300">
              No Active Thread
            </span>
          )}

          <span className="rounded-full border border-sky-300/70 bg-sky-100/80 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-sky-700 uppercase dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200">
            Match Discussion
          </span>
        </div>

        <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">Discussion</h2>

        {thread ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {isOpenThread
              ? "This thread is open for comments."
              : "This thread is closed, but posts and poll results are still viewable."}
          </p>
        ) : threadAvailability.availability === "PRE_WINDOW" ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Match discussion opens on {opensAtLabel}. You can browse the match details for now.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            No discussion thread is currently available for this match.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {thread ? (
            <Link
              href={`/forums/${thread.id}`}
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              {isOpenThread ? "Open Match Thread" : "View Match Thread"}
            </Link>
          ) : (
            <Link
              href={`/matches/${matchId}/discussion`}
              className="inline-flex items-center justify-center rounded-full border border-slate-300/80 bg-slate-100/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Check Discussion Status
            </Link>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-xs text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">
          <p>Discussion opens: {opensAtLabel}</p>
          <p>Discussion closes: {closesAtLabel}</p>
        </div>

        {discussionQuery === "opens-soon" ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            This thread is not open yet. It opens at most 14 days before kickoff.
          </p>
        ) : null}
        {discussionQuery === "unavailable" ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Discussion is currently unavailable for this match.
          </p>
        ) : null}
        {discussionQuery === "error" ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            Unable to resolve the discussion thread right now. Please try again.
          </p>
        ) : null}
      </section>
    </section>
  );
}
