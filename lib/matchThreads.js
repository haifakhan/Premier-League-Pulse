export const WINDOW_DAYS_BEFORE = 14;
export const WINDOW_DAYS_AFTER = 14;
export const MATCH_DURATION_HOURS = 3;

function toDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function dedupeMatches(matches) {
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

export function buildMatchThreadTitle(match) {
  const home = match?.homeTeam?.name || "Home";
  const away = match?.awayTeam?.name || "Away";
  const matchday = match?.matchday;
  return matchday ? `${home} vs ${away} — Matchday ${matchday}` : `${home} vs ${away}`;
}

export function buildMatchThreadRootContent(match) {
  const home = match?.homeTeam?.name || "Home";
  const away = match?.awayTeam?.name || "Away";
  return `Auto-generated match thread for ${home} vs ${away}. Discuss below!`;
}

export function getMatchWindowBounds(match) {
  const matchStart = toDate(match?.utcDate);
  if (!matchStart) return null;

  const matchEnd = new Date(matchStart.getTime() + MATCH_DURATION_HOURS * 60 * 60 * 1000);
  const windowStart = new Date(matchStart.getTime() - WINDOW_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(matchEnd.getTime() + WINDOW_DAYS_AFTER * 24 * 60 * 60 * 1000);

  return { matchStart, matchEnd, windowStart, windowEnd };
}

export function getMatchThreadAvailability(match, now = new Date()) {
  const bounds = getMatchWindowBounds(match);
  if (!bounds) {
    return {
      state: "INVALID",
      inWindow: false,
      ...bounds,
    };
  }

  const inWindow = now >= bounds.windowStart && now <= bounds.windowEnd;
  const state = now < bounds.windowStart ? "PRE_WINDOW" : now > bounds.windowEnd ? "POST_WINDOW" : "OPEN_WINDOW";

  return {
    state,
    inWindow,
    ...bounds,
  };
}

export async function findSystemAuthorId(prismaClient) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sportsdeck.local";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";

  const byEmail = await prismaClient.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  const byUsername = await prismaClient.user.findUnique({
    where: { username: adminUsername },
    select: { id: true },
  });
  if (byUsername) return byUsername.id;

  const admin = await prismaClient.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  return admin?.id ?? null;
}

function isUniqueConstraintError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "P2002";
}

export async function ensureMatchThreadLifecycle({
  prismaClient,
  match,
  authorId,
  now = new Date(),
}) {
  if (!match?.id || !match?.utcDate) {
    return {
      action: "skipped",
      thread: null,
      availability: getMatchThreadAvailability(match, now),
      reason: "invalid-match",
    };
  }

  const matchId = String(match.id);
  const availability = getMatchThreadAvailability(match, now);
  const desiredForumType = "GENERAL";
  const desiredTeamId = null;
  const desiredTitle = buildMatchThreadTitle(match);

  let existing = await prismaClient.thread.findUnique({
    where: { matchId },
    select: {
      id: true,
      title: true,
      status: true,
      forumType: true,
      teamId: true,
      matchId: true,
    },
  });

  if (availability.state === "OPEN_WINDOW") {
    if (!existing) {
      if (!authorId) {
        return {
          action: "skipped",
          thread: null,
          availability,
          reason: "missing-author",
        };
      }

      try {
        const createdThread = await prismaClient.$transaction(async (tx) => {
          const thread = await tx.thread.create({
            data: {
              authorId,
              title: desiredTitle,
              status: "OPEN",
              forumType: desiredForumType,
              teamId: desiredTeamId,
              matchId,
            },
            select: {
              id: true,
              title: true,
              status: true,
              forumType: true,
              teamId: true,
              matchId: true,
            },
          });

          await tx.post.create({
            data: {
              threadId: thread.id,
              authorId,
              kind: "ROOT",
              content: buildMatchThreadRootContent(match),
            },
          });

          return thread;
        });

        return { action: "created", thread: createdThread, availability };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        existing = await prismaClient.thread.findUnique({
          where: { matchId },
          select: {
            id: true,
            title: true,
            status: true,
            forumType: true,
            teamId: true,
            matchId: true,
          },
        });
      }
    }

    if (!existing) {
      return {
        action: "skipped",
        thread: null,
        availability,
        reason: "thread-not-found-after-race",
      };
    }

    const updateData = {};
    if (existing.status !== "OPEN") updateData.status = "OPEN";
    if (existing.title !== desiredTitle) updateData.title = desiredTitle;
    if (existing.forumType !== desiredForumType) updateData.forumType = desiredForumType;
    if (existing.teamId !== desiredTeamId) updateData.teamId = desiredTeamId;

    if (Object.keys(updateData).length === 0) {
      return { action: "unchanged", thread: existing, availability };
    }

    const updatedThread = await prismaClient.thread.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        title: true,
        status: true,
        forumType: true,
        teamId: true,
        matchId: true,
      },
    });

    return { action: "updated", thread: updatedThread, availability };
  }

  if (!existing) {
    return { action: "unchanged", thread: null, availability };
  }

  if (existing.status === "OPEN") {
    const closedThread = await prismaClient.thread.update({
      where: { id: existing.id },
      data: { status: "CLOSED" },
      select: {
        id: true,
        title: true,
        status: true,
        forumType: true,
        teamId: true,
        matchId: true,
      },
    });

    return { action: "closed", thread: closedThread, availability };
  }

  return { action: "unchanged", thread: existing, availability };
}
