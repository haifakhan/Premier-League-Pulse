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

function parseStoredReason(value) {
  if (typeof value !== "string") {
    return { baseReason: null, details: null };
  }

  const separatorIndex = value.indexOf("|");
  if (separatorIndex === -1) {
    const reason = value.trim();
    return { baseReason: reason || null, details: null };
  }

  const baseReason = value.slice(0, separatorIndex).trim();
  const details = value.slice(separatorIndex + 1).trim();

  return {
    baseReason: baseReason || null,
    details: details || null,
  };
}

function formatPercentage(value) {
  if (typeof value !== "number") {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

function getVerdict(aiScore, aiLabel) {
  if (typeof aiScore !== "number" || typeof aiLabel !== "string" || aiLabel.trim().length === 0) {
    return "UNKNOWN";
  }

  return aiScore >= 0.5 ? "LIKELY_INAPPROPRIATE" : "LIKELY_ACCEPTABLE";
}

function truncateDetail(value, maxLength = 160) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function buildVerdictExplanation({
  aiLabel,
  aiScore,
  userReasonCounts,
  detailSnippet,
}) {
  const labelText = typeof aiLabel === "string" && aiLabel.trim().length > 0 ? aiLabel.trim() : "N/A";
  const scoreText = formatPercentage(aiScore);
  const aiContext = `Top AI label: ${labelText}. Toxicity score: ${scoreText}.`;

  const reasons = Object.entries(userReasonCounts).sort(([a], [b]) => a.localeCompare(b));
  const userContext = reasons.length
    ? `User report reasons: ${reasons.map(([reason, count]) => `${reason}(${count})`).join(", ")}.`
    : "No user report reasons yet.";

  const detailContext = detailSnippet ? ` Details: ${detailSnippet}.` : "";

  return `${aiContext} ${userContext}${detailContext}`;
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
            threadId: true,
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
        relatedThreadId: targetType === "THREAD" ? targetId : report.post?.threadId ?? null,
        post: targetType === "POST" ? { content: report.post?.content ?? "" } : null,
        thread: targetType === "THREAD" ? { title: report.thread?.title ?? "" } : null,
        userReasonCounts: {},
        firstDetailSnippet: null,
      };

      existing.pendingReportCount += 1;
      const parsedReason = parseStoredReason(report.reason);

      if (!isAutoFlagReason(report.reason)) {
        existing.pendingUserReportCount += 1;

        const reasonKey = parsedReason.baseReason || "Other";
        existing.userReasonCounts[reasonKey] = (existing.userReasonCounts[reasonKey] ?? 0) + 1;
      }

      if (!existing.firstDetailSnippet && parsedReason.details) {
        existing.firstDetailSnippet = truncateDetail(parsedReason.details);
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

      if (!existing.relatedThreadId && report.post?.threadId) {
        existing.relatedThreadId = report.post.threadId;
      }

      groupedByTarget.set(key, existing);
    }

    const responseReports = Array.from(groupedByTarget.values())
      .map((item) => {
        const verdict = getVerdict(item.aiScore, item.aiLabel);
        const verdictExplanation = buildVerdictExplanation({
          aiLabel: item.aiLabel,
          aiScore: item.aiScore,
          userReasonCounts: item.userReasonCounts,
          detailSnippet: item.firstDetailSnippet,
        });

        return {
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
          aiScore: item.aiScore,
          aiLabel: item.aiLabel,
          latestReportedAt: item.latestReportedAt,
          pendingUserReportCount: item.pendingUserReportCount,
          pendingReportCount: item.pendingReportCount,
          relatedThreadId: item.relatedThreadId,
          post: item.post,
          thread: item.thread,
          verdict,
          verdictExplanation,
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
