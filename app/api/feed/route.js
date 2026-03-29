import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getOrSetCache, CACHE_TTLS } from "@/lib/cache";
import { getMatches } from "@/lib/footballData";

const FINISHED_MATCHES_CACHE_KEY = "sports:pl:matches:status=FINISHED:matchday=any";
const SCHEDULED_MATCHES_CACHE_KEY = "sports:pl:matches:status=SCHEDULED:matchday=any";
const TIMED_MATCHES_CACHE_KEY = "sports:pl:matches:status=TIMED:matchday=any";
const RECENT_MATCH_UPDATE_WINDOW_DAYS = 14;
const MAX_FEED_ITEMS = 40;

function dedupeMatches(matches) {
  const seen = new Set();
  const result = [];

  for (const match of matches || []) {
    if (!match?.id || seen.has(match.id)) continue;
    seen.add(match.id);
    result.push(match);
  }

  return result;
}

function compareByCreatedAtDesc(a, b) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (bTime !== aTime) return bTime - aTime;

  const aKey = `${a.type}:${a.threadId || a.postId || a.matchId || ""}`;
  const bKey = `${b.type}:${b.threadId || b.postId || b.matchId || ""}`;
  return aKey.localeCompare(bKey);
}

function isWithinRecentWindow(value, days) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;

  const windowStart = Date.now() - days * 24 * 60 * 60 * 1000;
  return timestamp >= windowStart;
}

function summarizeActors(actors) {
  return [...actors.values()]
    .sort((left, right) => left.username.localeCompare(right.username))
    .slice(0, 3);
}

async function buildFavoriteTeamMatchContext(favoriteTeamId) {
  if (!favoriteTeamId) {
    return {
      favoriteTeamMatchIds: new Set(),
      favoriteTeamMatchUpdateEvents: [],
    };
  }

  try {
    const [finishedResult, scheduledResult, timedResult] = await Promise.all([
      getOrSetCache(FINISHED_MATCHES_CACHE_KEY, CACHE_TTLS.matchesList, () =>
        getMatches({ status: "FINISHED" })
      ),
      getOrSetCache(SCHEDULED_MATCHES_CACHE_KEY, CACHE_TTLS.matchesList, () =>
        getMatches({ status: "SCHEDULED" })
      ),
      getOrSetCache(TIMED_MATCHES_CACHE_KEY, CACHE_TTLS.matchesList, () =>
        getMatches({ status: "TIMED" })
      ),
    ]);

    const finishedMatches = Array.isArray(finishedResult?.data?.matches)
      ? finishedResult.data.matches
      : [];
    const scheduledMatches = Array.isArray(scheduledResult?.data?.matches)
      ? scheduledResult.data.matches
      : [];
    const timedMatches = Array.isArray(timedResult?.data?.matches)
      ? timedResult.data.matches
      : [];

    const allMatches = dedupeMatches([
      ...finishedMatches,
      ...scheduledMatches,
      ...timedMatches,
    ]);
    const favoriteTeamMatches = allMatches.filter((match) => {
      const homeId = match?.homeTeam?.id;
      const awayId = match?.awayTeam?.id;
      return (
        String(homeId) === String(favoriteTeamId) ||
        String(awayId) === String(favoriteTeamId)
      );
    });
    const favoriteTeamMatchIds = new Set(
      favoriteTeamMatches
        .map((match) => (match?.id != null ? String(match.id) : null))
        .filter(Boolean)
    );
    const favoriteTeamMatchUpdateEvents = finishedMatches
      .filter((match) => {
        const homeId = match?.homeTeam?.id;
        const awayId = match?.awayTeam?.id;
        return (
          (String(homeId) === String(favoriteTeamId) ||
            String(awayId) === String(favoriteTeamId)) &&
          isWithinRecentWindow(match?.utcDate, RECENT_MATCH_UPDATE_WINDOW_DAYS)
        );
      })
      .filter(
        (match) =>
          match?.id != null &&
          match?.utcDate &&
          match?.homeTeam?.name &&
          match?.awayTeam?.name
      )
      .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
      .map((match) => ({
        type: "FAVORITE_TEAM_MATCH_RESULT",
        matchId: String(match.id),
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        score: {
          home: match?.score?.fullTime?.home ?? null,
          away: match?.score?.fullTime?.away ?? null,
        },
        createdAt: match.utcDate,
      }));

    return {
      favoriteTeamMatchIds,
      favoriteTeamMatchUpdateEvents,
    };
  } catch {
    return {
      favoriteTeamMatchIds: new Set(),
      favoriteTeamMatchUpdateEvents: [],
    };
  }
}

