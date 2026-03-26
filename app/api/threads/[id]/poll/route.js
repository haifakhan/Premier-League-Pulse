import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFutureDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date <= new Date()) return null;
  return date;
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
        { error: "Banned users cannot create polls" },
        { status: 403 }
      );
    }

    const { question, deadline, options } = body || {};

    if (!isNonEmptyString(question)) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const deadlineDate = parseFutureDate(deadline);
    if (!deadlineDate) {
      return NextResponse.json({ error: "Deadline must be a future date" }, { status: 400 });
    }

    if (!Array.isArray(options)) {
      return NextResponse.json({ error: "Options are required" }, { status: 400 });
    }

    const cleanedOptions = options
      .filter(isNonEmptyString)
      .map((opt) => opt.trim());

    if (cleanedOptions.length < 2) {
      return NextResponse.json(
        { error: "At least two options are required" },
        { status: 400 }
      );
    }

    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        authorId: true,
        status: true,
        isDeleted: true,
        isHidden: true,
      },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.status === "CLOSED") {
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    const existingPoll = await prisma.poll.findUnique({
      where: { threadId: thread.id },
      select: { id: true },
    });

    if (existingPoll) {
      return NextResponse.json({ error: "Poll already exists" }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const poll = await tx.poll.create({
        data: {
          threadId: thread.id,
          question: question.trim(),
          deadline: deadlineDate,
        },
        select: {
          id: true,
          threadId: true,
          question: true,
          deadline: true,
        },
      });

      const optionsData = cleanedOptions.map((text, index) => ({
        pollId: poll.id,
        text,
        position: index + 1,
      }));

      await tx.pollOption.createMany({ data: optionsData });

      const optionsResult = await tx.pollOption.findMany({
        where: { pollId: poll.id },
        orderBy: { position: "asc" },
        select: { id: true, text: true, position: true },
      });

      return { ...poll, options: optionsResult };
    });

    return NextResponse.json({ poll: created }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Failed to create poll";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(_request, context) {
  const params = await context.params;
  try {
    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: { id: true, isDeleted: true, isHidden: true },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const poll = await prisma.poll.findUnique({
      where: { threadId: thread.id },
      select: {
        id: true,
        threadId: true,
        question: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { votes: true } },
        options: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            text: true,
            position: true,
            _count: { select: { votes: true } },
          },
        },
      },
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const options = poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      position: option.position,
      votes: option._count.votes,
    }));

    return NextResponse.json(
      {
        poll: {
          id: poll.id,
          threadId: poll.threadId,
          question: poll.question,
          deadline: poll.deadline,
          createdAt: poll.createdAt,
          updatedAt: poll.updatedAt,
          totalVotes: poll._count.votes,
          options,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 });
  }
}
