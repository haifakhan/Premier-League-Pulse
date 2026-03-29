import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import {
  normalizeSentimentValue,
  recalculateMatchThreadSentiment,
} from "@/lib/match-thread-sentiment";

const VALID_SENTIMENTS = new Set(["positive", "negative", "mixed", "neutral"]);

function parseMatchId(rawValue) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toScore(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}

function normalizeTeamSentiments(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const teamId =
      typeof item.teamId === "string" && item.teamId.trim().length > 0
        ? item.teamId.trim()
        : null;

    if (!teamId) {
      continue;
    }

    const teamName =
      typeof item.teamName === "string" && item.teamName.trim().length > 0
        ? item.teamName.trim()
        : `Team ${teamId}`;

    const sentiment = normalizeSentimentValue(item.sentiment);
    if (!VALID_SENTIMENTS.has(sentiment)) {
      continue;
    }

    normalized.push({
      teamId,
      teamName,
      sentiment,
      score: toScore(item.score),
    });
  }

  return normalized;
}

async function getVisibleReplyCount(threadId) {
  return prisma.post.count({
    where: {
      threadId,
      kind: "REPLY",
      isDeleted: false,
      isHidden: false,
    },
  });
}

function buildPayload({
  overall = "neutral",
  teamSentiments = [],
  commentCount = 0,
  generatedAt = null,
}) {
  return {
    overall: normalizeSentimentValue(overall),
    teamSentiments: normalizeTeamSentiments(teamSentiments),
    commentCount: typeof commentCount === "number" && commentCount >= 0 ? commentCount : 0,
    generatedAt,
  };
}

export async function GET(_request, context) {
  const params = await context.params;
  const matchId = parseMatchId(params?.id);

  if (!matchId) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  try {
    const thread = await prisma.thread.findUnique({
      where: { matchId: String(matchId) },
      select: {
        id: true,
        isHidden: true,
        isDeleted: true,
        overallSentiment: true,
        teamSentiments: true,
        sentimentGeneratedAt: true,
        sentimentCommentCount: true,
      },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json(buildPayload({}), { status: 200 });
    }

    if (!thread.sentimentGeneratedAt) {
      const currentCommentCount = await getVisibleReplyCount(thread.id);
      if (currentCommentCount > 0) {
        recalculateMatchThreadSentiment(thread.id).catch(() => {});
      }
      return NextResponse.json(
        buildPayload({
          overall: "neutral",
          teamSentiments: [],
          commentCount: currentCommentCount,
          generatedAt: null,
        }),
        { status: 200 }
      );
    }

    const currentCommentCount = await getVisibleReplyCount(thread.id);
    const commentCount =
      typeof thread.sentimentCommentCount === "number"
        ? thread.sentimentCommentCount
        : currentCommentCount;

    if (currentCommentCount > commentCount) {
      recalculateMatchThreadSentiment(thread.id).catch(() => {});
    }

    return NextResponse.json(
      buildPayload({
        overall: thread.overallSentiment,
        teamSentiments: thread.teamSentiments,
        commentCount,
        generatedAt: thread.sentimentGeneratedAt.toISOString(),
      }),
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch match sentiment" }, { status: 500 });
  }
}
