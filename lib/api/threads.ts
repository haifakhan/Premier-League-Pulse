type ApiErrorResponse = {
  error?: string;
};

type AuthorSummary = {
  id: string;
  username: string;
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

type VoteResponse = {
  vote: {
    id: string;
    pollId: string;
    optionId: string;
    userId: string;
    createdAt: string;
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
