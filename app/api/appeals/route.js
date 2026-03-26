import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, isBanned: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isBanned) {
      return NextResponse.json({ error: "You are not banned" }, { status: 403 });
    }

    const { reason } = body || {};

    if (!isNonEmptyString(reason)) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const pendingAppeal = await prisma.appeal.findFirst({
      where: {
        userId: user.id,
        status: "PENDING",
      },
      select: { id: true },
    });

    if (pendingAppeal) {
      return NextResponse.json(
        { error: "You already have a pending appeal" },
        { status: 409 }
      );
    }

    const appeal = await prisma.appeal.create({
      data: {
        userId: user.id,
        reason: reason.trim(),
        status: "PENDING",
      },
    });

    return NextResponse.json({ appeal }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Unauthorized";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
