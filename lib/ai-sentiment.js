const SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest";
const HF_SENTIMENT_URL = `https://router.huggingface.co/hf-inference/models/${SENTIMENT_MODEL}`;

function normalizePredictions(payload) {
  if (!Array.isArray(payload)) return null;
  if (Array.isArray(payload[0])) return payload[0];
  return payload;
}

function mapLabel(label) {
  if (typeof label !== "string") return null;
  const normalized = label.trim().toLowerCase();

  if (normalized === "label_0" || normalized === "negative") return "negative";
  if (normalized === "label_1" || normalized === "neutral") return "neutral";
  if (normalized === "label_2" || normalized === "positive") return "positive";

  return null;
}

export async function analyzeSentiment(text) {
  const result = await analyzeSentimentDetailed(text);
  return result?.label ?? null;
}

export async function analyzeSentimentDetailed(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Sentiment service unavailable");
  }

  const response = await fetch(HF_SENTIMENT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    throw new Error("Sentiment service unavailable");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Sentiment service unavailable");
  }

  if (payload?.error) {
    throw new Error("Sentiment service unavailable");
  }

  const predictions = normalizePredictions(payload);
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return null;
  }

  let best = null;
  for (const entry of predictions) {
    if (!entry || typeof entry.score !== "number") continue;
    const mapped = mapLabel(entry.label);
    if (!mapped) continue;

    if (!best || entry.score > best.score) {
      best = { label: mapped, score: entry.score };
    }
  }

  if (!best) {
    return null;
  }

  return {
    label: best.label,
    score: best.score,
  };
}

export { SENTIMENT_MODEL };
