import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getCachedFresh, setCached } from "../../../../../lib/cache.js";
import { analyzeSentiment, SENTIMENT_MODEL } from "@/lib/ai-sentiment";

const SENTIMENT_TTL_MS = 24 * 60 * 60 * 1000;
const POST_ANALYSIS_CAP = 100;

function buildEmptySentiment(threadId, cached = false) {
  return {
    sentiment: {
      threadId,
      overall: {
        label: "neutral",
        counts: { positive: 0, neutral: 0, negative: 0 },
      },
      teamSentiment: { home: null, away: null },
      analyzedPosts: 0,
      model: SENTIMENT_MODEL,
      cached,
    },
  };
}

export async function GET(request, context) {
  const params = await context.params;

  try {
    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: { id: true, isHidden: true, isDeleted: true },
    });

    if (!thread || thread.isHidden || thread.isDeleted) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const where = { threadId: thread.id, isHidden: false, isDeleted: false };

    const [visibleCount, latestPost] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findFirst({
        where,
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    const latestStamp = latestPost?.updatedAt
      ? latestPost.updatedAt.toISOString()
      : "none";
    const cacheKey = `sentiment:thread:${thread.id}:${visibleCount}:${latestStamp}`;

    const cached = await getCachedFresh(cacheKey);
    if (cached) {
      return NextResponse.json(
        { sentiment: { ...cached, cached: true } },
        { status: 200 }
      );
    }

    if (visibleCount === 0) {
      const empty = buildEmptySentiment(thread.id, false);
      await setCached(cacheKey, empty.sentiment, SENTIMENT_TTL_MS);
      return NextResponse.json(empty, { status: 200 });
    }

    const take = visibleCount > POST_ANALYSIS_CAP ? POST_ANALYSIS_CAP : undefined;

    const posts = await prisma.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, content: true },
    });

    // Safeguard: cap analysis for unusually large threads to protect quota.

    let analyzedPosts = 0;
    let failedPosts = 0;
    const counts = { positive: 0, neutral: 0, negative: 0 };

    for (const post of posts) {
      try {
        const label = await analyzeSentiment(post.content);
        if (!label) {
          failedPosts += 1;
          continue;
        }
        counts[label] += 1;
        analyzedPosts += 1;
      } catch {
        failedPosts += 1;
      }
    }

    if (analyzedPosts === 0 && failedPosts > 0) {
      return NextResponse.json(
        { error: "Sentiment service unavailable" },
        { status: 503 }
      );
    }

    let overallLabel = "mixed";
    if (counts.positive > counts.neutral && counts.positive > counts.negative) {
      overallLabel = "positive";
    } else if (
      counts.neutral > counts.positive &&
      counts.neutral > counts.negative
    ) {
      overallLabel = "neutral";
    } else if (
      counts.negative > counts.positive &&
      counts.negative > counts.neutral
    ) {
      overallLabel = "negative";
    }

    const sentiment = {
      threadId: thread.id,
      overall: {
        label: overallLabel,
        counts,
      },
      teamSentiment: { home: null, away: null },
      analyzedPosts,
      model: SENTIMENT_MODEL,
    };

    await setCached(cacheKey, sentiment, SENTIMENT_TTL_MS);

    return NextResponse.json(
      { sentiment: { ...sentiment, cached: false } },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch sentiment" },
      { status: 500 }
    );
  }
}
