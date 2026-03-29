"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  createThreadPoll,
  createThreadReply,
  deletePoll,
  deletePost,
  deleteThread,
  getMatchThreadSentiment,
  getPostRevisions,
  getThread,
  getThreadPoll,
  MatchThreadSentiment,
  PostRevision,
  SentimentLabel,
  ThreadApiError,
  ThreadDetail,
  ThreadPoll,
  ThreadPost,
  updatePoll,
  updatePost,
  updateThread,
  voteInPoll,
} from "@/lib/api/threads";
import { createReport, REPORT_REASON_OPTIONS, type ReportReason, type ReportTargetType } from "@/lib/api/reports";
import { getTeams, type TeamOption } from "@/lib/api/sports";
import { useAuth } from "@/lib/context/auth";
import { ForumBadge, ForumTagPill, ForumTeamCrest, ForumUserLink } from "@/components/forums/forum-ui";
import ReportModal from "@/components/forums/report-modal";

type RevisionState = {
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  revisions: PostRevision[];
};

type ReportTarget = {
  targetType: ReportTargetType;
  targetId: string;
};

type ReportFormErrors = {
  reason?: string;
  details?: string;
  submit?: string;
};

type ReportToast = {
  tone: "success" | "error";
  message: string;
};

type TranslateApiResponse = {
  translation?: {
    translatedText?: string;
  };
  error?: string;
};

async function translatePostToEnglish(postId: string): Promise<string> {
  const response = await fetch("/api/ai/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ postId }),
  });

  const data = (await response.json().catch(() => null)) as TranslateApiResponse | null;

  if (!response.ok) {
    if (data?.error && data.error.trim()) {
      throw new Error(data.error);
    }
    throw new Error("Translation failed. Try again.");
  }

  const translatedText = data?.translation?.translatedText;
  if (typeof translatedText !== "string" || translatedText.trim().length === 0) {
    throw new Error("Translation failed. Try again.");
  }

  return translatedText.trim();
}

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

function toSentimentLabel(value: string | null | undefined): SentimentLabel {
  if (value === "positive" || value === "negative" || value === "mixed" || value === "neutral") {
    return value;
  }
  return "neutral";
}

