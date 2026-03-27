import { AuthApiError, AuthUser, getCurrentUser } from "@/lib/api/auth";

type ApiErrorResponse = {
  error?: string;
};

type UserListItem = {
  id: string;
  username: string;
  avatarUrl: string | null;
  followedAt: string;
};

type UserListResponse = {
  users: UserListItem[];
};

type UpdateCurrentUserInput = {
  username: string;
  avatarUrl: string;
  favoriteTeamId: string | null;
};

type UpdateCurrentUserResponse = {
  user: AuthUser;
};

export type CurrentUserProfile = AuthUser & {
  followers: UserListItem[];
  following: UserListItem[];
  followerCount: number;
  followingCount: number;
};

async function parseJson<T>(response: Response): Promise<T | ApiErrorResponse | null> {
  return (await response.json().catch(() => null)) as T | ApiErrorResponse | null;
}

function getErrorMessage(data: unknown, fallback: string) {
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

async function getUserList(url: string, token: string, fallbackMessage: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await parseJson<UserListResponse>(response);

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(data, fallbackMessage), response.status);
  }

  if (!data || typeof data !== "object" || !("users" in data) || !Array.isArray(data.users)) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data.users;
}

export async function getMyProfile(token: string): Promise<CurrentUserProfile> {
  const [user, followers, following] = await Promise.all([
    getCurrentUser(token),
    getUserList("/api/users/me/followers", token, "Failed to fetch followers list"),
    getUserList("/api/users/me/following", token, "Failed to fetch following list"),
  ]);

  return {
    ...user,
    followers,
    following,
    followerCount: followers.length,
    followingCount: following.length,
  };
}

export async function updateMyProfile(
  token: string,
  payload: UpdateCurrentUserInput
): Promise<AuthUser> {
  const response = await fetch("/api/users/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson<UpdateCurrentUserResponse>(response);

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(data, "Request failed"), response.status);
  }

  if (!data || typeof data !== "object" || !("user" in data) || !data.user) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data.user;
}
