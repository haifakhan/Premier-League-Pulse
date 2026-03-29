type ApiErrorResponse = {
  error?: string;
};

type AuthorSummary = {
  id: string;
  username: string;
  avatarUrl?: string | null;
};

export type ThreadPost = {
  id: string;
  content: string;
  kind: "ROOT" | "REPLY";
  createdAt: string;
  updatedAt?: string;
  author?: AuthorSummary;
  parentPostId: string | null;
};

export type ThreadDetail = {
  id: string;
  title: string;
  forumType: string;
  teamId: string | null;
  matchId: string | null;
  status: "OPEN" | "CLOSED" | string;
  createdAt: string;
  author: AuthorSummary;
  tags: string[];
  rootPost: ThreadPost | null;
  replies: ThreadPost[];
};

export type PostRevision = {
  id: string;
  previousContent: string;
  editedAt: string;
  editor: AuthorSummary;
};

export type PollOption = {
  id: string;
  text: string;
  position: number;
  votes: number;
};

export type ThreadPoll = {
  id: string;
  threadId: string;
  createdByUserId: string;
  question: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  totalVotes: number;
  options: PollOption[];
};

type GetThreadResponse = {
  thread: ThreadDetail;
};

type ListThreadsResponse = {
  threads: Array<{
    id: string;
    title: string;
    forumType: string;
    teamId: string | null;
    matchId: string | null;
    status: "OPEN" | "CLOSED" | string;
    createdAt: string;
    author: AuthorSummary;
    tags?: string[];
    postsCount?: number;
  }>;
};

type CreateThreadResponse = {
  thread: {
    id: string;
    title: string;
    forumType: string;
    teamId: string | null;
    matchId: string | null;
    status: "OPEN" | "CLOSED" | string;
    createdAt: string;
  };
};

type CreatePostResponse = {
  post: ThreadPost;
};

type UpdatePostResponse = {
  post: ThreadPost;
};

type RevisionsResponse = {
  revisions: PostRevision[];
};

type PollResponse = {
  poll: ThreadPoll;
};

type CreatePollResponse = {
  poll: {
    id: string;
    threadId: string;
    createdByUserId?: string;
    question: string;
    deadline: string;
    createdAt?: string;
    updatedAt?: string;
    options: Array<{
      id: string;
      text: string;
      position: number;
      votes?: number;
    }>;
  };
};

type VoteResponse = {
  vote: {
    id: string;
    pollId: string;
    optionId: string;
    userId: string;
    createdAt: string;
  };
};

type TagsResponse =
  | {
      tags?: Array<string | { name?: string }>;
    }
  | Array<string | { name?: string }>;

export type MatchThreadAvailability = {
  matchId: string;
  availability: "PRE_WINDOW" | "OPEN_WINDOW" | "POST_WINDOW" | "INVALID" | string;
  window: {
    opensAt: string | null;
    closesAt: string | null;
    matchStart: string | null;
    matchEnd: string | null;
  };
  thread: {
    id: string;
    status: "OPEN" | "CLOSED" | string;
    url: string;
  } | null;
  canPost: boolean;
  syncedAction: string;
};

export type SentimentLabel = "positive" | "negative" | "mixed" | "neutral";

export type MatchThreadSentimentTeam = {
  teamId: string;
  teamName: string;
  sentiment: SentimentLabel;
  score: number;
};

export type MatchThreadSentiment = {
  overall: SentimentLabel;
  teamSentiments: MatchThreadSentimentTeam[];
  commentCount: number;
  generatedAt: string | null;
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

export class ThreadApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ThreadApiError";
    this.status = status;
  }
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as T | ApiErrorResponse | null;

  if (!response.ok) {
    throw new ThreadApiError(getApiErrorMessage(data, fallbackMessage), response.status);
  }

  if (!data) {
    throw new ThreadApiError("Invalid server response", response.status);
  }

  return data as T;
}

function buildAuthHeaders(token?: string | null) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  const data = await requestJson<GetThreadResponse>(
    `/api/threads/${threadId}`,
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch thread"
  );

  return data.thread;
}

export async function listThreads(): Promise<ListThreadsResponse["threads"]> {
  const data = await requestJson<ListThreadsResponse>(
    "/api/threads",
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch threads"
  );

  return data.threads;
}

export async function getMatchThreadAvailability(
  matchId: string | number
): Promise<MatchThreadAvailability> {
  const data = await requestJson<MatchThreadAvailability>(
    `/api/threads/match/${String(matchId)}`,
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch match discussion thread"
  );

  return data;
}

export async function getMatchThreadSentiment(
  matchId: string | number
): Promise<MatchThreadSentiment> {
  return requestJson<MatchThreadSentiment>(
    `/api/matches/${String(matchId)}/sentiment`,
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch match thread sentiment"
  );
}

