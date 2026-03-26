import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";

function getErrorStatus(message) {
  if (message.includes("Authorization") || message.includes("token")) {
    return 401;
  }

  if (message === "Forbidden") {
    return 403;
  }

  return 500;
}

export async function POST(request, context) {
  const params = await context.params;

  try {
    const payload = requireAuth(request);
    requireAdmin(payload);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isBanned: false },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to unban user";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
