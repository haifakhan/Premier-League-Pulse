import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { analyzeContent } from "@/lib/ai";

const THREAD_ANALYSIS_MAX_LENGTH = 4000;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Offensive content",
  "Misinformation",
  "Other",
];

function normalizeReason(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return REPORT_REASONS.find((reason) => reason.toLowerCase() === normalized) ?? null;
}

function formatStoredReason(reason, details) {
  if (!isNonEmptyString(details)) {
    return reason;
  }

  return `${reason} | ${details.trim()}`;
}

function isUniqueConstraintError(error) {
  return Boolean(error && typeof error === "object" && error.code === "P2002");
}

function buildThreadAnalysisText(title, rootContent) {
  const titleText = isNonEmptyString(title) ? title.trim() : "";
  const rootText = isNonEmptyString(rootContent) ? rootContent.trim() : "";

  const parts = [];
  if (titleText) {
    parts.push(`Thread title: ${titleText}`);
  }

  if (rootText) {
    parts.push(`Main post: ${rootText}`);
  }

  const combined = parts.join("\n");
  if (!combined) {
    return "";
  }

  if (combined.length <= THREAD_ANALYSIS_MAX_LENGTH) {
    return combined;
  }

  return combined.slice(0, THREAD_ANALYSIS_MAX_LENGTH);
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const payload = requireAuth(request);
    const { targetType, targetId, reason, details } = body || {};

    if (
      !isNonEmptyString(targetType) ||
      !isNonEmptyString(targetId) ||
      !isNonEmptyString(reason)
    ) {
      return NextResponse.json(
        { error: "targetType, targetId, and reason are required" },
        { status: 400 }
      );
    }

    if (targetType !== "POST" && targetType !== "THREAD") {
      return NextResponse.json(
        { error: "targetType must be either POST or THREAD" },
        { status: 400 }
      );
    }

    const canonicalReason = normalizeReason(reason);
    if (!canonicalReason) {
      return NextResponse.json(
        { error: "Invalid reason" },
        { status: 400 }
      );
    }

    const trimmedDetails = isNonEmptyString(details) ? details.trim() : "";
    if (canonicalReason === "Other" && !trimmedDetails) {
      return NextResponse.json(
        { error: "details are required when reason is Other" },
        { status: 400 }
      );
    }

    const storedReason = formatStoredReason(canonicalReason, trimmedDetails);
    const trimmedTargetId = targetId.trim();

    if (targetType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: trimmedTargetId },
        select: {
          id: true,
          authorId: true,
          content: true,
          isDeleted: true,
          isHidden: true,
          thread: {
            select: {
              isDeleted: true,
              isHidden: true,
            },
          },
        },
      });

      if (!post || post.isDeleted || post.isHidden || post.thread?.isDeleted || post.thread?.isHidden) {
        return NextResponse.json({ error: "Target not found" }, { status: 404 });
      }

      if (post.authorId === payload.id) {
        return NextResponse.json(
          { error: "You cannot report your own content" },
          { status: 403 }
        );
      }

      const existingReport = await prisma.report.findFirst({
        where: {
          reporterUserId: payload.id,
          postId: trimmedTargetId,
        },
        select: { id: true },
      });

      if (existingReport) {
        return NextResponse.json(
          { error: "You have already reported this post" },
          { status: 409 }
        );
      }

      const report = await prisma.report.create({
        data: {
          reporterUserId: payload.id,
          reason: storedReason,
          postId: trimmedTargetId,
          threadId: null,
        },
      });

      const { aiScore, aiLabel } = await analyzeContent(post.content || "");

      const updatedReport = await prisma.report.update({
        where: { id: report.id },
        data: { aiScore, aiLabel },
      });

      return NextResponse.json({ report: updatedReport }, { status: 201 });
    }

    const thread = await prisma.thread.findUnique({
      where: { id: trimmedTargetId },
      select: {
        id: true,
        authorId: true,
        title: true,
        isDeleted: true,
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
      },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    if (thread.authorId === payload.id) {
      return NextResponse.json(
        { error: "You cannot report your own content" },
        { status: 403 }
      );
    }

    const existingReport = await prisma.report.findFirst({
      where: {
        reporterUserId: payload.id,
        threadId: trimmedTargetId,
      },
      select: { id: true },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this thread" },
        { status: 409 }
      );
    }

    const report = await prisma.report.create({
      data: {
        reporterUserId: payload.id,
        reason: storedReason,
        postId: null,
        threadId: trimmedTargetId,
      },
    });

    const rootContent = thread.posts?.[0]?.content ?? "";
    const analysisText = buildThreadAnalysisText(thread.title || "", rootContent);
    const { aiScore, aiLabel } = await analyzeContent(analysisText || thread.title || "");

    const updatedReport = await prisma.report.update({
      where: { id: report.id },
      data: { aiScore, aiLabel },
    });

    return NextResponse.json({ report: updatedReport }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "You have already reported this content" },
        { status: 409 }
      );
    }

    const message = error?.message || "Unauthorized";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
