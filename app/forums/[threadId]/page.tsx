"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  createThreadPoll,
  createThreadReply,
  deletePost,
  getPostRevisions,
  getThread,
  getThreadPoll,
  PostRevision,
  ThreadApiError,
  ThreadDetail,
  ThreadPoll,
  ThreadPost,
  updatePost,
  voteInPoll,
} from "@/lib/api/threads";
import { getTeams, type TeamOption } from "@/lib/api/sports";
import { useAuth } from "@/lib/context/auth";
import { ForumBadge, ForumTagPill, ForumTeamCrest, ForumUserAvatar } from "@/components/forums/forum-ui";

type RevisionState = {
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  revisions: PostRevision[];
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isPollClosed(deadline: string) {
  return new Date(deadline).getTime() <= Date.now();
}

function sortPosts(posts: ThreadPost[]) {
  return [...posts].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function mergePost(existing: ThreadPost, updated: ThreadPost) {
  return {
    ...existing,
    ...updated,
    author: updated.author ?? existing.author,
    parentPostId: updated.parentPostId ?? existing.parentPostId,
  };
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeCreatedPoll(
  threadId: string,
  poll: Awaited<ReturnType<typeof createThreadPoll>>
): ThreadPoll {
  const createdAt = poll.createdAt ?? new Date().toISOString();
  const updatedAt = poll.updatedAt ?? createdAt;

  return {
    id: poll.id,
    threadId: poll.threadId ?? threadId,
    question: poll.question,
    deadline: poll.deadline,
    createdAt,
    updatedAt,
    totalVotes: 0,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      position: option.position,
      votes: option.votes ?? 0,
    })),
  };
}

