export type MatchStatusQuery = "UPCOMING" | "RECENT";

interface MatchScoreLine {
  home: number | null;
  away: number | null;
}

interface MatchScore {
  fullTime: MatchScoreLine | null;
}

interface MatchTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

export interface Match {
  id: number;
  utcDate: string;
  status: string;
  venue: string | null;
  matchday: number | null;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  score: MatchScore;
}

interface MatchesDataResponse {
  matches: Match[];
}

interface ApiErrorPayload {
  message?: string;
  details?: string;
}

interface SportsApiResponse<TData> {
  cache: "HIT" | "MISS" | "REFRESH" | "STALE";
  data: TData | null;
  error?: ApiErrorPayload | string;
}

interface StandingsDataResponse {
  standings?: StandingSection[];
}

interface StandingSection {
  type?: string;
  table?: StandingRow[];
}

interface StandingRow {
  position?: number;
  team?: StandingTeam;
  playedGames?: number;
  won?: number;
  draw?: number;
  lost?: number;
  goalDifference?: number;
  points?: number;
  form?: string | null;
}

interface StandingTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
  crest?: string | null;
}

export interface LeagueStanding {
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalDifference: number;
  points: number;
  form: string | null;
  team: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string | null;
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;

  if (payload && typeof payload === "object") {
    const withError = payload as { error?: unknown };
    const error = withError.error;

    if (typeof error === "string" && error.trim()) return error;
    if (error && typeof error === "object") {
      const errorObject = error as ApiErrorPayload;
      if (errorObject.message && errorObject.details) {
        return `${errorObject.message}: ${errorObject.details}`;
      }
      if (errorObject.message) return errorObject.message;
      if (errorObject.details) return errorObject.details;
    }
  }

  return fallback;
}

function normalizeStandingRow(row: StandingRow): LeagueStanding | null {
  if (!row || typeof row !== "object") return null;

  const teamId = row.team?.id;
  const teamName = row.team?.name;
  const position = row.position;
  const playedGames = row.playedGames;
  const won = row.won;
  const draw = row.draw;
  const lost = row.lost;
  const goalDifference = row.goalDifference;
  const points = row.points;

  if (
    typeof teamId !== "number" ||
    typeof teamName !== "string" ||
    typeof position !== "number" ||
    typeof playedGames !== "number" ||
    typeof won !== "number" ||
    typeof draw !== "number" ||
    typeof lost !== "number" ||
    typeof goalDifference !== "number" ||
    typeof points !== "number"
  ) {
    return null;
  }

  return {
    position,
    playedGames,
    won,
    draw,
    lost,
    goalDifference,
    points,
    form: typeof row.form === "string" ? row.form : null,
    team: {
      id: teamId,
      name: teamName,
      shortName: row.team?.shortName ?? teamName,
      tla: row.team?.tla ?? teamName.slice(0, 3).toUpperCase(),
      crest: row.team?.crest ?? null,
    },
  };
}

export async function getMatchesByStatus(status: MatchStatusQuery): Promise<Match[]> {
  const response = await fetch(`/api/sports/matches?status=${status}`, {
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? "Match service is temporarily unavailable. Please try again shortly."
        : `Unable to load ${status.toLowerCase()} matches.`;
    throw new Error(getErrorMessage(payload, fallback));
  }

  const typedPayload = payload as SportsApiResponse<MatchesDataResponse>;
  const matches = typedPayload?.data?.matches;

  if (!Array.isArray(matches)) {
    throw new Error("Unexpected matches response format.");
  }

  return matches;
}

export async function getStandingsTable(): Promise<LeagueStanding[]> {
  const response = await fetch("/api/sports/standings", {
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? "Standings service is temporarily unavailable. Please try again shortly."
        : "Unable to load standings.";
    throw new Error(getErrorMessage(payload, fallback));
  }

  const typedPayload = payload as SportsApiResponse<StandingsDataResponse>;
  const standingsSections = typedPayload?.data?.standings;

  if (!Array.isArray(standingsSections)) {
    throw new Error("Unexpected standings response format.");
  }

  const totalSection = standingsSections.find((section) => section?.type === "TOTAL");
  const table = totalSection?.table ?? standingsSections[0]?.table;

  if (!Array.isArray(table)) {
    throw new Error("Unexpected standings table format.");
  }

  const normalized = table
    .map((row) => normalizeStandingRow(row))
    .filter((row): row is LeagueStanding => row !== null)
    .sort((a, b) => a.position - b.position);

  return normalized;
}
