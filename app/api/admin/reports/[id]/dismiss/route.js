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
      select: { id: true, status: true },
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

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "DISMISSED",
        reviewedAt: new Date(),
        reviewedByUserId: payload.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to dismiss report";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
