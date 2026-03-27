require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const WINDOW_DAYS_BEFORE = 14;
const WINDOW_DAYS_AFTER = 14;
const MATCH_DURATION_HOURS = 3;

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

function buildTitle(match) {
  const home = match?.homeTeam?.name || "Home";
  const away = match?.awayTeam?.name || "Away";
  const matchday = match?.matchday;
  return matchday
    ? `${home} vs ${away} — Matchday ${matchday}`
    : `${home} vs ${away}`;
}

function buildRootContent(match) {
  const home = match?.homeTeam?.name || "Home";
  const away = match?.awayTeam?.name || "Away";
  return `Auto-generated match thread for ${home} vs ${away}. Discuss below!`;
}

function getWindowBounds(match) {
  const matchStart = new Date(match.utcDate);
  const matchEnd = new Date(
    matchStart.getTime() + MATCH_DURATION_HOURS * 60 * 60 * 1000
  );
  const windowStart = new Date(
    matchStart.getTime() - WINDOW_DAYS_BEFORE * 24 * 60 * 60 * 1000
  );
  const windowEnd = new Date(
    matchEnd.getTime() + WINDOW_DAYS_AFTER * 24 * 60 * 60 * 1000
  );
  return { windowStart, windowEnd };
}

async function getAdminUserId() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sportsdeck.local";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";

  const byEmail = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  const byUsername = await prisma.user.findUnique({
    where: { username: adminUsername },
    select: { id: true },
  });
  if (byUsername) return byUsername.id;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  return admin?.id || null;
}

async function fetchMatches() {
  const { getMatches } = await import("../lib/footballData.js");
  const [scheduled, timed, finished] = await Promise.all([
    getMatches({ status: "SCHEDULED" }),
    getMatches({ status: "TIMED" }),
    getMatches({ status: "FINISHED" }),
  ]);

  return dedupeMatches([
    ...(scheduled?.matches || []),
    ...(timed?.matches || []),
    ...(finished?.matches || []),
  ]).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

async function main() {
  const authorId = await getAdminUserId();
  if (!authorId) {
    throw new Error("No admin user found for sync");
  }

  const matches = await fetchMatches();

  let created = 0;
  let updated = 0;
  let closed = 0;
  let skipped = 0;

  const now = new Date();

  for (const match of matches) {
    if (!match?.id || !match?.utcDate) {
      skipped += 1;
      continue;
    }

    const { windowStart, windowEnd } = getWindowBounds(match);
    const inWindow = now >= windowStart && now <= windowEnd;
    const matchId = String(match.id);

    const existing = await prisma.thread.findUnique({
      where: { matchId },
      select: {
        id: true,
        status: true,
        title: true,
        forumType: true,
        teamId: true,
      },
    });

    if (inWindow) {
      const title = buildTitle(match);
      const desiredForumType = "GENERAL";
      const desiredTeamId = null;

      if (!existing) {
        await prisma.$transaction(async (tx) => {
          const thread = await tx.thread.create({
            data: {
              authorId,
              title,
              status: "OPEN",
              forumType: desiredForumType,
              teamId: desiredTeamId,
              matchId,
            },
            select: { id: true },
          });

          await tx.post.create({
            data: {
              threadId: thread.id,
              authorId,
              kind: "ROOT",
              content: buildRootContent(match),
            },
          });
        });
        created += 1;
        continue;
      }

      const updateData = {};
      if (existing.status !== "OPEN") updateData.status = "OPEN";
      if (existing.title !== title) updateData.title = title;
      if (existing.forumType !== desiredForumType) {
        updateData.forumType = desiredForumType;
      }
      if (existing.teamId !== desiredTeamId) updateData.teamId = desiredTeamId;

      if (Object.keys(updateData).length > 0) {
        await prisma.thread.update({ where: { id: existing.id }, data: updateData });
        updated += 1;
      } else {
        skipped += 1;
      }
    } else {
      if (existing && existing.status === "OPEN") {
        await prisma.thread.update({
          where: { id: existing.id },
          data: { status: "CLOSED" },
        });
        closed += 1;
      } else {
        skipped += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        created,
        updated,
        closed,
        skipped,
        window: { daysBefore: WINDOW_DAYS_BEFORE, daysAfter: WINDOW_DAYS_AFTER },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Failed to sync match threads:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
