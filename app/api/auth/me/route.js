import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request) {
  try {
    const payload = requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        role: true,
        isBanned: true,
        favoriteTeamId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
