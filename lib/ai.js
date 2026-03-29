import prisma from "@/lib/prisma";

const HF_URL = `https://router.huggingface.co/hf-inference/models/martin-ha/toxic-comment-model`;
export const AUTO_FLAG_THRESHOLD = 0.5;
export const AUTO_FLAG_REASON = "Auto-flagged by AI moderation";

const TOXIC_LABELS = new Set([
  "toxic",
  "toxicity",
  "abusive",
  "insult",
  "obscene",
  "hate",
  "threat",
  "offensive",
  "label_1",
]);

const NON_TOXIC_LABELS = new Set([
  "non-toxic",
  "nontoxic",
  "clean",
  "safe",
  "neutral",
  "acceptable",
  "label_0",
]);

const DIRECT_ABUSE_PATTERNS = [
  /\b(?:you|u|ur|you're|youre)\s+(?:stupid|idiot|dumb|moron|loser|trash|garbage)\b/i,
  /\b(?:shut\s+up|stfu)\b/i,
  /\b(?:kill\s+yourself|kys)\b/i,
  /\b(?:fuck\s+you|f\*+k\s+you)\b/i,
  /\b(?:bitch|asshole)\b/i,
];

function nullResult() {
  return { aiScore: null, aiLabel: null };
}

function normalizePredictions(payload) {
  if (!Array.isArray(payload)) return null;
  if (Array.isArray(payload[0])) return payload[0];
  return payload;
}

function clamp01(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function estimateHeuristicToxicity(sourceText) {
  if (typeof sourceText !== "string" || sourceText.trim().length === 0) {
    return null;
  }

  const text = sourceText.trim();
  for (const pattern of DIRECT_ABUSE_PATTERNS) {
    if (pattern.test(text)) {
      return 0.9;
    }
  }

  return null;
}

export function classifyModerationLabel(aiLabel) {
  if (typeof aiLabel !== "string") {
    return "UNKNOWN";
  }

  const normalized = aiLabel.trim().toLowerCase();
  if (!normalized) {
    return "UNKNOWN";
  }

  if (TOXIC_LABELS.has(normalized)) {
    return "TOXIC";
  }

  if (NON_TOXIC_LABELS.has(normalized)) {
    return "NON_TOXIC";
  }

  if (normalized.includes("non") && normalized.includes("toxic")) {
    return "NON_TOXIC";
  }

  if (normalized.includes("toxic")) {
    return "TOXIC";
  }

  return "UNKNOWN";
}

export function deriveToxicityScore(aiLabel, aiScore) {
  const score = clamp01(aiScore);
  if (score == null) {
    return null;
  }

  const classification = classifyModerationLabel(aiLabel);
  if (classification === "TOXIC") {
    return score;
  }

  if (classification === "NON_TOXIC") {
    return 1 - score;
  }

  return null;
}

export function getModerationAssessment(
  aiLabel,
  aiScore,
  sourceText = "",
  threshold = AUTO_FLAG_THRESHOLD
) {
  let classification = classifyModerationLabel(aiLabel);
  let toxicityScore = deriveToxicityScore(aiLabel, aiScore);
  const confidenceScore = clamp01(aiScore);
  const heuristicToxicityScore = estimateHeuristicToxicity(sourceText);
  let signalSource = "MODEL";

  if (
    typeof heuristicToxicityScore === "number" &&
    (typeof toxicityScore !== "number" || heuristicToxicityScore > toxicityScore)
  ) {
    toxicityScore = heuristicToxicityScore;
    classification = "TOXIC";
    signalSource = "HEURISTIC";
  }

  const shouldAutoFlag =
    classification === "TOXIC" &&
    typeof toxicityScore === "number" &&
    toxicityScore >= threshold;

  return {
    classification,
    toxicityScore,
    heuristicToxicityScore,
    confidenceScore,
    signalSource,
    shouldAutoFlag,
  };
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
    const assessment = getModerationAssessment(aiLabel, aiScore, content);
    if (!assessment.shouldAutoFlag) return;

    const existingAutoReport = await prisma.report.findFirst({
      where: {
        reporterUserId: authorId,
        postId,
        reason: {
          startsWith: AUTO_FLAG_REASON,
        },
      },
      select: { id: true },
    });

    if (existingAutoReport?.id) {
      await prisma.report.update({
        where: { id: existingAutoReport.id },
        data: {
          reason: AUTO_FLAG_REASON,
          aiScore,
          aiLabel,
          status: "PENDING",
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
      return;
    }

    await prisma.report.create({
      data: {
        reporterUserId: authorId,
        reason: AUTO_FLAG_REASON,
        postId,
        threadId: null,
        aiScore,
        aiLabel,
        status: "PENDING",
      },
    });
  } catch {
    // Intentionally silent: AI moderation must never crash the request flow.
  }
}
