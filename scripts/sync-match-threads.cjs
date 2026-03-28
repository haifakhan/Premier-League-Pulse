/* eslint-disable @typescript-eslint/no-require-imports */
const { config: loadEnv } = require("dotenv");

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function fetchMatches(dedupeMatches) {
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
  const {
    WINDOW_DAYS_AFTER,
    WINDOW_DAYS_BEFORE,
    dedupeMatches,
    ensureMatchThreadLifecycle,
    findSystemAuthorId,
  } = await import("../lib/matchThreads.js");

  const authorId = await findSystemAuthorId(prisma);
  if (!authorId) {
    throw new Error("No admin user found for sync");
  }

  const matches = await fetchMatches(dedupeMatches);

  let created = 0;
  let updated = 0;
  let closed = 0;
  let skipped = 0;

  const now = new Date();

  for (const match of matches) {
    const result = await ensureMatchThreadLifecycle({
      prismaClient: prisma,
      match,
      authorId,
      now,
    });

    switch (result.action) {
      case "created":
        created += 1;
        break;
      case "updated":
        updated += 1;
        break;
      case "closed":
        closed += 1;
        break;
      case "unchanged":
      case "skipped":
      default:
        skipped += 1;
        break;
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
