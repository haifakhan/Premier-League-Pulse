import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { maybeAutoFlagPost } from "@/lib/ai";

function normalizeTagName(name) {
  return name.trim().toLowerCase();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || undefined;
    const authorParam = searchParams.get("author")?.trim() || undefined;
    let authorId = authorParam;
    if (authorParam) {
      const authorUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: authorParam }, { username: authorParam }],
        },
        select: { id: true },
      });

      if (!authorUser) {
        return NextResponse.json({ threads: [] }, { status: 200 });
      }

      authorId = authorUser.id;
    }
    const teamId = searchParams.get("teamId")?.trim() || undefined;
    const rawTag = searchParams.get("tag");
    const tag = rawTag ? normalizeTagName(rawTag) : undefined;
    const forumType = searchParams.get("forumType")?.trim() || undefined;
    const matchId = searchParams.get("matchId")?.trim() || undefined;

    const where = {
      isHidden: false,
      isDeleted: false,
      ...(authorId ? { authorId } : {}),
      ...(teamId ? { teamId } : {}),
      ...(forumType ? { forumType } : {}),
      ...(matchId ? { matchId } : {}),
      ...(q ? { title: { contains: q } } : {}),
      ...(tag
        ? {
            threadTags: {
              some: {
                tag: {
                  name: { equals: tag },
                },
              },
            },
          }
        : {}),
    };

    const threads = await prisma.thread.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        forumType: true,
        teamId: true,
        matchId: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, username: true } },
        threadTags: { select: { tag: { select: { name: true } } } },
        _count: {
          select: {
            posts: {
              where: { isDeleted: false, isHidden: false },
            },
          },
        },
      },
    });

    const response = threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      forumType: thread.forumType,
      teamId: thread.teamId,
      matchId: thread.matchId,
      status: thread.status,
      createdAt: thread.createdAt,
      author: thread.author,
      tags: thread.threadTags.map((t) => t.tag.name),
      postsCount: thread._count.posts,
    }));

    return NextResponse.json({ threads: response }, { status: 200 });
  } catch (error) {
    console.error("GET /api/threads failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch threads" },
      { status: 500 }
    );
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
      select: { isBanned: true },
    });

    if (user?.isBanned) {
      return NextResponse.json(
        { error: "Banned users cannot create threads" },
        { status: 403 }
      );
    }

    const { title, content, forumType, teamId, matchId, tags } = body || {};

    if (!isNonEmptyString(title) || !isNonEmptyString(content)) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    if (!isNonEmptyString(forumType)) {
      return NextResponse.json(
        { error: "forumType is required" },
        { status: 400 }
      );
    }

    const tagNames = Array.isArray(tags)
      ? tags.filter(isNonEmptyString).map(normalizeTagName)
      : [];

    const created = await prisma.$transaction(async (tx) => {
      const thread = await tx.thread.create({
        data: {
          title: title.trim(),
          forumType,
          teamId: teamId?.trim() || null,
          matchId: matchId != null ? String(matchId) : null,
          authorId: payload.id,
          status: "OPEN",
        },
        select: {
          id: true,
          title: true,
          forumType: true,
          teamId: true,
          matchId: true,
          status: true,
          createdAt: true,
        },
      });

      const post = await tx.post.create({
        data: {
          threadId: thread.id,
          authorId: payload.id,
          kind: "ROOT",
          content: content.trim(),
        },
        select: {
          id: true,
          content: true,
        },
      });

      if (tagNames.length) {
        const uniqueTags = [...new Set(tagNames)];
        for (const name of uniqueTags) {
          const tagRecord = await tx.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          });
          await tx.threadTag.create({
            data: { threadId: thread.id, tagId: tagRecord.id },
          });
        }
      }

      return { thread, post };
    });

    maybeAutoFlagPost(created.post.id, payload.id, created.post.content).catch(() => {});

    return NextResponse.json({ thread: created.thread }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Failed to create thread";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
