const DEFAULT_DIGEST_MODEL = "facebook/bart-large-cnn";

function getDigestModel() {
  return process.env.HF_DIGEST_MODEL?.trim() || DEFAULT_DIGEST_MODEL;
}

function extractGeneratedText(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const first = payload[0];
    if (!first) return null;
    if (typeof payload[0]?.summary_text === "string") return payload[0].summary_text;
    if (typeof first.generated_text === "string") return first.generated_text;
    if (typeof first === "string") return first;
    return null;
  }

  if (typeof payload.generated_text === "string") return payload.generated_text;
  if (typeof payload.text === "string") return payload.text;

  return null;
}

export async function generateDigest(prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Digest service unavailable");
  }

  const model = getDigestModel();
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!response.ok) {
  const body = await response.text();
  console.error("HF digest non-OK response:", response.status, body);
  throw new Error("Digest service unavailable");
}

  let payload;
  try {
    payload = await response.json();
    console.error("HF digest payload:", payload);
  } catch {
    throw new Error("Digest service unavailable");
  }

  if (payload?.error) {
    throw new Error("Digest service unavailable");
  }

  const generatedText = extractGeneratedText(payload);
  if (!generatedText) {
    throw new Error("Digest service unavailable");
  }

  return {
    summary: generatedText.trim(),
    model,
  };
}

export { DEFAULT_DIGEST_MODEL };
