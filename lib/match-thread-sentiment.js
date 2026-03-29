import prisma from "@/lib/prisma";
import { getMatch } from "@/lib/footballData";
import { CACHE_TTLS, getOrSetCache } from "@/lib/cache";
import { analyzeSentimentDetailed } from "@/lib/ai-sentiment";

const VALID_SENTIMENTS = new Set(["positive", "negative", "mixed", "neutral"]);
const MIN_TEAM_COMMENTS = 3;
// Deterministic mixed rule: low-confidence aggregate sentiment is treated as mixed.
const MIN_CONFIDENCE_FOR_NON_MIXED = 0.6;
const MAX_AGGREGATED_TEXT_LENGTH = 8000;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeSentimentValue(value) {
  if (!isNonEmptyString(value)) return "neutral";
  const normalized = value.trim().toLowerCase();
  return VALID_SENTIMENTS.has(normalized) ? normalized : "neutral";
}

function toRoundedScore(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}

function toAggregatedInput(texts) {
  let remaining = MAX_AGGREGATED_TEXT_LENGTH;
  const parts = [];

  for (const rawText of texts) {
    if (!isNonEmptyString(rawText)) {
      continue;
    }

    const text = rawText.trim();
    if (text.length === 0 || remaining <= 0) {
      continue;
    }

    const fragment = text.length > remaining ? text.slice(0, remaining) : text;
    parts.push(fragment);

    remaining -= fragment.length;
    if (remaining > 0) {
      parts.push("\n");
      remaining -= 1;
    }
  }

  return parts.join("").trim();
}

async function classifyAggregate(texts) {
  const aggregatedInput = toAggregatedInput(texts);
  if (!aggregatedInput) {
    return { sentiment: "neutral", score: 0 };
  }

  const result = await analyzeSentimentDetailed(aggregatedInput);
  if (!result?.label) {
    throw new Error("Sentiment service unavailable");
  }

  const score = toRoundedScore(result.score);
  const label = normalizeSentimentValue(result.label);

  if (score < MIN_CONFIDENCE_FOR_NON_MIXED) {
    return { sentiment: "mixed", score };
  }

  return { sentiment: label, score };
}

function parseMatchId(rawValue) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getMatchTeams(matchIdRaw) {
  const matchId = parseMatchId(matchIdRaw);
  if (!matchId) {
    return [];
  }

  try {
    const result = await getOrSetCache(
      `sports:pl:match:${matchId}`,
      CACHE_TTLS.matchDetail,
      () => getMatch(matchId)
    );

    const match = result?.data;
    const teams = [];

    const homeId = match?.homeTeam?.id;
    const homeName = match?.homeTeam?.name;
    if (Number.isInteger(homeId) && isNonEmptyString(homeName)) {
      teams.push({ id: String(homeId), name: homeName.trim() });
    }

    const awayId = match?.awayTeam?.id;
    const awayName = match?.awayTeam?.name;
    if (Number.isInteger(awayId) && isNonEmptyString(awayName)) {
      teams.push({ id: String(awayId), name: awayName.trim() });
    }

    return teams;
  } catch {
    return [];
  }
}

export async function recalculateMatchThreadSentiment(threadId) {
  if (!isNonEmptyString(threadId)) {
    return { status: "skipped", reason: "invalid-thread-id" };
  }

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      matchId: true,
      sentimentCommentCount: true,
    },
  });

  if (!thread?.id || !thread.matchId) {
    return { status: "skipped", reason: "not-a-match-thread" };
  }

  const visibleReplyWhere = {
    threadId: thread.id,
    kind: "REPLY",
    isHidden: false,
    isDeleted: false,
  };

  const commentCount = await prisma.post.count({ where: visibleReplyWhere });

  if (thread.sentimentCommentCount === commentCount) {
    return { status: "skipped", reason: "comment-count-unchanged", commentCount };
  }

  if (commentCount === 0) {
    await prisma.thread.update({
      where: { id: thread.id },
      data: {
        overallSentiment: null,
        teamSentiments: null,
        sentimentGeneratedAt: null,
        sentimentCommentCount: 0,
      },
    });

    return { status: "updated", reason: "no-comments", commentCount: 0 };
  }

  const comments = await prisma.post.findMany({
    where: visibleReplyWhere,
    select: {
      content: true,
      author: {
        select: {
          favoriteTeamId: true,
        },
      },
    },
  });

  const allCommentTexts = comments
    .map((entry) => (isNonEmptyString(entry.content) ? entry.content.trim() : ""))
    .filter(Boolean);

  if (allCommentTexts.length === 0) {
    await prisma.thread.update({
      where: { id: thread.id },
      data: {
        overallSentiment: null,
        teamSentiments: null,
        sentimentGeneratedAt: null,
        sentimentCommentCount: commentCount,
      },
    });

    return { status: "updated", reason: "no-usable-comment-text", commentCount };
  }

  const overall = await classifyAggregate(allCommentTexts);

  const matchTeams = await getMatchTeams(thread.matchId);
  const allowedTeamIds = new Set(matchTeams.map((team) => team.id));
  const teamNamesById = new Map(matchTeams.map((team) => [team.id, team.name]));

  const commentsByTeamId = new Map();

  for (const entry of comments) {
    const teamId = entry.author?.favoriteTeamId;
    if (!isNonEmptyString(teamId) || !allowedTeamIds.has(teamId)) {
      continue;
    }

    const text = isNonEmptyString(entry.content) ? entry.content.trim() : "";
    if (!text) {
      continue;
    }

    const existing = commentsByTeamId.get(teamId) ?? [];
    existing.push(text);
    commentsByTeamId.set(teamId, existing);
  }

  const calculatedTeamSentiments = [];

  for (const team of matchTeams) {
    const teamTexts = commentsByTeamId.get(team.id) ?? [];
    if (teamTexts.length < MIN_TEAM_COMMENTS) {
      continue;
    }

    try {
      const classified = await classifyAggregate(teamTexts);
      calculatedTeamSentiments.push({
        teamId: team.id,
        teamName: teamNamesById.get(team.id) ?? `Team ${team.id}`,
        sentiment: classified.sentiment,
        score: classified.score,
      });
    } catch {
      // Skip team-specific sentiment if an AI call fails for that team.
    }
  }

  await prisma.thread.update({
    where: { id: thread.id },
    data: {
      overallSentiment: overall.sentiment,
      teamSentiments: calculatedTeamSentiments,
      sentimentGeneratedAt: new Date(),
      sentimentCommentCount: commentCount,
    },
  });

  return {
    status: "updated",
    commentCount,
    overall: overall.sentiment,
    teamSentiments: calculatedTeamSentiments,
  };
}
