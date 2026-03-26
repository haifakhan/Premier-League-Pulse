import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { analyzeContent } from "@/lib/ai";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
    const { targetType, targetId, reason } = body || {};

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

    const trimmedTargetId = targetId.trim();

    if (targetType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: trimmedTargetId },
        select: { id: true },
      });

      if (!post) {
        return NextResponse.json({ error: "Target not found" }, { status: 404 });
      }

      const report = await prisma.report.create({
        data: {
          reporterUserId: payload.id,
          reason: reason.trim(),
          postId: trimmedTargetId,
          threadId: null,
        },
      });

      const reportedPost = await prisma.post.findUnique({
        where: { id: trimmedTargetId },
        select: { content: true },
      });

      const { aiScore, aiLabel } = await analyzeContent(reportedPost?.content || "");

      const updatedReport = await prisma.report.update({
        where: { id: report.id },
        data: { aiScore, aiLabel },
      });

      return NextResponse.json({ report: updatedReport }, { status: 201 });
    }

    const thread = await prisma.thread.findUnique({
      where: { id: trimmedTargetId },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const report = await prisma.report.create({
      data: {
        reporterUserId: payload.id,
        reason: reason.trim(),
        postId: null,
        threadId: trimmedTargetId,
      },
    });

    const reportedThread = await prisma.thread.findUnique({
      where: { id: trimmedTargetId },
      select: { title: true },
    });

    const { aiScore, aiLabel } = await analyzeContent(reportedThread?.title || "");

    const updatedReport = await prisma.report.update({
      where: { id: report.id },
      data: { aiScore, aiLabel },
    });

    return NextResponse.json({ report: updatedReport }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Unauthorized";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
