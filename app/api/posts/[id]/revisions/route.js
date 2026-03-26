import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";

export async function GET(_request, context) {
  const params = await context.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { id: true, isDeleted: true, isHidden: true },
    });

    if (!post || post.isDeleted || post.isHidden) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const revisions = await prisma.postRevision.findMany({
      where: { postId: params.id },
      orderBy: { editedAt: "desc" },
      select: {
        id: true,
        previousContent: true,
        editedAt: true,
        editor: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ revisions }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch revisions" },
      { status: 500 }
    );
  }
}
