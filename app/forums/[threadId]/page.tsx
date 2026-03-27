"use client";

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
import { useAuth } from "@/lib/context/auth";

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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">Poll</p>
          <h2 className="text-xl font-semibold text-slate-900">{poll.question}</h2>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>{closed ? "Closed" : "Open"}</p>
          <p>Deadline: {formatTimestamp(poll.deadline)}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {poll.options.map((option) => {
          const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;

          return (
            <div key={option.id} className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-slate-900">{option.text}</span>
                <span className="text-sm text-slate-600">
                  {option.votes} vote{option.votes === 1 ? "" : "s"} ({percentage}%)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
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
                  className="rounded-full border border-sky-600 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                >
                  {isSubmittingVote ? "Submitting..." : "Vote"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-sm text-slate-600">
        <p>Total votes: {poll.totalVotes}</p>
        {!isLoggedIn && !closed ? <p>Log in to vote.</p> : null}
        {hasVoted ? <p>You have already voted in this poll.</p> : null}
        {closed ? <p>Voting for this poll has closed.</p> : null}
      </div>

      {voteError ? <p className="mt-3 text-sm text-red-600">{voteError}</p> : null}
    </section>
  );
}

function PostCard({
  post,
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

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{post.author?.username ?? "Unknown user"}</p>
          <p className="text-sm text-slate-500">
            {formatTimestamp(post.createdAt)}
            {isEdited ? " • edited" : ""}
          </p>
        </div>

        {canManage ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={isEditing ? onEditCancel : onEditStart}
              disabled={isDeleting || isClosed}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={isDeleting || isSavingEdit || isClosed}
              className="rounded-full border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
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
            className="min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            placeholder="Update your post"
            required
          />
          {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSavingEdit}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingEdit ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onEditCancel}
              disabled={isSavingEdit}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 whitespace-pre-wrap text-slate-800">{post.content}</div>
      )}

      {isEdited || revisionState.isOpen ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => void onToggleHistory()}
            className="text-sm font-medium text-sky-700 transition hover:text-sky-600"
          >
            {revisionState.isOpen ? "Hide edit history" : "View edit history"}
          </button>

          {revisionState.isOpen ? (
            <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {revisionState.isLoading ? <p className="text-sm text-slate-600">Loading revisions...</p> : null}
              {revisionState.error ? <p className="text-sm text-red-600">{revisionState.error}</p> : null}
              {!revisionState.isLoading && !revisionState.error && revisionState.revisions.length === 0 ? (
                <p className="text-sm text-slate-600">No previous versions.</p>
              ) : null}
              {revisionState.revisions.map((revision) => (
                <div key={revision.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">
                    {revision.editor.username} edited this on {formatTimestamp(revision.editedAt)}
                  </p>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
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
        const [threadData, pollData] = await Promise.all([
          getThread(threadId),
          getThreadPoll(threadId).catch((error) => {
            if (error instanceof ThreadApiError && error.status === 404) {
              return null;
            }

            throw error;
          }),
        ]);

        if (cancelled) {
          return;
        }

        setThread(threadData);
        setPoll(pollData);
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
    return <p className="text-sm text-slate-600">Loading thread...</p>;
  }

  if (loadError) {
    return (
      <section className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Thread unavailable</h1>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
      </section>
    );
  }

  if (!thread) {
    return null;
  }

  const isClosed = thread.status !== "OPEN";
  const replies = sortPosts(thread.replies);
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
    <section className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">Forum Thread</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{thread.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Started by {thread.author.username} on {formatTimestamp(thread.createdAt)}
            </p>
          </div>

          {thread.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {isClosed ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {!showCreatePollForm ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Create Poll</h2>
                <p className="text-sm text-slate-600">Add one poll to this thread for readers to vote on.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePollForm(true)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Create Poll
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void handleCreatePoll(event)} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Create Poll</h2>
                <p className="text-sm text-slate-600">Polls need a question, at least 2 options, and a deadline.</p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Question</span>
                <input
                  type="text"
                  value={pollForm.question}
                  onChange={(event) => {
                    setPollForm((current) => ({ ...current, question: event.target.value }));
                    setPollFormError(null);
                    setPollFormErrors((current) => ({ ...current, question: undefined }));
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  placeholder="What should the community vote on?"
                  required
                />
                {pollFormErrors.question ? <p className="text-sm text-red-600">{pollFormErrors.question}</p> : null}
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-700">Options</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPollForm((current) => ({
                        ...current,
                        options: [...current.options, ""],
                      }))
                    }
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
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
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
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
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {pollFormErrors.options ? <p className="text-sm text-red-600">{pollFormErrors.options}</p> : null}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Deadline</span>
                <input
                  type="datetime-local"
                  value={pollForm.deadline}
                  min={toDateTimeLocalValue(new Date().toISOString())}
                  onChange={(event) => {
                    setPollForm((current) => ({ ...current, deadline: event.target.value }));
                    setPollFormError(null);
                    setPollFormErrors((current) => ({ ...current, deadline: undefined }));
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                  required
                />
                {pollFormErrors.deadline ? <p className="text-sm text-red-600">{pollFormErrors.deadline}</p> : null}
              </label>

              {pollFormError ? <p className="text-sm text-red-600">{pollFormError}</p> : null}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreatingPoll}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isCreatingPoll ? "Creating..." : "Create Poll"}
                </button>
                <button
                  type="button"
                  onClick={resetPollForm}
                  disabled={isCreatingPoll}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
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
          <h2 className="text-xl font-semibold text-slate-900">Main Post</h2>
        </div>

        {thread.rootPost ? (
          <PostCard
            post={thread.rootPost}
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            The main post has been deleted.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Replies</h2>
          <span className="text-sm text-slate-500">{replies.length} posts</span>
        </div>

        {replies.length ? (
          replies.map((post) => (
            <PostCard
              key={post.id}
              post={post}
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No replies yet.
          </div>
        )}
      </section>

      {canReply ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Reply to Thread</h2>
          <form onSubmit={(event) => void handleReplySubmit(event)} className="mt-4 space-y-4">
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              className="min-h-32 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
              placeholder="Write your reply"
              required
            />
            {replyError ? <p className="text-sm text-red-600">{replyError}</p> : null}
            <button
              type="submit"
              disabled={isReplying}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isReplying ? "Posting..." : "Post Reply"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
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
