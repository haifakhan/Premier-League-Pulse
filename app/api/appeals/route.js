import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getErrorStatus(message) {
  if (message.includes("Authorization") || message.includes("token")) {
    return 401;
  }

  return 500;
}

export async function GET(request) {
  try {
    const payload = requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, isBanned: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appeals = await prisma.appeal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json(
      {
        isBanned: user.isBanned,
        appeals,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error?.message || "Failed to fetch appeals";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
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
    const trimmedReason = reason.trim();

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
        reason: trimmedReason,
        status: "PENDING",
      },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({ appeal }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Failed to submit appeal";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
