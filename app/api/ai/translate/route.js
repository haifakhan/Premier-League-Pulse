import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import { getCachedFresh, setCached } from "../../../../lib/cache.js";
import { translateToEnglish, TRANSLATION_MODEL } from "@/lib/ai-translate";

const TRANSLATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TARGET_LANGUAGE = "en";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const hasText = Object.prototype.hasOwnProperty.call(body || {}, "text");
    const hasPostId = Object.prototype.hasOwnProperty.call(body || {}, "postId");

    if ((hasText && hasPostId) || (!hasText && !hasPostId)) {
      return NextResponse.json(
        { error: "Provide either text or postId" },
        { status: 400 }
      );
    }

    let sourceText;
    let cacheKey;

    if (hasText) {
      if (!isNonEmptyString(body.text)) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
      }

      sourceText = body.text.trim();
      cacheKey = `translate:text:${hashText(sourceText)}`;
    } else {
      if (!isNonEmptyString(body.postId)) {
        return NextResponse.json({ error: "postId is required" }, { status: 400 });
      }

      const postId = body.postId.trim();
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          content: true,
          isHidden: true,
          isDeleted: true,
          updatedAt: true,
        },
      });

      if (!post || post.isHidden || post.isDeleted) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      sourceText = post.content;
      cacheKey = `translate:post:${post.id}:${post.updatedAt.toISOString()}`;
    }

    const cached = await getCachedFresh(cacheKey);
    if (cached) {
      return NextResponse.json(
        {
          translation: {
            sourceText: cached.sourceText,
            translatedText: cached.translatedText,
            targetLanguage: cached.targetLanguage || TARGET_LANGUAGE,
            model: cached.model || TRANSLATION_MODEL,
            cached: true,
          },
        },
        { status: 200 }
      );
    }

    let translation;
    try {
      translation = await translateToEnglish(sourceText);
    } catch {
      return NextResponse.json(
        { error: "Translation service unavailable" },
        { status: 503 }
      );
    }

    const payload = {
      sourceText,
      translatedText: translation.translatedText,
      targetLanguage: TARGET_LANGUAGE,
      model: translation.model || TRANSLATION_MODEL,
    };

    await setCached(cacheKey, payload, TRANSLATION_TTL_MS);

    return NextResponse.json(
      {
        translation: {
          ...payload,
          cached: false,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to translate" }, { status: 500 });
  }
}
