type LoginInput = {
  email: string;
  password: string;
};

type SignupInput = {
  email: string;
  username: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  isBanned: boolean;
  favoriteTeamId: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
};

type MeResponse = {
  user: AuthUser;
};

type ApiErrorResponse = {
  error?: string;
};

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function postAuth<TInput>(url: string, body: TInput): Promise<AuthResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as
    | AuthResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    throw new AuthApiError(data?.error || "Request failed", response.status);
  }

  if (!data || typeof data !== "object" || !("token" in data) || !("user" in data)) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data;
}

export function login(payload: LoginInput) {
  return postAuth("/api/auth/login", payload);
}

export function signup(payload: SignupInput) {
  return postAuth("/api/auth/signup", payload);
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await response.json().catch(() => null)) as
    | MeResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    throw new AuthApiError(data?.error || "Request failed", response.status);
  }

  if (!data || typeof data !== "object" || !("user" in data)) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data.user;
}

export async function logout(token: string | null) {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    });
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  }
}
