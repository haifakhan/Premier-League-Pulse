import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { AUTO_FLAG_REASON } from "@/lib/ai";

function getErrorStatus(message) {
  if (message.includes("Authorization") || message.includes("token")) {
    return 401;
  }

  if (message === "Forbidden") {
    return 403;
  }

  return 500;
}

function isAutoFlagReason(value) {
  if (typeof value !== "string") return false;
  return value === AUTO_FLAG_REASON || value.startsWith(`${AUTO_FLAG_REASON} |`);
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
        aiScore: true,
        aiLabel: true,
        createdAt: true,
        postId: true,
        threadId: true,
        post: {
          select: {
            id: true,
            content: true,
          },
        },
        thread: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const groupedByTarget = new Map();

    for (const report of reports) {
      const targetType = report.postId ? "POST" : report.threadId ? "THREAD" : null;
      const targetId = report.postId ?? report.threadId ?? null;

      if (!targetType || !targetId) {
        continue;
      }

      const key = `${targetType}:${targetId}`;
      const existing = groupedByTarget.get(key) ?? {
        id: report.id,
        targetType,
        targetId,
        aiScore: null,
        aiLabel: null,
        latestReportedAt: report.createdAt,
        pendingUserReportCount: 0,
        pendingReportCount: 0,
        post: targetType === "POST" ? { content: report.post?.content ?? "" } : null,
        thread: targetType === "THREAD" ? { title: report.thread?.title ?? "" } : null,
      };

      existing.pendingReportCount += 1;
      if (!isAutoFlagReason(report.reason)) {
        existing.pendingUserReportCount += 1;
      }

      if (
        typeof report.aiScore === "number" &&
        (existing.aiScore == null || report.aiScore > existing.aiScore)
      ) {
        existing.aiScore = report.aiScore;
        existing.aiLabel = report.aiLabel;
      }

      if (
        new Date(report.createdAt).getTime() >
        new Date(existing.latestReportedAt).getTime()
      ) {
        existing.latestReportedAt = report.createdAt;
        existing.id = report.id;
      }

      groupedByTarget.set(key, existing);
    }

    const responseReports = Array.from(groupedByTarget.values()).sort((a, b) => {
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

      if (b.pendingUserReportCount !== a.pendingUserReportCount) {
        return b.pendingUserReportCount - a.pendingUserReportCount;
      }

      if (b.pendingReportCount !== a.pendingReportCount) {
        return b.pendingReportCount - a.pendingReportCount;
      }

      return new Date(b.latestReportedAt).getTime() - new Date(a.latestReportedAt).getTime();
    });

    return NextResponse.json({ reports: responseReports }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to fetch reports";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