export async function createThread(
  token: string,
  payload: {
    title: string;
    content: string;
    teamId: string | null;
    tags: string[];
    forumType: "GENERAL" | "TEAM";
  }
): Promise<CreateThreadResponse["thread"]> {
  const data = await requestJson<CreateThreadResponse>(
    "/api/threads",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to create thread"
  );

  return data.thread;
}

type UpdateThreadResponse = {
  thread: ThreadDetail;
};

function normalizeTagEntry(entry: string | { name?: string } | null | undefined): string | null {
  if (typeof entry === "string") {
    const normalized = entry.trim().toLowerCase();
    return normalized || null;
  }

  if (entry && typeof entry === "object" && typeof entry.name === "string") {
    const normalized = entry.name.trim().toLowerCase();
    return normalized || null;
  }

  return null;
}

async function getTagsFromThreads(): Promise<string[]> {
  const threads = await listThreads();
  const tagSet = new Set<string>();

  for (const thread of threads) {
    if (!Array.isArray(thread.tags)) {
      continue;
    }

    for (const tag of thread.tags) {
      const normalized = normalizeTagEntry(tag);
      if (normalized) {
        tagSet.add(normalized);
      }
    }
  }

  return [...tagSet].sort((left, right) => left.localeCompare(right));
}

async function getTagsFromTagsEndpoint(): Promise<string[]> {
  const data = await requestJson<TagsResponse>(
    "/api/tags",
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch tags"
  );

  const rawTags = Array.isArray(data) ? data : Array.isArray(data.tags) ? data.tags : [];
  const tagSet = new Set<string>();

  for (const entry of rawTags) {
    const normalized = normalizeTagEntry(entry);
    if (normalized) {
      tagSet.add(normalized);
    }
  }

  return [...tagSet].sort((left, right) => left.localeCompare(right));
}

export async function getTagSuggestions(): Promise<string[]> {
  try {
    const threadTags = await getTagsFromThreads();
    if (threadTags.length > 0) {
      return threadTags;
    }
  } catch {
    // Fall through to the optional tags endpoint.
  }

  try {
    return await getTagsFromTagsEndpoint();
  } catch (error) {
    if (error instanceof ThreadApiError && error.status === 404) {
      return [];
    }

    return [];
  }
}

export async function createThreadReply(
  threadId: string,
  token: string,
  payload: { content: string; parentPostId?: string | null }
): Promise<ThreadPost> {
  const data = await requestJson<CreatePostResponse>(
    `/api/threads/${threadId}/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to create post"
  );

  return data.post;
}

export async function updateThread(
  threadId: string,
  token: string,
  payload: { title?: string; content?: string }
): Promise<ThreadDetail> {
  const data = await requestJson<UpdateThreadResponse>(
    `/api/threads/${threadId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to update thread"
  );

  return data.thread;
}

export async function deleteThread(threadId: string, token: string): Promise<void> {
  await requestJson<{ ok?: boolean }>(
    `/api/threads/${threadId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    },
    "Failed to delete thread"
  );
}

export async function updatePost(
  postId: string,
  token: string,
  payload: { content: string }
): Promise<ThreadPost> {
  const data = await requestJson<UpdatePostResponse>(
    `/api/posts/${postId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to update post"
  );

  return data.post;
}

export async function deletePost(postId: string, token: string): Promise<void> {
  await requestJson<{ success?: boolean }>(
    `/api/posts/${postId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    },
    "Failed to delete post"
  );
}

export async function getPostRevisions(postId: string): Promise<PostRevision[]> {
  const data = await requestJson<RevisionsResponse>(
    `/api/posts/${postId}/revisions`,
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch revisions"
  );

  return data.revisions;
}

export async function getThreadPoll(threadId: string): Promise<ThreadPoll> {
  const data = await requestJson<PollResponse>(
    `/api/threads/${threadId}/poll`,
    {
      method: "GET",
      cache: "no-store",
    },
    "Failed to fetch poll"
  );

  return data.poll;
}

export async function createThreadPoll(
  threadId: string,
  token: string,
  payload: {
    question: string;
    deadline: string;
    options: string[];
  }
): Promise<CreatePollResponse["poll"]> {
  const data = await requestJson<CreatePollResponse>(
    `/api/threads/${threadId}/poll`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to create poll"
  );

  return data.poll;
}

export async function updatePoll(
  pollId: string,
  token: string,
  payload: {
    question?: string;
    deadline?: string;
    options?: string[];
  }
): Promise<ThreadPoll> {
  const data = await requestJson<PollResponse>(
    `/api/polls/${pollId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to update poll"
  );

  return data.poll;
}

export async function deletePoll(pollId: string, token: string): Promise<void> {
  await requestJson<{ ok?: boolean }>(
    `/api/polls/${pollId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    },
    "Failed to delete poll"
  );
}

export async function voteInPoll(
  pollId: string,
  token: string,
  payload: { optionId: string }
): Promise<VoteResponse["vote"]> {
  const data = await requestJson<VoteResponse>(
    `/api/polls/${pollId}/vote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      body: JSON.stringify(payload),
    },
    "Failed to submit vote"
  );

  return data.vote;
}