export async function GET(request) {
  try {
    const payload = requireAuth(request);

    const [user, follows, repliesToMyPosts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, favoriteTeamId: true },
      }),
      prisma.follow.findMany({
        where: { followerId: payload.id },
        select: { followingId: true },
      }),
      prisma.post.findMany({
        where: {
          parentPostId: { not: null },
          isHidden: false,
          isDeleted: false,
          authorId: { not: payload.id },
          parentPost: {
            authorId: payload.id,
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
          id: true,
          parentPostId: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          parentPost: {
            select: {
              threadId: true,
              thread: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const favoriteTeamMatchContext = await buildFavoriteTeamMatchContext(
      user.favoriteTeamId
    );

    const followedUserIds = follows.map((f) => f.followingId);
    const favoriteTeamMatchIds = favoriteTeamMatchContext.favoriteTeamMatchIds;
    const shouldLoadFollowedReplies = followedUserIds.length > 0;
    const threadOrClauses = [];

    if (followedUserIds.length > 0) {
      threadOrClauses.push({ authorId: { in: followedUserIds } });
    }

    if (user.favoriteTeamId) {
      threadOrClauses.push({
        forumType: "TEAM",
        teamId: user.favoriteTeamId,
      });
    }

    if (favoriteTeamMatchIds.size > 0) {
      threadOrClauses.push({
        matchId: { in: [...favoriteTeamMatchIds] },
      });
    }

    const [followedUserReplies, relevantThreads] = await Promise.all([
      shouldLoadFollowedReplies
        ? prisma.post.findMany({
            where: {
              authorId: { in: followedUserIds, not: user.id },
              kind: "REPLY",
              isHidden: false,
              isDeleted: false,
              thread: {
                isHidden: false,
                isDeleted: false,
              },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              thread: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      threadOrClauses.length
        ? prisma.thread.findMany({
            where: {
              isHidden: false,
              isDeleted: false,
              authorId: { not: user.id },
              OR: threadOrClauses,
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              forumType: true,
              teamId: true,
              matchId: true,
              createdAt: true,
              authorId: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
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
        : Promise.resolve([]),
    ]);

    const repliesByOriginalPost = {};

    for (const reply of repliesToMyPosts) {
      const postId = reply.parentPostId;
      if (!postId) continue;

      if (!repliesByOriginalPost[postId]) {
        repliesByOriginalPost[postId] = {
          type: "REPLIES_TO_MY_POST",
          postId,
          threadId: reply.parentPost?.threadId ?? null,
          threadTitle: reply.parentPost?.thread?.title ?? null,
          latestReplyId: reply.id,
          replyCount: 0,
          actors: new Map(),
          latestActor: reply.author,
          createdAt: reply.createdAt,
        };
      }

      repliesByOriginalPost[postId].replyCount += 1;
      repliesByOriginalPost[postId].latestReplyId = reply.id;
      repliesByOriginalPost[postId].latestActor = reply.author;
      repliesByOriginalPost[postId].createdAt = reply.createdAt;
      repliesByOriginalPost[postId].actors.set(reply.author.id, reply.author);
    }

    const groupedReplyEvents = Object.values(repliesByOriginalPost).map((event) => ({
      ...event,
      actors: summarizeActors(event.actors),
    }));

    const followedRepliesByThread = {};

    for (const reply of followedUserReplies) {
      const threadId = reply.thread?.id;
      if (!threadId) continue;

      if (!followedRepliesByThread[threadId]) {
        followedRepliesByThread[threadId] = {
          type: "FOLLOWED_USERS_REPLIED",
          threadId,
          threadTitle: reply.thread.title,
          latestReplyId: reply.id,
          replyCount: 0,
          actors: new Map(),
          latestActor: reply.author,
          createdAt: reply.createdAt,
        };
      }

      followedRepliesByThread[threadId].replyCount += 1;
      followedRepliesByThread[threadId].latestReplyId = reply.id;
      followedRepliesByThread[threadId].latestActor = reply.author;
      followedRepliesByThread[threadId].createdAt = reply.createdAt;
      followedRepliesByThread[threadId].actors.set(reply.author.id, reply.author);
    }

    const followedReplyEvents = Object.values(followedRepliesByThread).map((event) => ({
      ...event,
      actors: summarizeActors(event.actors),
    }));

    const mergedThreadEvents = new Map();

    for (const thread of relevantThreads) {
      const rootPost = thread.posts[0];
      const reasonSet = new Set();

      if (followedUserIds.includes(thread.authorId)) {
        reasonSet.add("FOLLOWED_USER");
      }

      if (user.favoriteTeamId && thread.forumType === "TEAM" && thread.teamId === user.favoriteTeamId) {
        reasonSet.add("FAVORITE_TEAM_FORUM");
      }

      if (thread.matchId && favoriteTeamMatchIds.has(String(thread.matchId))) {
        reasonSet.add("FAVORITE_TEAM_MATCH_THREAD");
      }

      if (reasonSet.size === 0) continue;

      mergedThreadEvents.set(thread.id, {
        type: "THREAD_CREATED",
        threadId: thread.id,
        threadTitle: thread.title,
        createdAt: thread.createdAt,
        matchId: thread.matchId,
        forumType: thread.forumType,
        teamId: thread.teamId,
        preview: rootPost?.content ?? null,
        author: thread.author,
        reasons: [...reasonSet],
      });
    }

    const feed = [
      ...mergedThreadEvents.values(),
      ...groupedReplyEvents,
      ...followedReplyEvents,
      ...favoriteTeamMatchContext.favoriteTeamMatchUpdateEvents,
    ]
      .sort(compareByCreatedAtDesc)
      .slice(0, MAX_FEED_ITEMS);

    return NextResponse.json({ feed }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to fetch feed";
    const status = message.includes("Authorization") || message.includes("token")
      ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
