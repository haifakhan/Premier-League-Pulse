import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, verifyPassword } from "@/lib/auth";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { email, password } = body;

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json({ error: "Account is banned" }, { status: 403 });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      isBanned: user.isBanned,
      favoriteTeamId: user.favoriteTeamId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json({ user: safeUser, token }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
