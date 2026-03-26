import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { email, password, username } = body;

    if (!email?.trim() || !password?.trim() || !username?.trim()) {
      return NextResponse.json(
        { error: "Email, password, and username are required" },
        { status: 400 }
      );
    }

    const [existingEmailUser, existingUsernameUser] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingEmailUser) {
      return NextResponse.json(
        { error: "Email is already taken" },
        { status: 409 }
      );
    }

    if (existingUsernameUser) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: "REGULAR",
        isBanned: false,
      },
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

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return NextResponse.json({ user, token }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
