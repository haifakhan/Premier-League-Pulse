import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sanitizeUserId(value) {
  if (typeof value !== "string") return "user";
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized || "user";
}

export async function POST(request) {
  try {
    const payload = requireAuth(request);

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid multipart form data" },
        { status: 400 }
      );
    }

    const avatar = formData.get("avatar");
    if (!(avatar instanceof File)) {
      return NextResponse.json(
        { error: "avatar file is required" },
        { status: 400 }
      );
    }

    if (avatar.size <= 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty" },
        { status: 400 }
      );
    }

    if (avatar.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const mimeType = typeof avatar.type === "string" ? avatar.type.toLowerCase() : "";
    const extension = MIME_TO_EXTENSION[mimeType];
    if (!extension) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WEBP, and GIF files are allowed" },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const userId = sanitizeUserId(payload.id);
    const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString("hex")}`;
    const filename = `${userId}-${uniqueSuffix}.${extension}`;
    const absolutePath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await avatar.arrayBuffer());
    await writeFile(absolutePath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    return NextResponse.json({ avatarUrl }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to upload avatar";
    const status =
      message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
