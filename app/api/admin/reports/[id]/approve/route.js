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

  if (message === "Report target not found") {
    return 404;
  }

  return 500;
}

export async function POST(request, context) {
  const params = await context.params;

  try {
    const payload = requireAuth(request);
    requireAdmin(payload);

    const report = await prisma.report.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, postId: true, threadId: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "PENDING") {
      return NextResponse.json(
        { error: "Report has already been reviewed" },
        { status: 400 }
      );
    }

    if (!report.postId && !report.threadId) {
      return NextResponse.json({ error: "Report target not found" }, { status: 404 });
    }

    const now = new Date();
    const updatedReportsCount = await prisma.$transaction(async (tx) => {
      if (report.threadId) {
        const threadId = report.threadId;
        const threadPosts = await tx.post.findMany({
          where: { threadId },
          select: { id: true },
        });
        const threadPostIds = threadPosts.map((post) => post.id);

        const updateReportsResult = await tx.report.updateMany({
          where: {
            status: "PENDING",
            OR: [
              { threadId },
              ...(threadPostIds.length ? [{ postId: { in: threadPostIds } }] : []),
            ],
          },
          data: {
            status: "APPROVED",
            reviewedAt: now,
            reviewedByUserId: payload.id,
          },
        });

        await tx.thread.updateMany({
          where: { id: threadId },
          data: {
            isHidden: true,
            hiddenAt: now,
            hiddenByUserId: payload.id,
          },
        });

        await tx.post.updateMany({
          where: { threadId },
          data: {
            isHidden: true,
            hiddenAt: now,
            hiddenByUserId: payload.id,
          },
        });

        return updateReportsResult.count;
      }

      const post = await tx.post.findUnique({
        where: { id: report.postId },
        select: {
          id: true,
          kind: true,
          threadId: true,
        },
      });

      if (!post) {
        throw new Error("Report target not found");
      }

      if (post.kind === "ROOT") {
        const threadPosts = await tx.post.findMany({
          where: { threadId: post.threadId },
          select: { id: true },
        });
        const threadPostIds = threadPosts.map((item) => item.id);

        const updateReportsResult = await tx.report.updateMany({
          where: {
            status: "PENDING",
            OR: [
              { threadId: post.threadId },
              ...(threadPostIds.length ? [{ postId: { in: threadPostIds } }] : []),
            ],
          },
          data: {
            status: "APPROVED",
            reviewedAt: now,
            reviewedByUserId: payload.id,
          },
        });

        await tx.thread.updateMany({
          where: { id: post.threadId },
          data: {
            isHidden: true,
            hiddenAt: now,
            hiddenByUserId: payload.id,
          },
        });

        await tx.post.updateMany({
          where: { threadId: post.threadId },
          data: {
            isHidden: true,
            hiddenAt: now,
            hiddenByUserId: payload.id,
          },
        });

        return updateReportsResult.count;
      }

      const updateReportsResult = await tx.report.updateMany({
        where: {
          postId: post.id,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          reviewedByUserId: payload.id,
        },
      });

      await tx.post.updateMany({
        where: { id: post.id },
        data: {
          isHidden: true,
          hiddenAt: now,
          hiddenByUserId: payload.id,
        },
      });

      return updateReportsResult.count;
    });

    return NextResponse.json({ success: true, updatedReportsCount }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to approve report";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
