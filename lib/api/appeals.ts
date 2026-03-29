type ApiErrorResponse = {
  error?: string;
};

export type AppealStatus = "PENDING" | "APPROVED" | "REJECTED";

export type UserAppeal = {
  id: string;
  reason: string;
  status: AppealStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

export type UserAppealsState = {
  isBanned: boolean;
  appeals: UserAppeal[];
};

export type AdminAppeal = {
  id: string;
  reason: string;
  status: AppealStatus;
  createdAt: string;
  user: {
    id: string;
    username: string;
    isBanned: boolean;
  };
};

type UserAppealsResponse = {
  isBanned: boolean;
  appeals: UserAppeal[];
};

type SubmitAppealResponse = {
  appeal: UserAppeal;
};

type AdminAppealsResponse = {
  appeals: AdminAppeal[];
};

type AdminActionResponse = {
  success?: boolean;
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

export class AppealApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AppealApiError";
    this.status = status;
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as T | ApiErrorResponse | null;

  if (!response.ok) {
    throw new AppealApiError(getApiErrorMessage(data, fallbackMessage), response.status);
  }

  if (!data) {
    throw new AppealApiError("Invalid server response", response.status);
  }

  return data as T;
}

function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getMyAppeals(token: string): Promise<UserAppealsState> {
  return requestJson<UserAppealsResponse>(
    "/api/appeals",
    {
      method: "GET",
      headers: buildAuthHeaders(token),
      cache: "no-store",
    },
    "Failed to fetch appeals"
  );
}

export async function submitAppeal(token: string, reason: string): Promise<UserAppeal> {
  const data = await requestJson<SubmitAppealResponse>(
    "/api/appeals",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify({ reason }),
    },
    "Failed to submit appeal"
  );

  return data.appeal;
}

export async function getAdminAppeals(token: string): Promise<AdminAppeal[]> {
  const data = await requestJson<AdminAppealsResponse>(
    "/api/admin/appeals",
    {
      method: "GET",
      headers: buildAuthHeaders(token),
      cache: "no-store",
    },
    "Failed to fetch appeals queue"
  );

  return data.appeals;
}

export async function approveAppeal(appealId: string, token: string): Promise<void> {
  await requestJson<AdminActionResponse>(
    `/api/admin/appeals/${appealId}/approve`,
    {
      method: "POST",
      headers: buildAuthHeaders(token),
    },
    "Failed to approve appeal"
  );
}

export async function rejectAppeal(appealId: string, token: string): Promise<void> {
  await requestJson<AdminActionResponse>(
    `/api/admin/appeals/${appealId}/reject`,
    {
      method: "POST",
      headers: buildAuthHeaders(token),
    },
    "Failed to reject appeal"
  );
}
