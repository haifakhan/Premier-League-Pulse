import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import {
  AUTO_FLAG_REASON,
  AUTO_FLAG_THRESHOLD,
  getModerationAssessment,
} from "@/lib/ai";

const VALID_FILTERS = new Set([
  "all",
  "pending",
  "dismissed",
  "user-reported",
  "approved-hidden",
  "banned-users",
]);

function parseFilter(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "all";
  }

  const normalized = value.trim().toLowerCase();
  if (!VALID_FILTERS.has(normalized)) {
    throw new Error("Invalid moderation filter");
  }

  return normalized;
}

function getErrorStatus(message) {
  if (message.includes("Authorization") || message.includes("token")) {
    return 401;
  }

  if (message === "Forbidden") {
    return 403;
  }

  if (message === "Invalid moderation filter") {
    return 400;
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

function getVerdict(assessment) {
  if (
    !assessment ||
    (assessment.classification !== "TOXIC" &&
      assessment.classification !== "NON_TOXIC" &&
      assessment.classification !== "UNKNOWN")
  ) {
    return "UNKNOWN";
  }

  if (
    assessment.classification === "TOXIC" &&
    typeof assessment.toxicityScore === "number" &&
    assessment.toxicityScore >= AUTO_FLAG_THRESHOLD
  ) {
    return "LIKELY_INAPPROPRIATE";
  }

  if (assessment.classification === "NON_TOXIC") {
    return "LIKELY_ACCEPTABLE";
  }

  return "UNKNOWN";
}

function formatModerationClassification(value) {
  if (value === "TOXIC") return "Toxic";
  if (value === "NON_TOXIC") return "Non-toxic";
  return "Unknown";
}

function getItemSourceText(item) {
  if (item?.targetType === "POST") {
    return item?.post?.content ?? "";
  }

  const title = item?.thread?.title ?? "";
  const rootContent = item?.threadRootContent ?? "";
  if (title && rootContent) {
    return `Thread title: ${title}\nMain post: ${rootContent}`;
  }
  return title || rootContent;
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
  assessment,
  userReasonCounts,
  detailSnippet,
}) {
  const labelText = typeof aiLabel === "string" && aiLabel.trim().length > 0 ? aiLabel.trim() : "N/A";
  const confidenceText = formatPercentage(aiScore);
  const toxicityText = formatPercentage(assessment?.toxicityScore ?? null);
  const classText = formatModerationClassification(assessment?.classification);
  const signalSourceText =
    assessment?.signalSource === "HEURISTIC"
      ? " Signal source: heuristic abuse phrase detection."
      : "";
  const aiContext = `Interpreted label: ${classText}. Model label: ${labelText}. Confidence: ${confidenceText}. Estimated toxicity: ${toxicityText}.${signalSourceText}`;

  const reasons = Object.entries(userReasonCounts).sort(([a], [b]) => a.localeCompare(b));
  const userContext = reasons.length
    ? `User report reasons: ${reasons.map(([reason, count]) => `${reason}(${count})`).join(", ")}.`
    : "No user report reasons yet.";

  const detailContext = detailSnippet ? ` Details: ${detailSnippet}.` : "";

  return `${aiContext} ${userContext}${detailContext}`;
}

function getTargetTypeAndId(report) {
  const targetType = report.postId ? "POST" : report.threadId ? "THREAD" : null;
  const targetId = report.postId ?? report.threadId ?? null;

  if (!targetType || !targetId) {
    return null;
  }

  return { targetType, targetId };
}

function getTargetAuthor(report, targetType) {
  const author = targetType === "POST" ? report.post?.author : report.thread?.author;

  if (!author?.id || typeof author.id !== "string" || author.id.trim().length === 0) {
    return null;
  }

  const normalizedUsername =
    typeof author.username === "string" && author.username.trim().length > 0
      ? author.username.trim()
      : "unknown-user";

  return {
    id: author.id,
    username: normalizedUsername,
    isBanned: Boolean(author.isBanned),
  };
}

function isTargetHidden(report, targetType) {
  if (targetType === "THREAD") {
    return Boolean(report.thread?.isHidden);
  }

  return Boolean(report.post?.isHidden || report.post?.thread?.isHidden);
}

function compareByLatestDesc(a, b) {
  return new Date(b.latestReportedAt).getTime() - new Date(a.latestReportedAt).getTime();
}

function compareByPendingPriority(a, b) {
  const aScore = getModerationAssessment(a.aiLabel, a.aiScore, getItemSourceText(a)).toxicityScore;
  const bScore = getModerationAssessment(b.aiLabel, b.aiScore, getItemSourceText(b)).toxicityScore;

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

  return compareByLatestDesc(a, b);
}

export async function GET(request) {
  try {
    const payload = requireAuth(request);
    requireAdmin(payload);

    const { searchParams } = new URL(request.url);
    const filter = parseFilter(searchParams.get("filter"));

    const reports = await prisma.report.findMany({
      select: {
        id: true,
        reason: true,
        status: true,
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
            isHidden: true,
            author: {
              select: {
                id: true,
                username: true,
                isBanned: true,
              },
            },
            thread: {
              select: {
                isHidden: true,
              },
            },
          },
        },
        thread: {
          select: {
            id: true,
            title: true,
            isHidden: true,
            posts: {
              where: {
                kind: "ROOT",
                isDeleted: false,
                isHidden: false,
              },
              select: {
                content: true,
              },
              take: 1,
            },
            author: {
              select: {
                id: true,
                username: true,
                isBanned: true,
              },
            },
          },
        },
      },
    });

    const groupedByTarget = new Map();

    for (const report of reports) {
      const target = getTargetTypeAndId(report);
      if (!target) {
        continue;
      }

      const { targetType, targetId } = target;
      const key = `${targetType}:${targetId}`;
      const parsedReason = parseStoredReason(report.reason);
      const isUserReported = !isAutoFlagReason(report.reason);
      const targetAuthor = getTargetAuthor(report, targetType);
      const targetHidden = isTargetHidden(report, targetType);

      const existing = groupedByTarget.get(key) ?? {
        id: report.id,
        targetType,
        targetId,
        status: report.status,
        aiScore: null,
        aiLabel: null,
        toxicityScore: null,
        latestReportedAt: report.createdAt,
        pendingUserReportCount: 0,
        pendingReportCount: 0,
        reportCount: 0,
        userReportCount: 0,
        hasPendingUserReport: false,
        relatedThreadId: targetType === "THREAD" ? targetId : report.post?.threadId ?? null,
        post: targetType === "POST" ? { content: report.post?.content ?? "" } : null,
        thread: targetType === "THREAD" ? { title: report.thread?.title ?? "" } : null,
        threadRootContent:
          targetType === "THREAD" ? report.thread?.posts?.[0]?.content ?? "" : null,
        targetAuthor,
        targetIsHidden: targetHidden,
        userReasonCounts: {},
        firstDetailSnippet: null,
      };

      existing.reportCount += 1;

      if (isUserReported) {
        existing.userReportCount += 1;
        const reasonKey = parsedReason.baseReason || "Other";
        existing.userReasonCounts[reasonKey] = (existing.userReasonCounts[reasonKey] ?? 0) + 1;
      }

      if (report.status === "PENDING") {
        existing.pendingReportCount += 1;

        if (isUserReported) {
          existing.pendingUserReportCount += 1;
          existing.hasPendingUserReport = true;
        }
      }

      if (!existing.firstDetailSnippet && parsedReason.details) {
        existing.firstDetailSnippet = truncateDetail(parsedReason.details);
      }

      const reportAssessment = getModerationAssessment(report.aiLabel, report.aiScore);
      if (
        typeof reportAssessment.toxicityScore === "number" &&
        (existing.toxicityScore == null || reportAssessment.toxicityScore > existing.toxicityScore)
      ) {
        existing.toxicityScore = reportAssessment.toxicityScore;
        existing.aiScore = report.aiScore;
        existing.aiLabel = report.aiLabel;
      } else if (
        existing.aiScore == null &&
        typeof report.aiScore === "number"
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
        existing.status = report.status;

        if (targetAuthor) {
          existing.targetAuthor = targetAuthor;
        }
      }

      if (!existing.relatedThreadId && report.post?.threadId) {
        existing.relatedThreadId = report.post.threadId;
      }

      if (!existing.targetAuthor && targetAuthor) {
        existing.targetAuthor = targetAuthor;
      }

      existing.targetIsHidden = existing.targetIsHidden || targetHidden;

      groupedByTarget.set(key, existing);
    }

    const canonicalItems = Array.from(groupedByTarget.values());

    const filteredItems = canonicalItems.filter((item) => {
      if (filter === "pending") {
        return item.status === "PENDING";
      }

      if (filter === "dismissed") {
        return item.status === "DISMISSED";
      }

      if (filter === "user-reported") {
        return item.status === "PENDING" && item.hasPendingUserReport;
      }

      if (filter === "approved-hidden") {
        return item.status === "APPROVED" && item.targetIsHidden;
      }

      if (filter === "banned-users") {
        return Boolean(item.targetAuthor?.isBanned);
      }

      return true;
    });

    const responseReports = filteredItems
      .map((item) => {
        const assessment = getModerationAssessment(
          item.aiLabel,
          item.aiScore,
          getItemSourceText(item)
        );
        const verdict = getVerdict(assessment);
        const verdictExplanation = buildVerdictExplanation({
          aiLabel: item.aiLabel,
          aiScore: item.aiScore,
          assessment,
          userReasonCounts: item.userReasonCounts,
          detailSnippet: item.firstDetailSnippet,
        });

        return {
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
          status: item.status,
          aiScore: item.aiScore,
          aiLabel: item.aiLabel,
          latestReportedAt: item.latestReportedAt,
          reportCount: item.reportCount,
          userReportCount: item.userReportCount,
          pendingUserReportCount: item.pendingUserReportCount,
          pendingReportCount: item.pendingReportCount,
          relatedThreadId: item.relatedThreadId,
          post: item.post,
          thread: item.thread,
          targetAuthor: item.targetAuthor,
          verdict,
          verdictExplanation,
        };
      })
      .sort((a, b) => {
        if (filter === "dismissed" || filter === "approved-hidden" || filter === "banned-users") {
          return compareByLatestDesc(a, b);
        }

        if (filter === "all") {
          if (a.status === "PENDING" && b.status !== "PENDING") {
            return -1;
          }

          if (a.status !== "PENDING" && b.status === "PENDING") {
            return 1;
          }

          if (a.status === "PENDING" && b.status === "PENDING") {
            return compareByPendingPriority(a, b);
          }

          return compareByLatestDesc(a, b);
        }

        return compareByPendingPriority(a, b);
      });

    return NextResponse.json({ reports: responseReports }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to fetch reports";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
