type ApiErrorResponse = {
  error?: string;
};

export const REPORT_REASON_OPTIONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Offensive content",
  "Misinformation",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASON_OPTIONS)[number];
export type ReportTargetType = "POST" | "THREAD";

export type CreateReportPayload = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

type CreateReportResponse = {
  report: {
    id: string;
    reporterUserId: string;
    reason: string;
    status: "PENDING" | "APPROVED" | "DISMISSED" | string;
    postId: string | null;
    threadId: string | null;
    createdAt: string;
    aiScore: number | null;
    aiLabel: string | null;
  };
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

export class ReportApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReportApiError";
    this.status = status;
  }
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as T | ApiErrorResponse | null;

  if (!response.ok) {
    throw new ReportApiError(getApiErrorMessage(data, fallbackMessage), response.status);
  }

  if (!data) {
    throw new ReportApiError("Invalid server response", response.status);
  }

  return data as T;
}

export async function createReport(token: string, payload: CreateReportPayload): Promise<CreateReportResponse["report"]> {
  const body = {
    ...payload,
    details: typeof payload.details === "string" ? payload.details : undefined,
  };

  const data = await requestJson<CreateReportResponse>(
    "/api/reports",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    "Failed to submit report"
  );

  return data.report;
}
