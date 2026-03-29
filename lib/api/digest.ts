type ApiErrorResponse = {
  error?: string;
};

export type DailyDigestSection = {
  title: string;
  content: string;
};

export type DailyDigest = {
  date: string;
  updatedAt: string;
  summary: string;
  sections: DailyDigestSection[];
  sources: {
    threadsConsidered: number;
    matchesConsidered: number;
    standingsTeamsConsidered: number;
  };
  model: string;
  cached?: boolean;
};

type DailyDigestResponse = {
  digest: DailyDigest;
};

function getApiErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim()
  ) {
    return data.error;
  }

  return fallback;
}

function normalizeSections(sections: unknown): DailyDigestSection[] {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const title =
        "title" in section && typeof section.title === "string"
          ? section.title.trim()
          : "";
      const content =
        "content" in section && typeof section.content === "string"
          ? section.content.trim()
          : "";

      if (!title || !content) {
        return null;
      }

      return { title, content };
    })
    .filter((section): section is DailyDigestSection => Boolean(section));
}

export class DigestApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DigestApiError";
    this.status = status;
  }
}

function normalizeDigest(digest: DailyDigest): DailyDigest {
  return {
    ...digest,
    summary: typeof digest.summary === "string" ? digest.summary : "",
    sections: normalizeSections(digest.sections),
    updatedAt:
      typeof digest.updatedAt === "string" && digest.updatedAt.trim()
        ? digest.updatedAt
        : new Date().toISOString(),
  };
}

export async function getDailyDigest(date?: string): Promise<DailyDigest> {
  const query = new URLSearchParams();

  if (typeof date === "string" && date.trim()) {
    query.set("date", date.trim());
  }

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/digest/daily?${queryString}`
    : "/api/digest/daily";

  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | DailyDigestResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    throw new DigestApiError(
      getApiErrorMessage(data, "Unable to load daily digest."),
      response.status
    );
  }

  if (!data || typeof data !== "object" || !("digest" in data) || !data.digest) {
    throw new DigestApiError("Invalid server response", response.status);
  }

  return normalizeDigest(data.digest);
}
