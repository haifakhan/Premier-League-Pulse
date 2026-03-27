import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getMatches } from "@/lib/footballData";
import {
  WINDOW_DAYS_AFTER,
  WINDOW_DAYS_BEFORE,
  dedupeMatches,
  ensureMatchThreadLifecycle,
} from "@/lib/matchThreads";

export async function POST(request) {
  let payload;

  try {
    payload = requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { message: error?.message || "Unauthorized" } },
      { status: 401 }
    );
  }

  if (payload?.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: { message: "Forbidden: admin required" } },
      { status: 403 }
    );
  }

  try {
    const authorId = payload.id;

    const [scheduled, timed, finished] = await Promise.all([
      getMatches({ status: "SCHEDULED" }),
      getMatches({ status: "TIMED" }),
      getMatches({ status: "FINISHED" }),
    ]);

    const merged = dedupeMatches([
      ...(scheduled?.matches || []),
      ...(timed?.matches || []),
      ...(finished?.matches || []),
    ]).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    let created = 0;
    let updated = 0;
    let closed = 0;
    let skipped = 0;

    const now = new Date();

    for (const match of merged) {
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

    return NextResponse.json(
      {
        ok: true,
        created,
        updated,
        closed,
        skipped,
        window: { daysBefore: WINDOW_DAYS_BEFORE, daysAfter: WINDOW_DAYS_AFTER },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Failed to sync match threads",
          details: error?.message,
        },
      },
      { status: 500 }
    );
  }
}
