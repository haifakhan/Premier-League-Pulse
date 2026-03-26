const TRANSLATION_MODEL = "Helsinki-NLP/opus-mt-mul-en";
const HF_TRANSLATE_URL = `https://router.huggingface.co/hf-inference/models/${TRANSLATION_MODEL}`;

function extractTranslation(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const first = payload[0];
    if (!first) return null;
    if (typeof first.translation_text === "string") return first.translation_text;
    if (typeof first.generated_text === "string") return first.generated_text;
    if (typeof first === "string") return first;
    return null;
  }

  if (typeof payload.translation_text === "string") return payload.translation_text;
  if (typeof payload.generated_text === "string") return payload.generated_text;

  if (
    Array.isArray(payload.translations) &&
    typeof payload.translations[0]?.translation_text === "string"
  ) {
    return payload.translations[0].translation_text;
  }

  return null;
}

export async function translateToEnglish(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Invalid translation input");
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Translation service unavailable");
  }

  const response = await fetch(HF_TRANSLATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    throw new Error("Translation service unavailable");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Translation service unavailable");
  }

  if (payload?.error) {
    throw new Error("Translation service unavailable");
  }

  const translatedText = extractTranslation(payload);
  if (!translatedText) {
    throw new Error("Translation service unavailable");
  }

  return {
    translatedText: translatedText.trim(),
    model: TRANSLATION_MODEL,
  };
}

export { TRANSLATION_MODEL };
