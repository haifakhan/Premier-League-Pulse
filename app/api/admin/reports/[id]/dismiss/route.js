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

    const targetType = report.postId ? "POST" : report.threadId ? "THREAD" : null;
    const targetId = report.postId ?? report.threadId;

    if (!targetType || !targetId) {
      return NextResponse.json({ error: "Report target not found" }, { status: 404 });
    }

    const where =
      targetType === "POST"
        ? { postId: targetId, status: "PENDING" }
        : { threadId: targetId, status: "PENDING" };

    const result = await prisma.report.updateMany({
      where,
      data: {
        status: "DISMISSED",
        reviewedAt: new Date(),
        reviewedByUserId: payload.id,
      },
    });

    return NextResponse.json({ success: true, updatedReportsCount: result.count }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to dismiss report";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
