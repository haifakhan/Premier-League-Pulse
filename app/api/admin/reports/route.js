import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";

function getErrorStatus(message) {
  if (message.includes("Authorization") || message.includes("token")) {
    return 401;
  }

  if (message === "Forbidden") {
    return 403;
  }

  return 500;
}

export async function GET(request) {
  try {
    const payload = requireAuth(request);
    requireAdmin(payload);

    const reports = await prisma.report.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        reason: true,
        status: true,
        aiScore: true,
        aiLabel: true,
        createdAt: true,
        reporterUserId: true,
        postId: true,
        threadId: true,
        post: {
          select: {
            content: true,
          },
        },
        thread: {
          select: {
            title: true,
          },
        },
      },
    });

    const postIds = [...new Set(reports.map((report) => report.postId).filter(Boolean))];
    const threadIds = [...new Set(reports.map((report) => report.threadId).filter(Boolean))];

    const postCounts = postIds.length ? await prisma.report.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }) : [];

    const threadCounts = threadIds.length ? await prisma.report.groupBy({
      by: ["threadId"],
      where: { threadId: { in: threadIds } },
      _count: { _all: true },
    }) : [];

    const postCountMap = new Map(postCounts.map((entry) => [entry.postId, entry._count._all]));
    const threadCountMap = new Map(
      threadCounts.map((entry) => [entry.threadId, entry._count._all])
    );

    const responseReports = reports
      .map((report) => {
        const targetType = report.postId ? "POST" : "THREAD";
        const reportCount = report.postId
          ? postCountMap.get(report.postId) ?? 0
          : threadCountMap.get(report.threadId) ?? 0;

        return {
          id: report.id,
          reason: report.reason,
          status: report.status,
          aiScore: report.aiScore,
          aiLabel: report.aiLabel,
          createdAt: report.createdAt,
          reporterUserId: report.reporterUserId,
          targetType,
          post: report.post ? { content: report.post.content } : null,
          thread: report.thread ? { title: report.thread.title } : null,
          reportCount,
        };
      })
      .sort((a, b) => {
        const aScore = a.aiScore;
        const bScore = b.aiScore;

        if (aScore == null && bScore != null) {
          return 1;
        }

        if (aScore != null && bScore == null) {
          return -1;
        }

        if (aScore != null && bScore != null && bScore !== aScore) {
          return bScore - aScore;
        }

        return b.reportCount - a.reportCount;
      });

    return NextResponse.json({ reports: responseReports }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to fetch reports";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
