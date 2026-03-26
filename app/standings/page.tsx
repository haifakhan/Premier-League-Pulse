"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStandingsTable, type LeagueStanding } from "@/lib/api/sports";

interface Standing {
  position: number;
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
  form: string | null;
}

type FormResult = "W" | "D" | "L" | "N";

interface TeamLogoProps {
  teamName: string;
  logoUrl: string | null;
}

interface FormBadgeProps {
  form: string | null;
}

function toStanding(row: LeagueStanding): Standing {
  return {
    position: row.position,
    teamId: row.team.id,
    teamName: row.team.name,
    teamLogo: row.team.crest,
    played: row.playedGames,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    goalDifference: row.goalDifference,
    points: row.points,
    form: row.form,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Unable to load standings right now.";
}

function getTeamInitials(name: string): string {
  const words = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function parseForm(form: string | null): FormResult[] {
  if (!form || !form.trim()) return ["N", "N", "N", "N", "N"];

  const parsed = form
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .map((item): FormResult => {
      if (item === "W" || item === "D" || item === "L") return item;
      return "N";
    });

  const lastFive = parsed.slice(-5);
  const padded = Array.from({ length: Math.max(0, 5 - lastFive.length) }, () => "N" as const);
  return [...padded, ...lastFive];
}

function getFormClass(result: FormResult): string {
  if (result === "W") {
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }
  if (result === "D") {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  }
  if (result === "L") {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }
  return "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300";
}

function getRowAccentClass(index: number, total: number): string {
  if (index < 2) return "border-l-4 border-sky-500/70";
  if (index < 4) return "border-l-4 border-emerald-500/70";
  if (index >= Math.max(0, total - 3)) return "border-l-4 border-red-500/70";
  return "border-l-4 border-transparent";
}

function TeamLogo({ teamName, logoUrl }: TeamLogoProps) {
  const [failed, setFailed] = useState<boolean>(false);

  if (!logoUrl || failed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        {getTeamInitials(teamName)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- team crest domains are dynamic from upstream data.
    <img
      src={logoUrl}
      alt={`${teamName} logo`}
      className="h-9 w-9 rounded-full border border-gray-200 bg-white object-contain p-1 dark:border-gray-700 dark:bg-gray-900"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function FormBadges({ form }: FormBadgeProps) {
  const results = parseForm(form);

  return (
    <div className="flex items-center justify-start gap-1">
      {results.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${getFormClass(result)}`}
          aria-label={result === "N" ? "No form data" : result}
          title={result === "N" ? "No form data" : result}
        >
          {result === "N" ? "-" : result}
        </span>
      ))}
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={`standing-skeleton-${index}`}
            className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </div>
    </div>
  );
}

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStandings() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const table = await getStandingsTable();
        if (!isMounted) return;
        setStandings(table.map(toStanding));
      } catch (error) {
        if (!isMounted) return;
        setStandings([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadStandings();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase dark:text-gray-400">
          Premier League
        </p>
        <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100">
          Standings
        </h1>
        <p className="max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Track the full table with points, goal difference, and each team&apos;s latest form.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <StandingsSkeleton />
      ) : standings.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Standings are not available right now.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[740px] border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-100 text-xs tracking-wide uppercase dark:bg-gray-800">
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">#</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Team</th>
                  <th className="hidden px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 sm:table-cell">
                    P
                  </th>
                  <th className="hidden px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 md:table-cell">
                    W
                  </th>
                  <th className="hidden px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 md:table-cell">
                    D
                  </th>
                  <th className="hidden px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 md:table-cell">
                    L
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400">GD</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400">Pts</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Form</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => {
                  const isEven = index % 2 === 0;
                  const stripeClass = isEven
                    ? "bg-white dark:bg-gray-900"
                    : "bg-gray-50 dark:bg-gray-800";
                  const rowAccentClass = getRowAccentClass(index, standings.length);

                  return (
                    <tr
                      key={row.teamId}
                      className={`${rowAccentClass} ${stripeClass} transition-colors hover:bg-blue-50 dark:hover:bg-gray-700/70`}
                    >
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.position}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <TeamLogo teamName={row.teamName} logoUrl={row.teamLogo} />
                          <Link
                            href={`/forums?teamId=${row.teamId}`}
                            className="truncate text-sm font-semibold text-gray-900 transition-colors hover:text-blue-700 dark:text-gray-100 dark:hover:text-blue-300"
                          >
                            {row.teamName}
                          </Link>
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                        {row.played}
                      </td>
                      <td className="hidden px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                        {row.won}
                      </td>
                      <td className="hidden px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                        {row.drawn}
                      </td>
                      <td className="hidden px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                        {row.lost}
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-extrabold text-gray-900 dark:text-gray-100">
                        {row.points}
                      </td>
                      <td className="px-3 py-3">
                        <FormBadges form={row.form} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
