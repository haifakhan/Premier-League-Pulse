import { AuthApiError } from "@/lib/api/auth";

type ApiErrorResponse = {
  error?: string;
};

type FeedActor = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type ThreadCreatedFeedItem = {
  type: "THREAD_CREATED";
  threadId: string;
  threadTitle: string;
  createdAt: string;
  matchId: string | null;
  forumType: string;
  teamId: string | null;
  preview: string | null;
  author: FeedActor;
  reasons: Array<"FOLLOWED_USER" | "FAVORITE_TEAM_FORUM" | "FAVORITE_TEAM_MATCH_THREAD">;
};

export type RepliesToMyPostFeedItem = {
  type: "REPLIES_TO_MY_POST";
  postId: string;
  threadId: string | null;
  threadTitle: string | null;
  latestReplyId: string;
  replyCount: number;
  actors: FeedActor[];
  latestActor: FeedActor;
  createdAt: string;
};

export type FollowedUsersRepliedFeedItem = {
  type: "FOLLOWED_USERS_REPLIED";
  threadId: string;
  threadTitle: string;
  latestReplyId: string;
  replyCount: number;
  actors: FeedActor[];
  latestActor: FeedActor;
  createdAt: string;
};

export type FavoriteTeamMatchResultFeedItem = {
  type: "FAVORITE_TEAM_MATCH_RESULT";
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  score: {
    home: number | null;
    away: number | null;
  };
  createdAt: string;
};

export type FeedItem =
  | ThreadCreatedFeedItem
  | RepliesToMyPostFeedItem
  | FollowedUsersRepliedFeedItem
  | FavoriteTeamMatchResultFeedItem;

type FeedResponse = {
  feed: FeedItem[];
};

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

export async function getFeed(token: string): Promise<FeedItem[]> {
  const response = await fetch("/api/feed", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as FeedResponse | ApiErrorResponse | null;

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(data, "Failed to fetch feed"), response.status);
  }

  if (!data || typeof data !== "object" || !("feed" in data) || !Array.isArray(data.feed)) {
    throw new AuthApiError("Invalid server response", response.status);
  }

  return data.feed;
}
