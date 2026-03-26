import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getOrSetCache, CACHE_TTLS } from "@/lib/cache";
import { getMatches } from "@/lib/footballData";

const FINISHED_MATCHES_CACHE_KEY = "sports:pl:matches:status=FINISHED:matchday=any";

function compareByCreatedAtDesc(a, b) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (bTime !== aTime) return bTime - aTime;

  const aKey = `${a.type}:${a.threadId || a.postId || a.matchId || ""}`;
  const bKey = `${b.type}:${b.threadId || b.postId || b.matchId || ""}`;
  return aKey.localeCompare(bKey);
}

async function buildFavoriteTeamMatchUpdateEvents(favoriteTeamId) {
  if (!favoriteTeamId) return [];

  try {
    const result = await getOrSetCache(
      FINISHED_MATCHES_CACHE_KEY,
      CACHE_TTLS.matchesList,
      () => getMatches({ status: "FINISHED" })
    );
    const matches = Array.isArray(result?.data?.matches) ? result.data.matches : [];
    const filtered = matches.filter((match) => {
      const homeId = match?.homeTeam?.id;
      const awayId = match?.awayTeam?.id;
      return (
        String(homeId) === String(favoriteTeamId) ||
        String(awayId) === String(favoriteTeamId)
      );
    });

    return filtered
      .filter(
        (match) =>
          match?.id != null &&
          match?.utcDate &&
          match?.homeTeam?.name &&
          match?.awayTeam?.name
      )
      .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
      .map((match) => ({
        type: "FAVORITE_TEAM_MATCH_UPDATE",
        matchId: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        score: {
          home: match?.score?.fullTime?.home ?? null,
          away: match?.score?.fullTime?.away ?? null,
        },
        utcDate: match.utcDate,
        createdAt: match.utcDate,
      }));
  } catch {
    return [];
  }
}

export async function GET(request) {
  try {
    const payload = requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, favoriteTeamId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [follows, repliesToMyPosts, favoriteTeamThreads] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      }),
      prisma.post.findMany({
        where: {
          parentPostId: { not: null },
          isHidden: false,
          isDeleted: false,
          authorId: { not: user.id },
          parentPost: {
            authorId: user.id,
            isHidden: false,
            isDeleted: false,
            thread: {
              isHidden: false,
              isDeleted: false,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          parentPostId: true,
          createdAt: true,
          author: { select: { username: true } },
        },
      }),
      user.favoriteTeamId
        ? prisma.thread.findMany({
            where: {
              forumType: "TEAM",
              teamId: user.favoriteTeamId,
              authorId: { not: user.id },
              isHidden: false,
              isDeleted: false,
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              createdAt: true,
              matchId: true,
              author: { select: { username: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const followedUserIds = follows.map((f) => f.followingId);

    const followedUserThreads = followedUserIds.length
      ? await prisma.thread.findMany({
          where: {
            authorId: { in: followedUserIds, not: user.id },
            isHidden: false,
            isDeleted: false,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            createdAt: true,
            author: { select: { username: true } },
            posts: {
              where: {
                kind: "ROOT",
                isHidden: false,
                isDeleted: false,
              },
              select: { content: true },
              take: 1,
            },
          },
        })
      : [];

    const followedThreadEvents = followedUserThreads
      .map((thread) => {
        const rootPost = thread.posts[0];
        if (!rootPost) return null;

        return {
          type: "FOLLOWED_USER_NEW_THREAD",
          threadId: thread.id,
          threadTitle: thread.title,
          rootPostContent: rootPost.content,
          authorUsername: thread.author.username,
          createdAt: thread.createdAt,
        };
      })
      .filter(Boolean);

    const repliesByOriginalPost = {};

    for (const reply of repliesToMyPosts) {
      const postId = reply.parentPostId;
      if (!postId) continue;

      if (!repliesByOriginalPost[postId]) {
        repliesByOriginalPost[postId] = {
          type: "REPLIES_TO_MY_POST",
          postId,
          replyCount: 1,
          latestReplier: reply.author.username,
          createdAt: reply.createdAt,
        };
      } else {
        repliesByOriginalPost[postId].replyCount += 1;
      }
    }

    const groupedReplyEvents = Object.values(repliesByOriginalPost);

    const favoriteTeamThreadEvents = favoriteTeamThreads.map((thread) => ({
      type: "FAVORITE_TEAM_NEW_THREAD",
      threadId: thread.id,
      title: thread.title,
      authorUsername: thread.author.username,
      createdAt: thread.createdAt,
      matchId: thread.matchId,
    }));

    const favoriteTeamMatchUpdateEvents =
      await buildFavoriteTeamMatchUpdateEvents(user.favoriteTeamId);

    const feed = [
      ...followedThreadEvents,
      ...groupedReplyEvents,
      ...favoriteTeamThreadEvents,
      ...favoriteTeamMatchUpdateEvents,
    ].sort(compareByCreatedAtDesc);

    return NextResponse.json({ feed }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to fetch feed";
    const status = message.includes("Authorization") || message.includes("token")
      ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
