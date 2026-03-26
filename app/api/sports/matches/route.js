import { getMatches } from "../../../../lib/footballData.js";
import { getOrSetCache, CACHE_TTLS } from "../../../../lib/cache.js";

const VALID_MATCHDAY_MIN = 1;
const VALID_MATCHDAY_MAX = 38;

function parseMatchday(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function normalizeStatus(status) {
  if (!status) return "UPCOMING";
  return String(status).toUpperCase();
}

function buildCacheKey(status, matchday) {
  const dayPart = matchday != null ? `matchday=${matchday}` : "matchday=any";
  return `sports:pl:matches:status=${status}:${dayPart}`;
}

function dedupeMatches(matches) {
  const seen = new Set();
  const result = [];
  for (const match of matches || []) {
    if (!match || match.id == null) continue;
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    result.push(match);
  }
  return result;
}

function mergeUpcomingResponses(primary, secondary) {
  const mergedMatches = dedupeMatches([
    ...(primary?.matches || []),
    ...(secondary?.matches || []),
  ]).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  const base = primary ?? {};
  return {
    ...base,
    matches: mergedMatches,
    resultSet: {
      ...(base.resultSet || {}),
      count: mergedMatches.length,
    },
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));
  const matchdayRaw = searchParams.get("matchday");
  const matchday = parseMatchday(matchdayRaw);

  if (matchdayRaw !== null) {
    if (
      matchday === null ||
      matchday < VALID_MATCHDAY_MIN ||
      matchday > VALID_MATCHDAY_MAX
    ) {
      return Response.json(
        {
          cache: "MISS",
          data: null,
          error: { message: "Invalid matchday (1-38)" },
        },
        { status: 400 }
      );
    }
  }

  const cacheKey = buildCacheKey(status, matchday);

  try {
    const result = await getOrSetCache(
      cacheKey,
      CACHE_TTLS.matchesList,
      async () => {
        if (status === "UPCOMING") {
          const [scheduled, timed] = await Promise.all([
            getMatches({ status: "SCHEDULED", matchday }),
            getMatches({ status: "TIMED", matchday }),
          ]);
          return mergeUpcomingResponses(scheduled, timed);
        }

        const mappedStatus = status === "RECENT" ? "FINISHED" : status;
        return getMatches({ status: mappedStatus, matchday });
      }
    );
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        cache: "MISS",
        data: null,
        error: { message: "Upstream error", details: err?.message },
      },
      { status: 502 }
    );
  }
}
