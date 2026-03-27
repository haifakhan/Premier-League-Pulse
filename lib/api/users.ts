import { AuthApiError, AuthUser, getCurrentUser } from "@/lib/api/auth";

type ApiErrorResponse = {
  error?: string;
};

export type UserListItem = {
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

export type PublicUserThread = {
  id: string;
  title: string;
  createdAt: string;
};

export type PublicUserPost = {
  id: string;
  content: string;
  createdAt: string;
  threadId: string;
  parentPostId: string | null;
  kind: "ROOT" | "REPLY";
  threadTitle: string | null;
};

export type PublicUserProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  favoriteTeamId: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  threads: PublicUserThread[];
  posts: PublicUserPost[];
};

type PublicUserProfileResponse = {
  user: PublicUserProfile;
};

export type PublicUserActivityPoint = {
  date: string;
  count: number;
  threads: number;
  rootPosts: number;
  replies: number;
};

type PublicUserActivityResponse = {
  activity: PublicUserActivityPoint[];
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

export async function getMyFollowers(token: string): Promise<UserListItem[]> {
  return getUserList("/api/users/me/followers", token, "Failed to fetch followers list");
}

export async function getMyFollowing(token: string): Promise<UserListItem[]> {
  return getUserList("/api/users/me/following", token, "Failed to fetch following list");
}

export async function getMyProfile(token: string): Promise<CurrentUserProfile> {
  const [user, followers, following] = await Promise.all([
    getCurrentUser(token),
    getMyFollowers(token),
    getMyFollowing(token),
  ]);

  return {
    ...user,
    followers,
    following,
    followerCount: followers.length,
    followingCount: following.length,
  };
}

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile> {
  const response = await fetch(`/api/users/${userId}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJson<PublicUserProfileResponse>(response);

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(data, "Failed to fetch user profile"), response.status);
  }

  if (!data || typeof data !== "object" || !("user" in data) || !data.user) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data.user;
}

export async function getPublicUserActivity(
  userId: string,
  from: string,
  to: string
): Promise<PublicUserActivityPoint[]> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api/users/${userId}/activity?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJson<PublicUserActivityResponse>(response);

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(data, "Failed to fetch user activity"), response.status);
  }

  if (!data || typeof data !== "object" || !("activity" in data) || !Array.isArray(data.activity)) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data.activity;
}

async function mutateFollow(url: string, token: string, method: "POST" | "DELETE", fallbackMessage: string) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJson<{ success?: boolean }>(response);

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(data, fallbackMessage), response.status);
  }
}

export async function followUser(userId: string, token: string): Promise<void> {
  await mutateFollow(`/api/users/${userId}/follow`, token, "POST", "Failed to follow user");
}

export async function unfollowUser(userId: string, token: string): Promise<void> {
  await mutateFollow(`/api/users/${userId}/follow`, token, "DELETE", "Failed to unfollow user");
}

export async function removeFollower(followerId: string, token: string): Promise<void> {
  await mutateFollow(
    `/api/users/me/followers/${followerId}`,
    token,
    "DELETE",
    "Failed to remove follower"
  );
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
