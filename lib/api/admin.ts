type ApiErrorResponse = {
  error?: string;
};

export type ModerationQueueItem = {
  id: string;
  targetType: "POST" | "THREAD";
  targetId: string;
  aiScore: number | null;
  aiLabel: string | null;
  latestReportedAt: string;
  pendingUserReportCount: number;
  pendingReportCount: number;
  post: { content: string } | null;
  thread: { title: string } | null;
};

type ModerationQueueResponse = {
  reports: ModerationQueueItem[];
};

type ModerationActionResponse = {
  success?: boolean;
  updatedReportsCount?: number;
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

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as T | ApiErrorResponse | null;

  if (!response.ok) {
    throw new AdminApiError(getApiErrorMessage(data, fallbackMessage), response.status);
  }

  if (!data) {
    throw new AdminApiError("Invalid server response", response.status);
  }

  return data as T;
}

function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getModerationQueue(token: string): Promise<ModerationQueueItem[]> {
  const data = await requestJson<ModerationQueueResponse>(
    "/api/admin/reports",
    {
      method: "GET",
      headers: buildAuthHeaders(token),
      cache: "no-store",
    },
    "Failed to load moderation queue"
  );

  return data.reports;
}

export async function approveModerationItem(reportId: string, token: string): Promise<void> {
  await requestJson<ModerationActionResponse>(
    `/api/admin/reports/${reportId}/approve`,
    {
      method: "POST",
      headers: buildAuthHeaders(token),
    },
    "Failed to approve report"
  );
}

export async function dismissModerationItem(reportId: string, token: string): Promise<void> {
  await requestJson<ModerationActionResponse>(
    `/api/admin/reports/${reportId}/dismiss`,
    {
      method: "POST",
      headers: buildAuthHeaders(token),
    },
    "Failed to dismiss report"
  );
}
