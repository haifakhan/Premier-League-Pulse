import { NextResponse } from "next/server";
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

function excerptText(text, maxLength = 140) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function buildPrompt({ date, threads, matches, standings }) {
  const lines = [];
  lines.push(`Sports Daily Digest for ${date}.`);
  
  lines.push("Top discussions today include: " + 
    (threads.length ? threads.map(t => `"${t.title}" with ${t.replies} replies`).join(", ") : "no notable discussions") + ".");

  lines.push("Recent match results: " + 
    (matches.length ? matches.join(", ") : "no completed matches") + ".");

  lines.push("Current standings: " + 
    (standings.length ? standings.join(", ") : "no standings available") + ".");

  return lines.join(" ");
}

// function buildPrompt({ date, threads, matches, standings }) {
//   const lines = [];
//   lines.push(`Date: ${date}`);
//   lines.push("Write a short daily sports digest using only the data below.");
//   lines.push("Keep it under 180 words in 1-3 short paragraphs.");
//   lines.push("Do not add details that are not present.");
//   lines.push("");

//   lines.push("Top discussions:");
//   if (!threads.length) {
//     lines.push("- No notable discussions available.");
//   } else {
//     threads.forEach((thread, index) => {
//       const replies =
//         typeof thread.replies === "number" ? ` (replies: ${thread.replies})` : "";
//       const excerpt = thread.excerpt ? ` - ${thread.excerpt}` : "";
//       lines.push(`${index + 1}. ${thread.title}${excerpt}${replies}`);
//     });
//   }

//   lines.push("");
//   lines.push("Recent completed matches:");
//   if (!matches.length) {
//     lines.push("- No completed matches available.");
//   } else {
//     matches.forEach((match, index) => {
//       lines.push(`${index + 1}. ${match}`);
//     });
//   }

//   lines.push("");
//   lines.push("Standings (top teams):");
//   if (!standings.length) {
//     lines.push("- No standings available.");
//   } else {
//     standings.forEach((entry, index) => {
//       lines.push(`${index + 1}. ${entry}`);
//     });
//   }

//   return lines.join("\n");
// }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const parsedDate = parseDateParam(dateParam);

  if (dateParam && !parsedDate) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const date = parsedDate || new Date().toISOString().slice(0, 10);
  const cacheKey = `digest:daily:${date}`;

  try {
    const cached = await getCachedFresh(cacheKey);
    if (cached) {
      return NextResponse.json(
        { digest: { ...cached, cached: true } },
        { status: 200 }
      );
    }

    const threads = await prisma.thread.findMany({
      where: { isHidden: false, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: {
          select: {
            posts: { where: { isHidden: false, isDeleted: false } },
          },
        },
      },
    });

    const threadIds = threads.map((thread) => thread.id);
    const rootPosts = threadIds.length
      ? await prisma.post.findMany({
          where: {
            threadId: { in: threadIds },
            kind: "ROOT",
            isHidden: false,
            isDeleted: false,
          },
          select: { threadId: true, content: true },
        })
      : [];

    const rootMap = new Map(
      rootPosts.map((post) => [post.threadId, post.content])
    );

    const threadSummaries = threads.map((thread) => ({
      title: thread.title,
      excerpt: excerptText(rootMap.get(thread.id) || ""),
      replies: thread._count.posts,
    }));

    let matches = [];
    try {
      const result = await getOrSetCache(
        "sports:pl:matches:status=FINISHED:matchday=any",
        CACHE_TTLS.matchesList,
        () => getMatches({ status: "FINISHED" })
      );
      const list = result?.data?.matches || [];
      matches = list
        .filter((match) => match?.utcDate)
        .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
        .slice(0, 5)
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
        .slice(0, 5)
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

    if (
      sources.threadsConsidered === 0 &&
      sources.matchesConsidered === 0 &&
      sources.standingsTeamsConsidered === 0
    ) {
      const digest = {
        date,
        summary:
          "No major discussions, completed matches, or standings updates were available for this digest.",
        sources,
        model: process.env.HF_DIGEST_MODEL?.trim() || DEFAULT_DIGEST_MODEL,
      };

      await setCached(cacheKey, digest, DIGEST_TTL_MS);

      return NextResponse.json(
        { digest: { ...digest, cached: false } },
        { status: 200 }
      );
    }

    const prompt = buildPrompt({
  date,
  threads: threadSummaries,
  matches,
  standings,
});

// console.log("DIGEST THREADS:", threadSummaries);
// console.log("DIGEST MATCHES:", matches);
// console.log("DIGEST STANDINGS:", standings);
// console.log("DIGEST PROMPT:", prompt);

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
      summary: digestResult.summary,
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
