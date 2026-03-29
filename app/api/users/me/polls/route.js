import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request) {
  try {
    const payload = requireAuth(request);

    const polls = await prisma.poll.findMany({
      where: {
        createdByUserId: payload.id,
        thread: {
          isDeleted: false,
          isHidden: false,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        threadId: true,
        question: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { votes: true } },
        thread: {
          select: {
            title: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        polls: polls.map((poll) => ({
          id: poll.id,
          threadId: poll.threadId,
          threadTitle: poll.thread.title,
          question: poll.question,
          deadline: poll.deadline,
          createdAt: poll.createdAt,
          updatedAt: poll.updatedAt,
          totalVotes: poll._count.votes,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error?.message || "Failed to fetch your polls";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
