import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getMatches, getStandings } from "../../../../lib/footballData.js";
import {
  getOrSetCache,
  getCachedFresh,
  setCached,
  CACHE_TTLS,
} from "../../../../lib/cache.js";
import { generateDigest, DEFAULT_DIGEST_MODEL } from "@/lib/ai-digest";

const DIGEST_TTL_MS = 24 * 60 * 60 * 1000;
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const DISCUSSION_LIMIT = 5;
const MATCH_LIMIT = 5;
const STANDINGS_LIMIT = 5;

function parseDateParam(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function defaultUpdatedAtForDate(date) {
  const candidate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(candidate.getTime())) {
    return new Date().toISOString();
  }
  return candidate.toISOString();
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const title = typeof section.title === "string" ? section.title.trim() : "";
      const content = typeof section.content === "string" ? section.content.trim() : "";

      if (!title || !content) {
        return null;
      }

      return { title, content };
    })
    .filter(Boolean);
}

function buildDiscussionSection(threads) {
  if (!threads.length) {
    return "No notable discussions in the last 24 hours.";
  }

  return threads
    .slice(0, 3)
    .map((thread) => `${thread.title} (${thread.replies} replies)`)
    .join(" • ");
}

function buildMatchSection(matches) {
  if (!matches.length) {
    return "No completed matches were recorded in the last 24 hours.";
  }

  return matches.slice(0, 3).join(" • ");
}

function buildStandingsSection(standings) {
  if (!standings.length) {
    return "No standings updates are available right now.";
  }

  return standings.slice(0, 3).join(" • ");
}

function buildPrompt({ date, discussionsText, matchesText, standingsText }) {
  const lines = [];
  lines.push(`Sports Daily Digest for ${date}.`);
  lines.push("Write a concise update in 3 short paragraphs for football fans.");
  lines.push(`Top discussions: ${discussionsText}`);
  lines.push(`Match highlights: ${matchesText}`);
  lines.push(`Standings snapshot: ${standingsText}`);
  lines.push("Do not invent facts that are not in these inputs.");

  return lines.join(" ");
}

function getWindowBounds(parsedDate) {
  const windowEnd = parsedDate
    ? new Date(`${parsedDate}T23:59:59.999Z`)
    : new Date();
  const windowStart = new Date(windowEnd.getTime() - DIGEST_WINDOW_MS);
  return { windowStart, windowEnd };
}

