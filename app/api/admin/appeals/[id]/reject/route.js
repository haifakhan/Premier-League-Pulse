import { NextResponse } from "next/server";
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

    const appeal = await prisma.appeal.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    if (appeal.status !== "PENDING") {
      return NextResponse.json(
        { error: "Appeal has already been reviewed" },
        { status: 400 }
      );
    }

    await prisma.appeal.update({
      where: { id: appeal.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId: payload.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to reject appeal";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
