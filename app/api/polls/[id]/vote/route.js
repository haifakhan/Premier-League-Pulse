import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request, context) {
  const params = await context.params;
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
      select: { isBanned: true },
    });

    if (user?.isBanned) {
      return NextResponse.json(
        { error: "Banned users cannot vote in polls" },
        { status: 403 }
      );
    }

    const { optionId } = body || {};

    if (!isNonEmptyString(optionId)) {
      return NextResponse.json({ error: "optionId is required" }, { status: 400 });
    }

    const poll = await prisma.poll.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        deadline: true,
        thread: {
          select: { status: true, isDeleted: true, isHidden: true },
        },
        options: { select: { id: true } },
      },
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    if (
      poll.thread?.status === "CLOSED" ||
      poll.thread?.isDeleted ||
      poll.thread?.isHidden
    ) {
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    if (new Date(poll.deadline) <= new Date()) {
      return NextResponse.json(
        { error: "Poll voting has ended" },
        { status: 409 }
      );
    }

    const optionIds = new Set(poll.options.map((opt) => opt.id));
    if (!optionIds.has(optionId.trim())) {
      return NextResponse.json({ error: "Invalid optionId" }, { status: 400 });
    }

    const existingVote = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: payload.id } },
      select: { id: true },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: "You have already voted" },
        { status: 409 }
      );
    }

    let vote;
    try {
      vote = await prisma.pollVote.create({
        data: {
          pollId: poll.id,
          optionId: optionId.trim(),
          userId: payload.id,
        },
        select: {
          id: true,
          pollId: true,
          optionId: true,
          userId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        return NextResponse.json(
          { error: "You have already voted" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ vote }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Failed to vote";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