function normalizeDigestPayload(payload, date) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const summary =
    typeof safePayload.summary === "string" ? safePayload.summary.trim() : "";
  const sources =
    safePayload.sources && typeof safePayload.sources === "object"
      ? safePayload.sources
      : {
          threadsConsidered: 0,
          matchesConsidered: 0,
          standingsTeamsConsidered: 0,
        };

  let updatedAt =
    typeof safePayload.updatedAt === "string" ? safePayload.updatedAt : "";
  if (!updatedAt || Number.isNaN(new Date(updatedAt).getTime())) {
    updatedAt = defaultUpdatedAtForDate(date);
  }

  const sections = normalizeSections(safePayload.sections);

  return {
    date:
      typeof safePayload.date === "string" && safePayload.date.trim()
        ? safePayload.date
        : date,
    updatedAt,
    summary,
    sections,
    sources,
    model:
      typeof safePayload.model === "string" && safePayload.model.trim()
        ? safePayload.model
        : process.env.HF_DIGEST_MODEL?.trim() || DEFAULT_DIGEST_MODEL,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const parsedDate = parseDateParam(dateParam);

  if (dateParam && !parsedDate) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const date = parsedDate || new Date().toISOString().slice(0, 10);
  const cacheKey = `digest:daily:${date}`;
  const { windowStart, windowEnd } = getWindowBounds(parsedDate);

  try {
    const cached = await getCachedFresh(cacheKey);
    if (cached) {
      const normalizedCached = normalizeDigestPayload(cached, date);
      return NextResponse.json(
        { digest: { ...normalizedCached, cached: true } },
        { status: 200 }
      );
    }

    const threads = await prisma.thread.findMany({
      where: {
        isHidden: false,
        isDeleted: false,
        posts: {
          some: {
            isHidden: false,
            isDeleted: false,
            createdAt: { gte: windowStart, lte: windowEnd },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: {
            posts: {
              where: {
                isHidden: false,
                isDeleted: false,
                createdAt: { gte: windowStart, lte: windowEnd },
              },
            },
          },
        },
      },
    });

    const rankedThreads = [...threads]
      .sort((left, right) => {
        const byEngagement = right._count.posts - left._count.posts;
        if (byEngagement !== 0) {
          return byEngagement;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, DISCUSSION_LIMIT);

    const threadSummaries = rankedThreads.map((thread) => {
      const postCount = typeof thread._count.posts === "number" ? thread._count.posts : 0;
      const replies = Math.max(0, postCount - 1);

      return {
        title: thread.title,
        replies,
      };
    });

    let matches = [];
    try {
      const result = await getOrSetCache(
        "sports:pl:matches:status=FINISHED:matchday=any",
        CACHE_TTLS.matchesList,
        () => getMatches({ status: "FINISHED" })
      );
      const list = result?.data?.matches || [];
      matches = list
        .filter((match) => {
          if (!match?.utcDate) {
            return false;
          }
          const matchTime = new Date(match.utcDate).getTime();
          if (Number.isNaN(matchTime)) {
            return false;
          }
          return matchTime >= windowStart.getTime() && matchTime <= windowEnd.getTime();
        })
        .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
        .slice(0, MATCH_LIMIT)
        .map((match) => {
          const home = match.homeTeam?.name || "Home";
          const away = match.awayTeam?.name || "Away";
          const score = match.score?.fullTime;
          const scoreText =
            typeof score?.home === "number" && typeof score?.away === "number"
              ? `${score.home}-${score.away}`
              : "-";
          const dateText = match.utcDate ? match.utcDate.slice(0, 10) : "";
          return `${home} ${scoreText} ${away} (${dateText})`;
        });
    } catch {
      matches = [];
    }

    let standings = [];
    try {
      const result = await getOrSetCache(
        "sports:pl:standings",
        CACHE_TTLS.standings,
        () => getStandings()
      );
      const table =
        result?.data?.standings?.find((entry) => entry?.type === "TOTAL")
          ?.table ||
        result?.data?.standings?.[0]?.table ||
        [];
      standings = (table || [])
        .slice(0, STANDINGS_LIMIT)
        .map((row) => {
          const name = row?.team?.name || "Team";
          const points = row?.points ?? "-";
          const position = row?.position ?? "-";
          return `${position}. ${name} (${points} pts)`;
        });
    } catch {
      standings = [];
    }

    const sources = {
      threadsConsidered: threadSummaries.length,
      matchesConsidered: matches.length,
      standingsTeamsConsidered: standings.length,
    };

    const sections = [
      {
        title: "Top Discussions",
        content: buildDiscussionSection(threadSummaries),
      },
      {
        title: "Match Highlights",
        content: buildMatchSection(matches),
      },
      {
        title: "Standings",
        content: buildStandingsSection(standings),
      },
    ];
    const updatedAt = new Date().toISOString();

    if (
      sources.threadsConsidered === 0 &&
      sources.matchesConsidered === 0 &&
      sources.standingsTeamsConsidered === 0
    ) {
      const digest = {
        date,
        updatedAt,
        summary:
          "No major discussions, completed matches, or standings updates were available for this digest.",
        sections,
        sources,
        model: process.env.HF_DIGEST_MODEL?.trim() || DEFAULT_DIGEST_MODEL,
      };

      await setCached(cacheKey, digest, DIGEST_TTL_MS);

      return NextResponse.json(
        { digest: { ...digest, cached: false } },
        { status: 200 }
      );
    }

    const discussionsText = buildDiscussionSection(threadSummaries);
    const matchesText = buildMatchSection(matches);
    const standingsText = buildStandingsSection(standings);

    const prompt = buildPrompt({
      date,
      discussionsText,
      matchesText,
      standingsText,
    });

    let digestResult;
    try {
      digestResult = await generateDigest(prompt);
    } catch {
      return NextResponse.json(
        { error: "Digest service unavailable" },
        { status: 503 }
      );
    }

    const digest = {
      date,
      updatedAt,
      summary: digestResult.summary,
      sections,
      sources,
      model: digestResult.model,
    };

    await setCached(cacheKey, digest, DIGEST_TTL_MS);

    return NextResponse.json(
      { digest: { ...digest, cached: false } },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch digest" },
      { status: 500 }
    );
  }
}
