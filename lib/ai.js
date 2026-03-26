import prisma from "@/lib/prisma";

const HF_URL = `https://router.huggingface.co/hf-inference/models/martin-ha/toxic-comment-model`;

function nullResult() {
  return { aiScore: null, aiLabel: null };
}

function normalizePredictions(payload) {
  if (!Array.isArray(payload)) return null;
  if (Array.isArray(payload[0])) return payload[0];
  return payload;
}

export async function analyzeContent(text) {
  try {
    if (typeof text !== "string" || text.trim().length === 0) {
      return nullResult();
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
    if (!apiKey) return nullResult();

    const response = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) return nullResult();

    const payload = await response.json();
    const predictions = normalizePredictions(payload);

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return nullResult();
    }

    const top = predictions.reduce((best, entry) => {
      if (
        !entry ||
        typeof entry.label !== "string" ||
        typeof entry.score !== "number"
      ) {
        return best;
      }

      if (!best || entry.score > best.score) return entry;
      return best;
    }, null);

    return {
      aiScore: top ? top.score : null,
      aiLabel: top ? top.label : null,
    };
  } catch {
    return nullResult();
  }
}

export async function maybeAutoFlagPost(postId, authorId, content) {
  try {
    if (
      typeof postId !== "string" ||
      postId.trim().length === 0 ||
      typeof authorId !== "string" ||
      authorId.trim().length === 0
    ) {
      return;
    }

    const { aiScore, aiLabel } = await analyzeContent(content);

    if (typeof aiScore !== "number" || aiScore <= 0.5) return;

    await prisma.report.create({
      data: {
        reporterUserId: authorId,
        reason: "Auto-flagged by AI moderation",
        postId,
        threadId: null,
        aiScore,
        aiLabel,
      },
    });
  } catch {
    // Intentionally silent: AI moderation must never crash the request flow.
  }
}