function formatSentimentLabel(value: SentimentLabel): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sentimentPillClassName(value: SentimentLabel): string {
  if (value === "positive") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  }

  if (value === "negative") {
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  }

  if (value === "mixed") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }

  return "bg-slate-200/80 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300";
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EllipsisHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={["animate-spin", className ?? ""].join(" ").trim()}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type OverflowAction = {
  key: string;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

function OverflowMenu({
  label,
  actions,
  disabled = false,
}: {
  label: string;
  actions: OverflowAction[];
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const allActionsDisabled = actions.length === 0 || actions.every((action) => Boolean(action.disabled));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled || allActionsDisabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300/80 bg-slate-100/80 text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      >
        <EllipsisHorizontalIcon className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-30 mt-2 min-w-[140px] rounded-xl border border-slate-300/80 bg-white/95 p-1.5 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/90">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                if (action.disabled) {
                  return;
                }
                setIsOpen(false);
                action.onClick();
              }}
              disabled={action.disabled}
              className={[
                "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:text-slate-400 dark:disabled:text-slate-500",
                action.tone === "danger"
                  ? "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/90",
              ].join(" ")}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
    createdByUserId: poll.createdByUserId ?? "",
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
  replyAction,
  reportAction,
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
  replyAction?: {
    canReply: boolean;
    isOpen: boolean;
    draft: string;
    error: string | null;
    isSubmitting: boolean;
    onOpen: () => void;
    onCancel: () => void;
    onDraftChange: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  };
  reportAction?: {
    canReport: boolean;
    isDisabled?: boolean;
    onReport: () => void;
  };
}) {
  const isEdited = revisionState.revisions.length > 0;
  const isRoot = variant === "root";
  const canShowReplyButton = variant === "reply" && Boolean(replyAction?.canReply);
  const canShowReportButton = Boolean(reportAction?.canReport);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const postActions: OverflowAction[] = [];

  useEffect(() => {
    setIsTranslating(false);
    setTranslatedText(null);
    setIsShowingOriginal(false);
    setTranslationError(null);
  }, [post.id, post.content]);

  const displayedContent = translatedText && !isShowingOriginal ? translatedText : post.content;

  async function handleTranslate() {
    if (isTranslating) {
      return;
    }

    if (translatedText) {
      setIsShowingOriginal(false);
      setTranslationError(null);
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const translated = await translatePostToEnglish(post.id);
      setTranslatedText(translated);
      setIsShowingOriginal(false);
    } catch {
      setTranslationError("Translation failed. Try again.");
    } finally {
      setIsTranslating(false);
    }
  }

  if (canManage) {
    postActions.push({
      key: "edit",
      label: isEditing ? "Cancel Edit" : "Edit",
      onClick: isEditing ? onEditCancel : onEditStart,
      disabled: isDeleting || isClosed,
    });

    postActions.push({
      key: "delete",
      label: isDeleting ? "Deleting..." : "Delete",
      onClick: () => void onDelete(),
      tone: "danger",
      disabled: isDeleting || isSavingEdit || isClosed,
    });
  }

  if (canShowReportButton) {
    postActions.push({
      key: "report",
      label: "Report",
      onClick: () => reportAction?.onReport(),
      tone: "danger",
      disabled: Boolean(reportAction?.isDisabled),
    });
  }

  const canShowOverflowMenu = postActions.length > 0;

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
          <ForumUserLink
            userId={post.author?.id ?? null}
            username={post.author?.username ?? "Unknown user"}
            avatarUrl={post.author?.avatarUrl ?? null}
            avatarClassName={isRoot ? "h-10 w-10" : "h-9 w-9"}
            className="items-start"
            textClassName="text-base"
          />
          <div className="pt-0.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatTimestamp(post.createdAt)}
              {isEdited ? " • edited" : ""}
            </p>
          </div>
        </div>

        {canShowReplyButton || canShowOverflowMenu ? (
          <div className="flex gap-2">
            {canShowReplyButton ? (
              <button
                type="button"
                onClick={replyAction?.isOpen ? replyAction.onCancel : replyAction?.onOpen}
                disabled={isDeleting || isSavingEdit || isClosed || isEditing || Boolean(replyAction?.isSubmitting)}
                className="rounded-full border border-sky-300/80 bg-sky-100/80 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-sky-200/80 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-400 dark:border-sky-500/60 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                {replyAction?.isOpen ? "Cancel Reply" : "Reply"}
              </button>
            ) : null}
            {canShowOverflowMenu ? (
              <OverflowMenu
                actions={postActions}
                label={`${variant === "root" ? "Post" : "Reply"} options`}
              />
            ) : null}
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
          {displayedContent}
        </div>
      )}

      {!isEditing ? (
        <div className="mt-2 flex flex-col items-start gap-1.5">
          {isTranslating ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <SpinnerIcon className="h-3.5 w-3.5" />
              Translating...
            </span>
          ) : translatedText ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isShowingOriginal ? "Original" : "Translated"}{" "}
              <span className="text-slate-400 dark:text-slate-500">·</span>{" "}
              <button
                type="button"
                onClick={() => setIsShowingOriginal((current) => !current)}
                className="font-medium text-slate-600 underline-offset-2 transition hover:underline hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
              >
                {isShowingOriginal ? "Show translation" : "Show original"}
              </button>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleTranslate()}
              disabled={isDeleting || isSavingEdit}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-400 dark:hover:text-slate-300 dark:disabled:text-slate-600"
            >
              <span aria-hidden="true">🌐</span>
              Translate
            </button>
          )}

          {translationError ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{translationError}</p>
          ) : null}
        </div>
      ) : null}

      {replyAction?.isOpen && replyAction.canReply ? (
        <form
          onSubmit={(event) => void replyAction.onSubmit(event)}
          className="mt-4 space-y-3 rounded-xl border border-slate-300/80 bg-slate-100/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/70"
        >
          <textarea
            value={replyAction.draft}
            onChange={(event) => replyAction.onDraftChange(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-300/80 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-sky-500"
            placeholder="Write your reply"
            required
          />
          {replyAction.error ? <p className="text-sm text-red-600 dark:text-red-300">{replyAction.error}</p> : null}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={replyAction.isSubmitting}
              className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {replyAction.isSubmitting ? "Posting..." : "Post Reply"}
            </button>
            <button
              type="button"
              onClick={replyAction.onCancel}
              disabled={replyAction.isSubmitting}
              className="rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

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
                    <ForumUserLink
                      userId={revision.editor.id}
                      username={revision.editor.username}
                      showAvatar={false}
                      className="inline-flex rounded align-baseline"
                      textClassName="text-sm"
                    />{" "}
                    edited this on {formatTimestamp(revision.editedAt)}
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
  const router = useRouter();
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
  const [activeReplyTargetPostId, setActiveReplyTargetPostId] = useState<string | null>(null);
  const [replyDraftsByPostId, setReplyDraftsByPostId] = useState<Record<string, string>>({});
  const [replyErrorsByPostId, setReplyErrorsByPostId] = useState<Record<string, string | null>>({});
  const [replyingPostIds, setReplyingPostIds] = useState<Record<string, boolean>>({});
  const [activeEditPostId, setActiveEditPostId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string | null>>({});
  const [isEditingThread, setIsEditingThread] = useState(false);
  const [threadForm, setThreadForm] = useState({
    title: "",
    content: "",
  });
  const [threadFormError, setThreadFormError] = useState<string | null>(null);
  const [isSavingThread, setIsSavingThread] = useState(false);
  const [isDeletingThread, setIsDeletingThread] = useState(false);
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
  const [isEditingPoll, setIsEditingPoll] = useState(false);
  const [pollEditForm, setPollEditForm] = useState({
    question: "",
    deadline: "",
    options: ["", ""],
  });
  const [pollEditFormErrors, setPollEditFormErrors] = useState<{
    question?: string;
    deadline?: string;
    options?: string;
  }>({});
  const [pollEditError, setPollEditError] = useState<string | null>(null);
  const [isSavingPoll, setIsSavingPoll] = useState(false);
  const [isDeletingPoll, setIsDeletingPoll] = useState(false);
  const [activeReportTarget, setActiveReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>(REPORT_REASON_OPTIONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportErrors, setReportErrors] = useState<ReportFormErrors>({});
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportToast, setReportToast] = useState<ReportToast | null>(null);
  const [matchSentiment, setMatchSentiment] = useState<MatchThreadSentiment | null>(null);
  const [isSentimentLoading, setIsSentimentLoading] = useState(false);
  const [sentimentPollAttempts, setSentimentPollAttempts] = useState(0);

  const refetchMatchSentiment = useCallback(async (matchId: string) => {
    try {
      const sentiment = await getMatchThreadSentiment(matchId);
      setMatchSentiment(sentiment);
    } catch {
      // Keep existing sentiment state if passive refresh fails.
    }
  }, []);

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
        setActiveReplyTargetPostId(null);
        setReplyDraftsByPostId({});
        setReplyErrorsByPostId({});
        setReplyingPostIds({});
        setReplyDraft("");
        setReplyError(null);
        setActiveEditPostId(null);
        setEditDrafts({});
        setEditErrors({});
        setIsEditingThread(false);
        setThreadForm({
          title: threadData.title,
          content: threadData.rootPost?.content ?? "",
        });
        setThreadFormError(null);
        setIsSavingThread(false);
        setIsDeletingThread(false);
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
        setIsEditingPoll(false);
        setPollEditForm({
          question: pollData?.question ?? "",
          deadline: pollData ? toDateTimeLocalValue(pollData.deadline) : "",
          options: pollData?.options?.map((option) => option.text) ?? ["", ""],
        });
        setPollEditFormErrors({});
        setPollEditError(null);
        setIsSavingPoll(false);
        setIsDeletingPoll(false);
        setActiveReportTarget(null);
        setReportReason(REPORT_REASON_OPTIONS[0]);
        setReportDetails("");
        setReportErrors({});
        setIsSubmittingReport(false);
        setMatchSentiment(null);
        setIsSentimentLoading(false);
        setSentimentPollAttempts(0);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load thread.");
          setThread(null);
          setPoll(null);
          setMatchSentiment(null);
          setIsSentimentLoading(false);
          setSentimentPollAttempts(0);
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
    if (!reportToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setReportToast(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reportToast]);

  useEffect(() => {
    const matchId = thread?.matchId;

    if (!matchId) {
      setMatchSentiment(null);
      setIsSentimentLoading(false);
      setSentimentPollAttempts(0);
      return;
    }

    let cancelled = false;
    setIsSentimentLoading(true);
    setSentimentPollAttempts(0);

    getMatchThreadSentiment(matchId)
      .then((sentiment) => {
        if (cancelled) {
          return;
        }
        setMatchSentiment(sentiment);
        if (sentiment.generatedAt) {
          setSentimentPollAttempts(0);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setMatchSentiment(null);
        setSentimentPollAttempts(0);
      })
      .finally(() => {
        if (!cancelled) {
          setIsSentimentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [thread?.matchId]);

  useEffect(() => {
    const matchId = thread?.matchId;

    if (!matchId || !matchSentiment) {
      return;
    }

    if (matchSentiment.generatedAt || matchSentiment.commentCount === 0) {
      return;
    }

    if (sentimentPollAttempts >= 10) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSentimentPollAttempts((current) => current + 1);
      void refetchMatchSentiment(matchId);
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    thread?.matchId,
    matchSentiment,
    sentimentPollAttempts,
    refetchMatchSentiment,
  ]);

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
  const canManageThread = Boolean(user && token && user.id === thread.author.id);
  const canManagePoll = Boolean(user && token && poll && user.id === poll.createdByUserId);
  const canReportThread = Boolean(user && token && user.id !== thread.author.id);
  const isMatchThread = Boolean(thread.matchId);
  const hasGeneratedSentiment = Boolean(matchSentiment?.generatedAt && matchSentiment.commentCount > 0);
  const overallSentiment = toSentimentLabel(matchSentiment?.overall);
  const currentThread = thread;
  const rootPost = currentThread.rootPost;

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

  function cancelThreadEditing() {
    setIsEditingThread(false);
    setThreadForm({
      title: currentThread.title,
      content: rootPost?.content ?? "",
    });
    setThreadFormError(null);
  }

  async function handleThreadUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !rootPost) {
      setThreadFormError("Thread editing is unavailable right now.");
      return;
    }

    const title = threadForm.title.trim();
    const content = threadForm.content.trim();

    if (!title || !content) {
      setThreadFormError("Thread title and main post content are required.");
      return;
    }

    setIsSavingThread(true);
    setThreadFormError(null);

    try {
      const updatedThread = await updateThread(currentThread.id, token, { title, content });
      setThread((current) =>
        current
          ? {
              ...current,
              title: updatedThread.title,
              rootPost: updatedThread.rootPost ?? current.rootPost,
            }
          : current
      );

      const refreshedRevisions = await getPostRevisions(rootPost.id);
      setRevisionStates((current) => ({
        ...current,
        [rootPost.id]: {
          isLoading: false,
          error: null,
          isOpen: current[rootPost.id]?.isOpen ?? false,
          revisions: refreshedRevisions,
        },
      }));
      setIsEditingThread(false);
    } catch (error) {
      setThreadFormError(error instanceof Error ? error.message : "Unable to update thread.");
    } finally {
      setIsSavingThread(false);
    }
  }

  async function handleThreadDelete() {
    if (!token) {
      return;
    }

    setIsDeletingThread(true);
    setThreadFormError(null);

    try {
      await deleteThread(currentThread.id, token);
      router.push("/forums");
    } catch (error) {
      setIsDeletingThread(false);
      setThreadFormError(error instanceof Error ? error.message : "Unable to delete thread.");
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
      if (thread.matchId) {
        setSentimentPollAttempts(0);
        void refetchMatchSentiment(thread.matchId);
      }
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Unable to post reply.");
    } finally {
      setIsReplying(false);
    }
  }

  function openReplyComposer(post: ThreadPost) {
    if (!canReply) {
      return;
    }

    setActiveReplyTargetPostId(post.id);
    setReplyErrorsByPostId((current) => ({ ...current, [post.id]: null }));
    setReplyDraftsByPostId((current) => {
      const existingDraft = current[post.id];
      if (typeof existingDraft === "string" && existingDraft.length > 0) {
        return current;
      }

      const mentionPrefix = post.author?.username ? `@${post.author.username} ` : "";
      return { ...current, [post.id]: mentionPrefix };
    });
  }

  function closeReplyComposer(postId: string) {
    setActiveReplyTargetPostId((current) => (current === postId ? null : current));
    setReplyErrorsByPostId((current) => ({ ...current, [postId]: null }));
  }

  async function handleReplyToReplySubmit(postId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canReply) {
      setReplyErrorsByPostId((current) => ({
        ...current,
        [postId]: "Replies are currently unavailable.",
      }));
      return;
    }

    if (!token || !thread) {
      setReplyErrorsByPostId((current) => ({
        ...current,
        [postId]: "You must be logged in to reply.",
      }));
      return;
    }

    const content = replyDraftsByPostId[postId] ?? "";

    setReplyingPostIds((current) => ({ ...current, [postId]: true }));
    setReplyErrorsByPostId((current) => ({ ...current, [postId]: null }));

    try {
      const createdPost = await createThreadReply(thread.id, token, { content, parentPostId: postId });

      setThread((current) =>
        current
          ? {
              ...current,
              replies: sortPosts([...current.replies, createdPost]),
            }
          : current
      );
      setActiveReplyTargetPostId((current) => (current === postId ? null : current));
      setReplyDraftsByPostId((current) => ({ ...current, [postId]: "" }));
      if (thread.matchId) {
        setSentimentPollAttempts(0);
        void refetchMatchSentiment(thread.matchId);
      }
    } catch (error) {
      setReplyErrorsByPostId((current) => ({
        ...current,
        [postId]: error instanceof Error ? error.message : "Unable to post reply.",
      }));
    } finally {
      setReplyingPostIds((current) => ({ ...current, [postId]: false }));
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
      setActiveReplyTargetPostId((current) => (current === postId ? null : current));
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

    if (!token) {
      setPollFormError("You must be logged in to create a poll.");
      return;
    }

    if (!validatePollForm()) {
      return;
    }

    setIsCreatingPoll(true);
    setPollFormError(null);

    try {
      const createdPoll = await createThreadPoll(currentThread.id, token, {
        question: pollForm.question.trim(),
        deadline: new Date(pollForm.deadline).toISOString(),
        options: pollForm.options.map((option) => option.trim()).filter(Boolean),
      });

      setPoll(normalizeCreatedPoll(currentThread.id, createdPoll));
      setPollEditForm({
        question: createdPoll.question,
        deadline: toDateTimeLocalValue(createdPoll.deadline),
        options: createdPoll.options.map((option) => option.text),
      });
      resetPollForm();
    } catch (error) {
      setPollFormError(error instanceof Error ? error.message : "Unable to create poll.");
    } finally {
      setIsCreatingPoll(false);
    }
  }

  function cancelPollEditing() {
    setIsEditingPoll(false);
    setPollEditForm({
      question: poll?.question ?? "",
      deadline: poll ? toDateTimeLocalValue(poll.deadline) : "",
      options: poll?.options.map((option) => option.text) ?? ["", ""],
    });
    setPollEditFormErrors({});
    setPollEditError(null);
  }

  function validatePollEditForm() {
    const cleanedOptions = pollEditForm.options.map((option) => option.trim()).filter(Boolean);
    const nextErrors: typeof pollEditFormErrors = {};

    if (!pollEditForm.question.trim()) {
      nextErrors.question = "Poll question is required.";
    }

    if (!pollEditForm.deadline) {
      nextErrors.deadline = "A deadline is required.";
    } else if (new Date(pollEditForm.deadline).getTime() <= Date.now()) {
      nextErrors.deadline = "Deadline must be in the future.";
    }

    if (cleanedOptions.length < 2) {
      nextErrors.options = "Enter at least 2 poll options.";
    }

    setPollEditFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handlePollUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!poll || !token) {
      setPollEditError("Poll editing is unavailable right now.");
      return;
    }

    if (!validatePollEditForm()) {
      return;
    }

    setIsSavingPoll(true);
    setPollEditError(null);

    try {
      const updatedPoll = await updatePoll(poll.id, token, {
        question: pollEditForm.question.trim(),
        deadline: new Date(pollEditForm.deadline).toISOString(),
        options: pollEditForm.options.map((option) => option.trim()).filter(Boolean),
      });

      setPoll(updatedPoll);
      setPollEditForm({
        question: updatedPoll.question,
        deadline: toDateTimeLocalValue(updatedPoll.deadline),
        options: updatedPoll.options.map((option) => option.text),
      });
      setIsEditingPoll(false);
    } catch (error) {
      setPollEditError(error instanceof Error ? error.message : "Unable to update poll.");
    } finally {
      setIsSavingPoll(false);
    }
  }

  async function handlePollDelete() {
    if (!poll || !token) {
      return;
    }

    setIsDeletingPoll(true);
    setPollEditError(null);

    try {
      await deletePoll(poll.id, token);
      setPoll(null);
      setIsEditingPoll(false);
      setPollEditForm({
        question: "",
        deadline: "",
        options: ["", ""],
      });
    } catch (error) {
      setPollEditError(error instanceof Error ? error.message : "Unable to delete poll.");
      setIsDeletingPoll(false);
      return;
    }

    setIsDeletingPoll(false);
  }

  const threadActions: OverflowAction[] = [];

  if (canManageThread) {
    threadActions.push({
      key: "edit-thread",
      label: isEditingThread ? "Cancel Edit" : "Edit Thread",
      onClick: () => {
        if (isEditingThread) {
          cancelThreadEditing();
          return;
        }

        setIsEditingThread(true);
        setThreadForm({
          title: currentThread.title,
          content: rootPost?.content ?? "",
        });
        setThreadFormError(null);
      },
      disabled: isSavingThread || isDeletingThread || isClosed || !rootPost,
    });

    threadActions.push({
      key: "delete-thread",
      label: isDeletingThread ? "Deleting..." : "Delete Thread",
      onClick: () => void handleThreadDelete(),
      tone: "danger",
      disabled: isDeletingThread || isSavingThread,
    });
  }

  if (canReportThread) {
    threadActions.push({
      key: "report-thread",
      label: "Report",
      onClick: () => openReportModal("THREAD", currentThread.id, currentThread.author.id),
      tone: "danger",
    });
  }

  function openReportModal(targetType: ReportTargetType, targetId: string, targetAuthorId?: string | null) {
    if (!token || !user) {
      setReportToast({ tone: "error", message: "Log in to submit a report." });
      return;
    }

    if (targetAuthorId && user.id === targetAuthorId) {
      setReportToast({ tone: "error", message: "You cannot report your own content." });
      return;
    }

    setActiveReportTarget({ targetType, targetId });
    setReportReason(REPORT_REASON_OPTIONS[0]);
    setReportDetails("");
    setReportErrors({});
  }

  function closeReportModal() {
    if (isSubmittingReport) {
      return;
    }

    setActiveReportTarget(null);
    setReportErrors({});
  }

  async function handleSubmitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeReportTarget || !token) {
      setReportErrors({ submit: "You must be logged in to submit a report." });
      return;
    }

    const nextErrors: ReportFormErrors = {};
    const trimmedDetails = reportDetails.trim();

    if (reportReason === "Other" && !trimmedDetails) {
      nextErrors.details = "Details are required when reason is Other.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setReportErrors(nextErrors);
      return;
    }

    setIsSubmittingReport(true);
    setReportErrors({});

    try {
      await createReport(token, {
        targetType: activeReportTarget.targetType,
        targetId: activeReportTarget.targetId,
        reason: reportReason,
        details: trimmedDetails || undefined,
      });

      setActiveReportTarget(null);
      setReportReason(REPORT_REASON_OPTIONS[0]);
      setReportDetails("");
      setReportErrors({});
      setReportToast({ tone: "success", message: "Report submitted successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit report.";
      setReportErrors({ submit: message });
      setReportToast({ tone: "error", message });
    } finally {
      setIsSubmittingReport(false);
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
          {canManageThread || canReportThread ? (
            <OverflowMenu
              actions={threadActions}
              label="Thread options"
            />
          ) : null}
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
          <span className="inline-flex items-center gap-1.5">
            <span>By</span>
            <ForumUserLink
              userId={thread.author.id}
              username={thread.author.username}
              avatarUrl={thread.author.avatarUrl ?? null}
              showAvatar={false}
              className="rounded"
              textClassName="text-xs"
            />
          </span>
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

        {isEditingThread ? (
          <form onSubmit={(event) => void handleThreadUpdate(event)} className="mt-5 space-y-4 rounded-2xl border border-slate-300/80 bg-slate-100/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/70">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Thread Title</span>
              <input
                type="text"
                value={threadForm.title}
                onChange={(event) => {
                  setThreadForm((current) => ({ ...current, title: event.target.value }));
                  setThreadFormError(null);
                }}
                className="w-full rounded-xl border border-slate-300/80 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-sky-500"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Main Post</span>
              <textarea
                value={threadForm.content}
                onChange={(event) => {
                  setThreadForm((current) => ({ ...current, content: event.target.value }));
                  setThreadFormError(null);
                }}
                className="min-h-32 w-full rounded-xl border border-slate-300/80 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-sky-500"
                required
              />
            </label>

            {threadFormError ? <p className="text-sm text-red-600 dark:text-red-300">{threadFormError}</p> : null}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSavingThread}
                className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
              >
                {isSavingThread ? "Saving..." : "Save Thread"}
              </button>
              <button
                type="button"
                onClick={cancelThreadEditing}
                disabled={isSavingThread}
                className="rounded-full border border-slate-300/80 bg-slate-100/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : threadFormError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-300">{threadFormError}</p>
        ) : null}
      </header>

      {isMatchThread ? (
        isSentimentLoading && !matchSentiment ? (
          <section className="rounded-xl border border-slate-300/80 bg-slate-100/60 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-800/60">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200/90 dark:bg-slate-700/80" />
          </section>
        ) : (
          <section className="rounded-xl border border-slate-300/80 bg-slate-100/60 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-800/60">
            {hasGeneratedSentiment ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="inline-flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Thread Mood</span>
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                      sentimentPillClassName(overallSentiment),
                    ].join(" ")}
                  >
                    {formatSentimentLabel(overallSentiment)}
                  </span>
                </div>

                {matchSentiment?.teamSentiments?.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {matchSentiment.teamSentiments.map((team, index) => {
                      const label = toSentimentLabel(team.sentiment);
                      return (
                        <div key={team.teamId} className="inline-flex items-center gap-2">
                          {index > 0 ? (
                            <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                          ) : null}
                          <span className="text-xs text-slate-600 dark:text-slate-300">{team.teamName}</span>
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                              sentimentPillClassName(label),
                            ].join(" ")}
                          >
                            {formatSentimentLabel(label)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                  Based on {matchSentiment?.commentCount ?? 0} comments
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sentiment will appear once comments are posted.
              </p>
            )}
          </section>
        )
      ) : null}

      {poll ? (
        <div className="space-y-4">
          <PollCard
            poll={poll}
            isLoggedIn={Boolean(user && token)}
            hasVoted={hasVotedInPoll}
            isSubmittingVote={isSubmittingVote}
            voteError={voteError}
            onVote={handleVote}
          />

          {canManagePoll ? (
            <section className="rounded-2xl border border-dashed border-slate-300/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75 dark:shadow-black/20">
              {!isEditingPoll ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Manage Poll</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Update your poll question, deadline, or options, or remove the poll.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPoll(true);
                        setPollEditForm({
                          question: poll.question,
                          deadline: toDateTimeLocalValue(poll.deadline),
                          options: poll.options.map((option) => option.text),
                        });
                        setPollEditError(null);
                        setPollEditFormErrors({});
                      }}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                    >
                      Edit Poll
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePollDelete()}
                      disabled={isDeletingPoll}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isDeletingPoll ? "Deleting..." : "Delete Poll"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(event) => void handlePollUpdate(event)} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Poll</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      You can update the poll while the thread is still open.
                    </p>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Question</span>
                    <input
                      type="text"
                      value={pollEditForm.question}
                      onChange={(event) => {
                        setPollEditForm((current) => ({ ...current, question: event.target.value }));
                        setPollEditError(null);
                        setPollEditFormErrors((current) => ({ ...current, question: undefined }));
                      }}
                      className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
                      required
                    />
                    {pollEditFormErrors.question ? (
                      <p className="text-sm text-red-600 dark:text-red-300">{pollEditFormErrors.question}</p>
                    ) : null}
                  </label>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Options</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPollEditForm((current) => ({
                            ...current,
                            options: [...current.options, ""],
                          }))
                        }
                        className="rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80"
                      >
                        Add option
                      </button>
                    </div>

                    {pollEditForm.options.map((option, index) => (
                      <div key={`poll-edit-option-${index}`} className="flex gap-3">
                        <input
                          type="text"
                          value={option}
                          onChange={(event) => {
                            setPollEditForm((current) => ({
                              ...current,
                              options: current.options.map((entry, entryIndex) =>
                                entryIndex === index ? event.target.value : entry
                              ),
                            }));
                            setPollEditError(null);
                            setPollEditFormErrors((current) => ({ ...current, options: undefined }));
                          }}
                          className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
                          placeholder={`Option ${index + 1}`}
                          required={index < 2}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPollEditForm((current) => ({
                              ...current,
                              options: current.options.filter((_, entryIndex) => entryIndex !== index),
                            }))
                          }
                          disabled={pollEditForm.options.length <= 2}
                          className="rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:border-slate-300/70 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:border-slate-700/70 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    {pollEditFormErrors.options ? (
                      <p className="text-sm text-red-600 dark:text-red-300">{pollEditFormErrors.options}</p>
                    ) : null}
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Deadline</span>
                    <input
                      type="datetime-local"
                      value={pollEditForm.deadline}
                      min={toDateTimeLocalValue(new Date().toISOString())}
                      onChange={(event) => {
                        setPollEditForm((current) => ({ ...current, deadline: event.target.value }));
                        setPollEditError(null);
                        setPollEditFormErrors((current) => ({ ...current, deadline: undefined }));
                      }}
                      className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
                      required
                    />
                    {pollEditFormErrors.deadline ? (
                      <p className="text-sm text-red-600 dark:text-red-300">{pollEditFormErrors.deadline}</p>
                    ) : null}
                  </label>

                  {pollEditError ? <p className="text-sm text-red-600 dark:text-red-300">{pollEditError}</p> : null}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSavingPoll}
                      className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                    >
                      {isSavingPoll ? "Saving..." : "Save Poll"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPollEditing}
                      disabled={isSavingPoll}
                      className="rounded-full border border-slate-300/80 bg-slate-100/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          ) : null}
        </div>
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
            reportAction={{
              canReport: Boolean(
                user &&
                  token &&
                  thread.rootPost.author?.id &&
                  user.id !== thread.rootPost.author.id
              ),
              isDisabled: Boolean(deletingPostIds[thread.rootPost.id] || savingPostIds[thread.rootPost.id]),
              onReport: () =>
                openReportModal(
                  "POST",
                  thread.rootPost!.id,
                  thread.rootPost?.author?.id ?? null
                ),
            }}
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
              replyAction={{
                canReply,
                isOpen: activeReplyTargetPostId === post.id,
                draft: replyDraftsByPostId[post.id] ?? "",
                error: replyErrorsByPostId[post.id] ?? null,
                isSubmitting: Boolean(replyingPostIds[post.id]),
                onOpen: () => openReplyComposer(post),
                onCancel: () => closeReplyComposer(post.id),
                onDraftChange: (value) =>
                  setReplyDraftsByPostId((current) => ({
                    ...current,
                    [post.id]: value,
                  })),
                onSubmit: (event) => handleReplyToReplySubmit(post.id, event),
              }}
              reportAction={{
                canReport: Boolean(user && token && post.author?.id && user.id !== post.author.id),
                isDisabled: Boolean(deletingPostIds[post.id] || savingPostIds[post.id]),
                onReport: () => openReportModal("POST", post.id, post.author?.id ?? null),
              }}
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

      <ReportModal
        isOpen={Boolean(activeReportTarget)}
        targetType={activeReportTarget?.targetType ?? "THREAD"}
        reason={reportReason}
        details={reportDetails}
        errors={reportErrors}
        isSubmitting={isSubmittingReport}
        onReasonChange={(value) => {
          setReportReason(value);
          setReportErrors((current) => ({
            ...current,
            reason: undefined,
            details: undefined,
            submit: undefined,
          }));
        }}
        onDetailsChange={(value) => {
          setReportDetails(value);
          setReportErrors((current) => ({
            ...current,
            details: undefined,
            submit: undefined,
          }));
        }}
        onClose={closeReportModal}
        onSubmit={handleSubmitReport}
      />

      {reportToast ? (
        <div className="fixed right-4 bottom-4 z-50 max-w-sm rounded-xl border border-slate-300/80 bg-white/95 px-4 py-3 text-sm shadow-lg dark:border-slate-700/70 dark:bg-slate-900/90">
          <p className={reportToast.tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
            {reportToast.message}
          </p>
        </div>
      ) : null}
    </section>
  );
}
