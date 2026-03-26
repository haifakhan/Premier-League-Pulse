import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFutureDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date <= new Date()) return null;
  return date;
}

async function buildPollResponse(pollId) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
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

  if (!poll) return null;

  return {
    id: poll.id,
    threadId: poll.threadId,
    question: poll.question,
    deadline: poll.deadline,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    totalVotes: poll._count.votes,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      position: option.position,
      votes: option._count.votes,
    })),
  };
}

export async function PATCH(request, context) {
  const params = await context.params;
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const payload = requireAuth(request);
    const { question, deadline, options } = body || {};

    const hasQuestion = question !== undefined;
    const hasDeadline = deadline !== undefined;
    const hasOptions = options !== undefined;

    if (!hasQuestion && !hasDeadline && !hasOptions) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const poll = await prisma.poll.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        question: true,
        deadline: true,
        thread: {
          select: { authorId: true, status: true, isDeleted: true, isHidden: true },
        },
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

    if (poll.thread?.authorId !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData = {};

    if (hasQuestion) {
      if (!isNonEmptyString(question)) {
        return NextResponse.json({ error: "Question is required" }, { status: 400 });
      }
      updateData.question = question.trim();
    }

    if (hasDeadline) {
      const parsed = parseFutureDate(deadline);
      if (!parsed) {
        return NextResponse.json(
          { error: "Deadline must be a future date" },
          { status: 400 }
        );
      }
      updateData.deadline = parsed;
    }

    if (hasOptions) {
      const voteCount = await prisma.pollVote.count({
        where: { pollId: poll.id },
      });

      if (voteCount > 0) {
        return NextResponse.json(
          { error: "Cannot edit options after voting has started" },
          { status: 409 }
        );
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

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateData).length > 0) {
          await tx.poll.update({ where: { id: poll.id }, data: updateData });
        }

        await tx.pollOption.deleteMany({ where: { pollId: poll.id } });

        await tx.pollOption.createMany({
          data: cleanedOptions.map((text, index) => ({
            pollId: poll.id,
            text,
            position: index + 1,
          })),
        });
      });

      const refreshed = await buildPollResponse(poll.id);
      return NextResponse.json({ poll: refreshed }, { status: 200 });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await prisma.poll.update({ where: { id: poll.id }, data: updateData });

    const refreshed = await buildPollResponse(poll.id);
    return NextResponse.json({ poll: refreshed }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to update poll";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request, context) {
  const params = await context.params;

  try {
    const payload = requireAuth(request);

    const poll = await prisma.poll.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        thread: {
          select: { authorId: true, status: true, isDeleted: true, isHidden: true },
        },
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

    if (poll.thread?.authorId !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.pollVote.deleteMany({ where: { pollId: poll.id } }),
      prisma.pollOption.deleteMany({ where: { pollId: poll.id } }),
      prisma.poll.delete({ where: { id: poll.id } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to delete poll";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
