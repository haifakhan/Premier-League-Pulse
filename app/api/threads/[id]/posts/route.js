import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { maybeAutoFlagPost } from "@/lib/ai";

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
        { error: "Banned users cannot post" },
        { status: 403 }
      );
    }

    const { content, parentPostId } = body || {};

    if (!isNonEmptyString(content)) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: { id: true, isDeleted: true, isHidden: true, status: true },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.status === "CLOSED") {
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    if (parentPostId) {
      const parent = await prisma.post.findUnique({
        where: { id: parentPostId },
        select: { id: true, threadId: true, isDeleted: true, isHidden: true },
      });

      if (!parent || parent.threadId !== thread.id) {
        return NextResponse.json(
          { error: "Invalid parentPostId" },
          { status: 400 }
        );
      }

      if (parent.isDeleted || parent.isHidden) {
        return NextResponse.json(
          { error: "Cannot reply to deleted post" },
          { status: 400 }
        );
      }
    }

    const post = await prisma.post.create({
      data: {
        threadId: thread.id,
        authorId: payload.id,
        kind: "REPLY",
        parentPostId: parentPostId || null,
        content: content.trim(),
      },
      select: {
        id: true,
        content: true,
        kind: true,
        parentPostId: true,
        createdAt: true,
        author: { select: { id: true, username: true } },
      },
    });

    maybeAutoFlagPost(post.id, payload.id, post.content).catch(() => {});

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Failed to create post";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
