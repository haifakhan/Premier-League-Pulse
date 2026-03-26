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

export async function GET(request) {
  try {
    const payload = requireAuth(request);
    requireAdmin(payload);

    const appeals = await prisma.appeal.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            isBanned: true,
          },
        },
      },
    });

    return NextResponse.json({ appeals }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to fetch appeals";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