function PollCard({
  poll,
  isLoggedIn,
  hasVoted,
  isSubmittingVote,
  voteError,
  onVote,
}: {
  poll: ThreadPoll;
  isLoggedIn: boolean;
  hasVoted: boolean;
  isSubmittingVote: boolean;
  voteError: string | null;
  onVote: (optionId: string) => Promise<void>;
}) {
  const closed = isPollClosed(poll.deadline);
  const showVoteButtons = isLoggedIn && !closed && !hasVoted;

  return (
    <section className="rounded-2xl border border-slate-300/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/25 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ForumBadge tone="sky">Poll</ForumBadge>
            <ForumBadge tone={closed ? "warning" : "success"}>{closed ? "Closed" : "Open"}</ForumBadge>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {poll.question}
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Deadline: {formatTimestamp(poll.deadline)}</p>
      </div>

      <div className="mt-5 space-y-3">
        {poll.options.map((option) => {
          const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;

          return (
            <div
              key={option.id}
              className="space-y-2 rounded-xl border border-slate-300/80 bg-slate-100/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/70"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{option.text}</span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {option.votes} vote{option.votes === 1 ? "" : "s"} ({percentage}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-300/70 dark:bg-slate-700/70">
                <div
                  className="h-full rounded-full bg-sky-500 transition-[width]"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {showVoteButtons ? (
                <button
                  type="button"
                  onClick={() => onVote(option.id)}
                  disabled={isSubmittingVote}
                  className="rounded-full border border-sky-400/70 bg-sky-100/80 px-4 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-500 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200 dark:hover:bg-sky-500/30 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                >
                  {isSubmittingVote ? "Submitting..." : "Vote"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        <p>Total votes: {poll.totalVotes}</p>
        {!isLoggedIn && !closed ? <p>Log in to vote.</p> : null}
        {hasVoted ? <p>You have already voted in this poll.</p> : null}
        {closed ? <p>Voting for this poll has closed.</p> : null}
      </div>

      {voteError ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{voteError}</p> : null}
    </section>
  );
}

function PostCard({
  post,
  variant,
  canManage,
  isClosed,
  revisionState,
  isEditing,
  editDraft,
  editError,
  isSavingEdit,
  isDeleting,
  onEditStart,
  onEditCancel,
  onEditDraftChange,
  onEditSubmit,
  onDelete,
  onToggleHistory,
}: {
  post: ThreadPost;
  variant: "root" | "reply";
  canManage: boolean;
  isClosed: boolean;
  revisionState: RevisionState;
  isEditing: boolean;
  editDraft: string;
  editError: string | null;
  isSavingEdit: boolean;
  isDeleting: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditDraftChange: (value: string) => void;
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleHistory: () => Promise<void>;
}) {
  const isEdited = revisionState.revisions.length > 0;
  const isRoot = variant === "root";

  return (
    <article
      className={[
        "rounded-2xl border shadow-sm backdrop-blur",
        isRoot
          ? "border-slate-300/80 bg-white/95 p-6 dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/25"
          : "border-slate-300/75 bg-white/85 p-5 dark:border-slate-700/65 dark:bg-slate-900/75 dark:shadow-black/20",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ForumUserAvatar
            name={post.author?.username ?? "Unknown user"}
            imageUrl={post.author?.avatarUrl ?? null}
            className={isRoot ? "h-10 w-10" : "h-9 w-9"}
          />
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {post.author?.username ?? "Unknown user"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatTimestamp(post.createdAt)}
              {isEdited ? " • edited" : ""}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={isEditing ? onEditCancel : onEditStart}
              disabled={isDeleting || isClosed}
              className="rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={isDeleting || isSavingEdit || isClosed}
              className="rounded-full border border-red-300/80 bg-red-50/80 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100/80 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-400 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <form onSubmit={(event) => void onEditSubmit(event)} className="mt-4 space-y-3">
          <textarea
            value={editDraft}
            onChange={(event) => onEditDraftChange(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
            placeholder="Update your post"
            required
          />
          {editError ? <p className="text-sm text-red-600 dark:text-red-300">{editError}</p> : null}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSavingEdit}
              className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {isSavingEdit ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onEditCancel}
              disabled={isSavingEdit}
              className="rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div
          className={[
            "mt-4 whitespace-pre-wrap text-slate-800 dark:text-slate-200",
            isRoot ? "text-base leading-7" : "text-sm leading-6",
          ].join(" ")}
        >
          {post.content}
        </div>
      )}

      {isEdited || revisionState.isOpen ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => void onToggleHistory()}
            className="text-xs font-semibold text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
          >
            {revisionState.isOpen ? "Hide edit history" : "View edit history"}
          </button>

          {revisionState.isOpen ? (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-300/80 bg-slate-100/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/70">
              {revisionState.isLoading ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Loading revisions...</p>
              ) : null}
              {revisionState.error ? (
                <p className="text-sm text-red-600 dark:text-red-300">{revisionState.error}</p>
              ) : null}
              {!revisionState.isLoading && !revisionState.error && revisionState.revisions.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">No previous versions.</p>
              ) : null}
              {revisionState.revisions.map((revision) => (
                <div
                  key={revision.id}
                  className="rounded-xl border border-slate-300/80 bg-white/85 p-4 dark:border-slate-700/70 dark:bg-slate-900/80"
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {revision.editor.username} edited this on {formatTimestamp(revision.editedAt)}
                  </p>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                    {revision.previousContent}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params?.threadId ?? "";
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [poll, setPoll] = useState<ThreadPoll | null>(null);
  const [teamsById, setTeamsById] = useState<Record<string, TeamOption>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [activeEditPostId, setActiveEditPostId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string | null>>({});
  const [savingPostIds, setSavingPostIds] = useState<Record<string, boolean>>({});
  const [deletingPostIds, setDeletingPostIds] = useState<Record<string, boolean>>({});
  const [revisionStates, setRevisionStates] = useState<Record<string, RevisionState>>({});
  const [hasVotedPollIds, setHasVotedPollIds] = useState<Record<string, boolean>>({});
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [showCreatePollForm, setShowCreatePollForm] = useState(false);
  const [pollForm, setPollForm] = useState({
    question: "",
    deadline: "",
    options: ["", ""],
  });
  const [pollFormErrors, setPollFormErrors] = useState<{
    question?: string;
    deadline?: string;
    options?: string;
  }>({});
  const [pollFormError, setPollFormError] = useState<string | null>(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  useEffect(() => {
    if (!threadId) {
      return;
    }

    let cancelled = false;

    async function loadThreadPage() {
      setIsLoading(true);
      setLoadError(null);
      setVoteError(null);

      try {
        const [threadData, pollData, teamsData] = await Promise.all([
          getThread(threadId),
          getThreadPoll(threadId).catch((error) => {
            if (error instanceof ThreadApiError && error.status === 404) {
              return null;
            }

            throw error;
          }),
          getTeams().catch(() => []),
        ]);

        if (cancelled) {
          return;
        }

        setThread(threadData);
        setPoll(pollData);
        setTeamsById(
          Object.fromEntries(teamsData.map((team) => [team.id, team]))
        );
        setReplyDraft("");
        setReplyError(null);
        setActiveEditPostId(null);
        setEditDrafts({});
        setEditErrors({});
        setDeletingPostIds({});
        setSavingPostIds({});
        setRevisionStates({});
        setShowCreatePollForm(false);
        setPollForm({
          question: "",
          deadline: "",
          options: ["", ""],
        });
        setPollFormErrors({});
        setPollFormError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load thread.");
          setThread(null);
          setPoll(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadThreadPage();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  useEffect(() => {
    if (!thread) {
      return;
    }

    const posts = [thread.rootPost, ...thread.replies].filter((post): post is ThreadPost => Boolean(post));
    const missingRevisionPosts = posts.filter((post) => revisionStates[post.id] === undefined);

    if (missingRevisionPosts.length === 0) {
      return;
    }

    let cancelled = false;

    setRevisionStates((current) => {
      const next = { ...current };

      for (const post of missingRevisionPosts) {
        next[post.id] = {
          isLoading: true,
          error: null,
          isOpen: false,
          revisions: [],
        };
      }

      return next;
    });

    async function hydrateRevisions() {
      const results = await Promise.all(
        missingRevisionPosts.map(async (post) => {
          try {
            const revisions = await getPostRevisions(post.id);
            return { postId: post.id, revisions, error: null };
          } catch (error) {
            return {
              postId: post.id,
              revisions: [],
              error: error instanceof Error ? error.message : "Unable to load revisions.",
            };
          }
        })
      );

      if (cancelled) {
        return;
      }

      setRevisionStates((current) => {
        const next = { ...current };

        for (const result of results) {
          const previous = current[result.postId];
          next[result.postId] = {
            isLoading: false,
            error: result.error,
            isOpen: previous?.isOpen ?? false,
            revisions: result.revisions,
          };
        }

        return next;
      });
    }

    void hydrateRevisions();

    return () => {
      cancelled = true;
    };
  }, [thread, revisionStates]);

  if (isLoading) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Loading thread...</p>;
  }

  if (loadError) {
    return (
      <section className="mx-auto max-w-4xl rounded-2xl border border-red-300/80 bg-red-100/80 p-6 dark:border-red-600/60 dark:bg-red-900/20">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Thread unavailable</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{loadError}</p>
      </section>
    );
  }

  if (!thread) {
    return null;
  }

  const isClosed = thread.status !== "OPEN";
  const replies = sortPosts(thread.replies);
  const teamMeta = thread.teamId ? teamsById[thread.teamId] ?? null : null;
  const repliesCount = replies.length;
  const canReply = Boolean(user && token && !isClosed);
  const hasVotedInPoll = poll ? Boolean(hasVotedPollIds[poll.id]) : false;
  const canCreatePoll = Boolean(user && token && thread.author.id === user.id && !poll && !isClosed);

  async function reloadPoll() {
    if (!threadId) {
      return;
    }

    try {
      const refreshedPoll = await getThreadPoll(threadId);
      setPoll(refreshedPoll);
    } catch (error) {
      if (error instanceof ThreadApiError && error.status === 404) {
        setPoll(null);
        return;
      }

      throw error;
    }
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !thread) {
      setReplyError("You must be logged in to reply.");
      return;
    }

    setIsReplying(true);
    setReplyError(null);

    try {
      const createdPost = await createThreadReply(thread.id, token, { content: replyDraft });

      setThread((current) =>
        current
          ? {
              ...current,
              replies: sortPosts([...current.replies, createdPost]),
            }
          : current
      );
      setReplyDraft("");
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Unable to post reply.");
    } finally {
      setIsReplying(false);
    }
  }

  function startEditing(post: ThreadPost) {
    setActiveEditPostId(post.id);
    setEditDrafts((current) => ({ ...current, [post.id]: post.content }));
    setEditErrors((current) => ({ ...current, [post.id]: null }));
  }

  function cancelEditing(postId: string) {
    setActiveEditPostId((current) => (current === postId ? null : current));
    setEditErrors((current) => ({ ...current, [postId]: null }));
  }

  async function submitEdit(postId: string, isRootPost: boolean, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setEditErrors((current) => ({ ...current, [postId]: "You must be logged in to edit posts." }));
      return;
    }

    const content = editDrafts[postId] ?? "";

    setSavingPostIds((current) => ({ ...current, [postId]: true }));
    setEditErrors((current) => ({ ...current, [postId]: null }));

    try {
      const updatedPost = await updatePost(postId, token, { content });

      setThread((current) => {
        if (!current) {
          return current;
        }

        if (isRootPost && current.rootPost) {
          return {
            ...current,
            rootPost: mergePost(current.rootPost, updatedPost),
          };
        }

        return {
          ...current,
          replies: current.replies.map((reply) => (reply.id === postId ? mergePost(reply, updatedPost) : reply)),
        };
      });

      const refreshedRevisions = await getPostRevisions(postId);
      setRevisionStates((current) => ({
        ...current,
        [postId]: {
          isLoading: false,
          error: null,
          isOpen: current[postId]?.isOpen ?? false,
          revisions: refreshedRevisions,
        },
      }));
      setActiveEditPostId(null);
    } catch (error) {
      setEditErrors((current) => ({ ...current, [postId]: error instanceof Error ? error.message : "Unable to save changes." }));
    } finally {
      setSavingPostIds((current) => ({ ...current, [postId]: false }));
    }
  }

  async function handleDelete(postId: string, isRootPost: boolean) {
    if (!token) {
      return;
    }

    setDeletingPostIds((current) => ({ ...current, [postId]: true }));

    try {
      await deletePost(postId, token);
      setThread((current) => {
        if (!current) {
          return current;
        }

        if (isRootPost) {
          return {
            ...current,
            rootPost: null,
          };
        }

        return {
          ...current,
          replies: current.replies.filter((reply) => reply.id !== postId),
        };
      });
    } catch (error) {
      setEditErrors((current) => ({
        ...current,
        [postId]: error instanceof Error ? error.message : "Unable to delete post.",
      }));
    } finally {
      setDeletingPostIds((current) => ({ ...current, [postId]: false }));
    }
  }

  async function toggleHistory(postId: string) {
    const existingState = revisionStates[postId];

    if (!existingState) {
      return;
    }

    if (existingState.isOpen) {
      setRevisionStates((current) => ({
        ...current,
        [postId]: { ...current[postId], isOpen: false },
      }));
      return;
    }

    if (existingState.isLoading || existingState.revisions.length > 0 || existingState.error) {
      setRevisionStates((current) => ({
        ...current,
        [postId]: { ...current[postId], isOpen: true },
      }));
      return;
    }

    setRevisionStates((current) => ({
      ...current,
      [postId]: { ...current[postId], isLoading: true, error: null, isOpen: true },
    }));

    try {
      const revisions = await getPostRevisions(postId);
      setRevisionStates((current) => ({
        ...current,
        [postId]: {
          isLoading: false,
          error: null,
          isOpen: true,
          revisions,
        },
      }));
    } catch (error) {
      setRevisionStates((current) => ({
        ...current,
        [postId]: {
          ...current[postId],
          isLoading: false,
          error: error instanceof Error ? error.message : "Unable to load revisions.",
          isOpen: true,
        },
      }));
    }
  }

  async function handleVote(optionId: string) {
    if (!poll || !token) {
      setVoteError("You must be logged in to vote.");
      return;
    }

    setIsSubmittingVote(true);
    setVoteError(null);

    try {
      await voteInPoll(poll.id, token, { optionId });
      setHasVotedPollIds((current) => ({ ...current, [poll.id]: true }));
      await reloadPoll();
    } catch (error) {
      if (error instanceof ThreadApiError && error.status === 409) {
        setHasVotedPollIds((current) => ({ ...current, [poll.id]: true }));

        try {
          await reloadPoll();
        } catch {
          // Preserve the original conflict error if the refresh also fails.
        }
      }

      setVoteError(error instanceof Error ? error.message : "Unable to submit vote.");
    } finally {
      setIsSubmittingVote(false);
    }
  }

  function resetPollForm() {
    setPollForm({
      question: "",
      deadline: "",
      options: ["", ""],
    });
    setPollFormErrors({});
    setPollFormError(null);
    setShowCreatePollForm(false);
  }

  function validatePollForm() {
    const cleanedOptions = pollForm.options.map((option) => option.trim()).filter(Boolean);
    const nextErrors: typeof pollFormErrors = {};

    if (!pollForm.question.trim()) {
      nextErrors.question = "Poll question is required.";
    }

    if (!pollForm.deadline) {
      nextErrors.deadline = "A deadline is required.";
    } else if (new Date(pollForm.deadline).getTime() <= Date.now()) {
      nextErrors.deadline = "Deadline must be in the future.";
    }

    if (cleanedOptions.length < 2) {
      nextErrors.options = "Enter at least 2 poll options.";
    }

    setPollFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleCreatePoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !thread) {
      setPollFormError("You must be logged in to create a poll.");
      return;
    }

    if (!validatePollForm()) {
      return;
    }

    setIsCreatingPoll(true);
    setPollFormError(null);

    try {
      const createdPoll = await createThreadPoll(thread.id, token, {
        question: pollForm.question.trim(),
        deadline: new Date(pollForm.deadline).toISOString(),
        options: pollForm.options.map((option) => option.trim()).filter(Boolean),
      });

      setPoll(normalizeCreatedPoll(thread.id, createdPoll));
      resetPollForm();
    } catch (error) {
      setPollFormError(error instanceof Error ? error.message : "Unable to create poll.");
    } finally {
      setIsCreatingPoll(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/25 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/forums"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to Forums
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ForumBadge tone={isClosed ? "warning" : "success"}>{thread.status}</ForumBadge>
          <ForumBadge tone={thread.forumType === "TEAM" ? "sky" : "neutral"}>
            {thread.forumType === "TEAM" ? "Team Forum" : "General Forum"}
          </ForumBadge>
          {thread.teamId ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
              <ForumTeamCrest
                src={teamMeta?.crest ?? null}
                teamName={teamMeta?.name ?? `Team ${thread.teamId}`}
                className="h-4 w-4"
              />
              {teamMeta?.shortName ?? teamMeta?.name ?? `Team ${thread.teamId}`}
            </span>
          ) : null}
          {thread.matchId ? <ForumBadge tone="sky">Match Thread</ForumBadge> : null}
        </div>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          {thread.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>By {thread.author.username}</span>
          <span>{formatTimestamp(thread.createdAt)}</span>
          <span>{repliesCount} replies</span>
          <span>Views —</span>
        </div>

        {thread.tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {thread.tags.map((tag) => (
              <ForumTagPill key={tag}>{tag}</ForumTagPill>
            ))}
          </div>
        ) : null}

        {isClosed ? (
          <div className="mt-4 rounded-xl border border-amber-300/80 bg-amber-100/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-600/70 dark:bg-amber-900/20 dark:text-amber-200">
            This thread is closed. New replies are not available right now.
          </div>
        ) : null}
      </header>

      {poll ? (
        <PollCard
          poll={poll}
          isLoggedIn={Boolean(user && token)}
          hasVoted={hasVotedInPoll}
          isSubmittingVote={isSubmittingVote}
          voteError={voteError}
          onVote={handleVote}
        />
      ) : canCreatePoll ? (
        <section className="rounded-2xl border border-dashed border-slate-300/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75 dark:shadow-black/20 sm:p-6">
          {!showCreatePollForm ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create Poll</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Add one poll to this thread for readers to vote on.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePollForm(true)}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                Create Poll
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void handleCreatePoll(event)} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create Poll</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Polls need a question, at least 2 options, and a deadline.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Question</span>
                <input
                  type="text"
                  value={pollForm.question}
                  onChange={(event) => {
                    setPollForm((current) => ({ ...current, question: event.target.value }));
                    setPollFormError(null);
                    setPollFormErrors((current) => ({ ...current, question: undefined }));
                  }}
                  className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
                  placeholder="What should the community vote on?"
                  required
                />
                {pollFormErrors.question ? (
                  <p className="text-sm text-red-600 dark:text-red-300">{pollFormErrors.question}</p>
                ) : null}
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Options</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPollForm((current) => ({
                        ...current,
                        options: [...current.options, ""],
                      }))
                    }
                    className="rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80"
                  >
                    Add option
                  </button>
                </div>

                {pollForm.options.map((option, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      value={option}
                      onChange={(event) => {
                        setPollForm((current) => ({
                          ...current,
                          options: current.options.map((entry, entryIndex) =>
                            entryIndex === index ? event.target.value : entry
                          ),
                        }));
                        setPollFormError(null);
                        setPollFormErrors((current) => ({ ...current, options: undefined }));
                      }}
                      className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
                      placeholder={`Option ${index + 1}`}
                      required={index < 2}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPollForm((current) => ({
                          ...current,
                          options: current.options.filter((_, entryIndex) => entryIndex !== index),
                        }))
                      }
                      disabled={pollForm.options.length <= 2}
                      className="rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {pollFormErrors.options ? (
                  <p className="text-sm text-red-600 dark:text-red-300">{pollFormErrors.options}</p>
                ) : null}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Deadline</span>
                <input
                  type="datetime-local"
                  value={pollForm.deadline}
                  min={toDateTimeLocalValue(new Date().toISOString())}
                  onChange={(event) => {
                    setPollForm((current) => ({ ...current, deadline: event.target.value }));
                    setPollFormError(null);
                    setPollFormErrors((current) => ({ ...current, deadline: undefined }));
                  }}
                  className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
                  required
                />
                {pollFormErrors.deadline ? (
                  <p className="text-sm text-red-600 dark:text-red-300">{pollFormErrors.deadline}</p>
                ) : null}
              </label>

              {pollFormError ? <p className="text-sm text-red-600 dark:text-red-300">{pollFormError}</p> : null}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreatingPoll}
                  className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                >
                  {isCreatingPoll ? "Creating..." : "Create Poll"}
                </button>
                <button
                  type="button"
                  onClick={resetPollForm}
                  disabled={isCreatingPoll}
                  className="rounded-full border border-slate-300/80 bg-slate-100/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Main Post</h2>
        </div>

        {thread.rootPost ? (
          <PostCard
            post={thread.rootPost}
            variant="root"
            canManage={user?.id === thread.rootPost.author?.id}
            isClosed={isClosed}
            revisionState={
              revisionStates[thread.rootPost.id] ?? {
                isLoading: false,
                error: null,
                isOpen: false,
                revisions: [],
              }
            }
            isEditing={activeEditPostId === thread.rootPost.id}
            editDraft={editDrafts[thread.rootPost.id] ?? thread.rootPost.content}
            editError={editErrors[thread.rootPost.id] ?? null}
            isSavingEdit={Boolean(savingPostIds[thread.rootPost.id])}
            isDeleting={Boolean(deletingPostIds[thread.rootPost.id])}
            onEditStart={() => startEditing(thread.rootPost!)}
            onEditCancel={() => cancelEditing(thread.rootPost!.id)}
            onEditDraftChange={(value) =>
              setEditDrafts((current) => ({ ...current, [thread.rootPost!.id]: value }))
            }
            onEditSubmit={(event) => submitEdit(thread.rootPost!.id, true, event)}
            onDelete={() => handleDelete(thread.rootPost!.id, true)}
            onToggleHistory={() => toggleHistory(thread.rootPost!.id)}
          />
        ) : (
          <div className="rounded-2xl border border-slate-300/80 bg-white/85 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75 dark:text-slate-300 dark:shadow-black/20">
            The main post has been deleted.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Replies</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">{replies.length} posts</span>
        </div>

        {replies.length ? (
          replies.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              variant="reply"
              canManage={user?.id === post.author?.id}
              isClosed={isClosed}
              revisionState={
                revisionStates[post.id] ?? {
                  isLoading: false,
                  error: null,
                  isOpen: false,
                  revisions: [],
                }
              }
              isEditing={activeEditPostId === post.id}
              editDraft={editDrafts[post.id] ?? post.content}
              editError={editErrors[post.id] ?? null}
              isSavingEdit={Boolean(savingPostIds[post.id])}
              isDeleting={Boolean(deletingPostIds[post.id])}
              onEditStart={() => startEditing(post)}
              onEditCancel={() => cancelEditing(post.id)}
              onEditDraftChange={(value) => setEditDrafts((current) => ({ ...current, [post.id]: value }))}
              onEditSubmit={(event) => submitEdit(post.id, false, event)}
              onDelete={() => handleDelete(post.id, false)}
              onToggleHistory={() => toggleHistory(post.id)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-slate-300/80 bg-white/85 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75 dark:text-slate-300 dark:shadow-black/20">
            No replies yet.
          </div>
        )}
      </section>

      {canReply ? (
        <section className="rounded-2xl border border-slate-300/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/25 sm:p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reply to Thread</h2>
          <form onSubmit={(event) => void handleReplySubmit(event)} className="mt-4 space-y-4">
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              className="min-h-32 w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
              placeholder="Write your reply"
              required
            />
            {replyError ? <p className="text-sm text-red-600 dark:text-red-300">{replyError}</p> : null}
            <button
              type="submit"
              disabled={isReplying}
              className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {isReplying ? "Posting..." : "Post Reply"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-300/80 bg-slate-100/70 p-6 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">
          {isClosed
            ? "This thread is closed, so replies are disabled."
            : isAuthLoading
              ? "Checking your session..."
              : "Log in to reply to this thread."}
        </section>
      )}
    </section>
  );
}
