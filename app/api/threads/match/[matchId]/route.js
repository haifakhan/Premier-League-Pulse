import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { getMatch } from "@/lib/footballData";
import { CACHE_TTLS, getOrSetCache } from "@/lib/cache";
import {
  ensureMatchThreadLifecycle,
  findSystemAuthorId,
  getMatchThreadAvailability,
} from "@/lib/matchThreads";

function parseMatchId(rawValue) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request, context) {
  const params = await context.params;
  const matchId = parseMatchId(params?.matchId);

  if (!matchId) {
    return NextResponse.json(
      {
        error: "Invalid match id",
      },
      { status: 400 }
    );
  }

  let match;
  try {
    const cacheResult = await getOrSetCache(`sports:pl:match:${matchId}`, CACHE_TTLS.matchDetail, () =>
      getMatch(matchId)
    );
    match = cacheResult.data;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load match details",
        details: error?.message || "Upstream error",
      },
      { status: 502 }
    );
  }

  if (!match || !match.id || !match.utcDate) {
    return NextResponse.json(
      {
        error: "Match not found",
      },
      { status: 404 }
    );
  }

  const initialAvailability = getMatchThreadAvailability(match);
  const needsAuthor = initialAvailability.state === "OPEN_WINDOW";
  const authorId = needsAuthor ? await findSystemAuthorId(prisma) : null;

  if (needsAuthor && !authorId) {
    return NextResponse.json(
      {
        error: "Unable to create match discussion thread",
        details: "No system author account is available.",
      },
      { status: 500 }
    );
  }

  const lifecycle = await ensureMatchThreadLifecycle({
    prismaClient: prisma,
    match,
    authorId,
  });

  if (lifecycle.action === "skipped" && lifecycle.reason === "missing-author") {
    return NextResponse.json(
      {
        error: "Unable to create match discussion thread",
        details: "No system author account is available.",
      },
      { status: 500 }
    );
  }

  const availability = lifecycle.availability;
  const thread = lifecycle.thread;

  return NextResponse.json(
    {
      matchId: String(match.id),
      availability: availability.state,
      window: {
        opensAt: availability.windowStart?.toISOString() ?? null,
        closesAt: availability.windowEnd?.toISOString() ?? null,
        matchStart: availability.matchStart?.toISOString() ?? null,
        matchEnd: availability.matchEnd?.toISOString() ?? null,
      },
      thread: thread
        ? {
            id: thread.id,
            status: thread.status,
            url: `/forums/${thread.id}`,
          }
        : null,
      canPost: Boolean(thread && thread.status === "OPEN" && availability.state === "OPEN_WINDOW"),
      syncedAction: lifecycle.action,
    },
    { status: 200 }
  );
}
