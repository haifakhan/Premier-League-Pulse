import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function parseDateParam(value, endOfDay = false) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return date;
}

export async function GET(request, context) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "from and to query params are required" },
        { status: 400 }
      );
    }

    const from = parseDateParam(fromParam);
    const to = parseDateParam(toParam, true);

    if (!from || !to || from > to) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const posts = await prisma.post.findMany({
      where: {
        authorId: params.id,
        isHidden: false,
        isDeleted: false,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const groupedByDate = {};

    for (const post of posts) {
      const date = post.createdAt.toISOString().slice(0, 10);
      groupedByDate[date] = (groupedByDate[date] ?? 0) + 1;
    }

    const activity = Object.entries(groupedByDate).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json({ activity }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch user activity" },
      { status: 500 }
    );
  }
}
