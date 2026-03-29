"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approveModerationItem,
  banUser,
  dismissModerationItem,
  getModerationQueue,
  unbanUser,
  type ModerationFilter,
  type ModerationQueueItem,
} from "@/lib/api/admin";
import { useAuth } from "@/lib/context/auth";

const FILTER_OPTIONS: Array<{
  value: ModerationFilter;
  label: string;
  emptyMessage: string;
}> = [
  {
    value: "all",
    label: "All",
    emptyMessage: "No moderation items right now.",
  },
  {
    value: "pending",
    label: "Pending",
    emptyMessage: "No pending moderation items right now.",
  },
  {
    value: "dismissed",
    label: "Dismissed",
    emptyMessage: "No dismissed moderation items yet.",
  },
  {
    value: "user-reported",
    label: "User Reported",
    emptyMessage: "No pending user-reported items right now.",
  },
  {
    value: "approved-hidden",
    label: "Approved & Hidden",
    emptyMessage: "No approved and hidden items yet.",
  },
  {
    value: "banned-users",
    label: "Banned Users",
    emptyMessage: "No moderation items for banned users right now.",
  },
];

type ActionState = {
  action: "approve" | "dismiss" | "ban" | "unban";
  isLoading: boolean;
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAiScore(score: number | null): string {
  if (typeof score !== "number") {
    return "N/A";
  }

  return `${Math.round(score * 100)}%`;
}

function formatVerdict(value: ModerationQueueItem["verdict"]): string {
  if (value === "LIKELY_INAPPROPRIATE") {
    return "Likely inappropriate";
  }

  if (value === "LIKELY_ACCEPTABLE") {
    return "Likely acceptable";
  }

  return "Unknown";
}

function formatStatus(value: ModerationQueueItem["status"]): string {
  if (value === "PENDING") {
    return "Pending";
  }

  if (value === "DISMISSED") {
    return "Dismissed";
  }

  return "Approved";
}

function statusBadgeClassName(value: ModerationQueueItem["status"]): string {
  if (value === "PENDING") {
    return "border-amber-300/80 bg-amber-100 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (value === "DISMISSED") {
    return "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200";
  }

  return "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200";
}

function getPreview(item: ModerationQueueItem): string {
  if (item.targetType === "POST") {
    const content = item.post?.content?.trim() ?? "";
    return content.length > 160 ? `${content.slice(0, 160)}...` : content || "(No content preview available)";
  }

  const title = item.thread?.title?.trim() ?? "";
  return title || "(No title preview available)";
}

export default function AdminModerationPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  const [activeFilter, setActiveFilter] = useState<ModerationFilter>("all");
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionById, setActionById] = useState<Record<string, ActionState | undefined>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user || user.role !== "ADMIN" || typeof token !== "string") {
      setIsQueueLoading(false);
      return;
    }
    const authToken = token;

    let cancelled = false;

    async function loadQueue() {
      setIsQueueLoading(true);
      setErrorMessage(null);

      try {
        const items = await getModerationQueue(authToken, activeFilter);

        if (!cancelled) {
          setQueue(items);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load moderation queue.");
          setQueue([]);
        }
      } finally {
        if (!cancelled) {
          setIsQueueLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, [activeFilter, isLoading, token, user]);

  const activeFilterOption = useMemo(
    () => FILTER_OPTIONS.find((option) => option.value === activeFilter) ?? FILTER_OPTIONS[0],
    [activeFilter]
  );

  async function refreshQueue() {
    if (!token) {
      return;
    }

    const items = await getModerationQueue(token, activeFilter);
    setQueue(items);
  }

  async function handleAction(item: ModerationQueueItem, action: "approve" | "dismiss") {
    if (!token) {
      setErrorMessage("You must be logged in as an admin.");
      return;
    }

    setActionById((current) => ({
      ...current,
      [item.id]: { action, isLoading: true },
    }));
    setErrorMessage(null);
    setNotice(null);

    try {
      if (action === "approve") {
        await approveModerationItem(item.id, token);
      } else {
        await dismissModerationItem(item.id, token);
      }

      await refreshQueue();
      setNotice(action === "approve" ? "Item approved and hidden." : "Item dismissed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to process moderation action.");
    } finally {
      setActionById((current) => ({
        ...current,
        [item.id]: undefined,
      }));
    }
  }

  async function handleBanToggle(item: ModerationQueueItem) {
    if (!token) {
      setErrorMessage("You must be logged in as an admin.");
      return;
    }

    const targetAuthor = item.targetAuthor;
    if (!targetAuthor) {
      setErrorMessage("Unable to identify the reported content author.");
      return;
    }

    const action = targetAuthor.isBanned ? "unban" : "ban";

    setActionById((current) => ({
      ...current,
      [item.id]: { action, isLoading: true },
    }));
    setErrorMessage(null);
    setNotice(null);

    try {
      if (action === "ban") {
        await banUser(targetAuthor.id, token);
      } else {
        await unbanUser(targetAuthor.id, token);
      }

      if (activeFilter === "banned-users" && action === "unban") {
        await refreshQueue();
        setNotice(`User @${targetAuthor.username} was unbanned.`);
        return;
      }

      setQueue((current) =>
        current.map((entry) => {
          if (!entry.targetAuthor || entry.targetAuthor.id !== targetAuthor.id) {
            return entry;
          }

          return {
            ...entry,
            targetAuthor: {
              ...entry.targetAuthor,
              isBanned: action === "ban",
            },
          };
        })
      );
      setNotice(
        action === "ban"
          ? `User @${targetAuthor.username} was banned.`
          : `User @${targetAuthor.username} was unbanned.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to process user ban action.");
    } finally {
      setActionById((current) => ({
        ...current,
        [item.id]: undefined,
      }));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">Checking your session...</p>;
  }

  if (!user) {
    return null;
  }

  if (user.role !== "ADMIN") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-amber-300/80 bg-amber-100/80 p-6 dark:border-amber-600/70 dark:bg-amber-900/20">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin access required</h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          You do not have permission to access moderation tools.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/25 sm:p-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Moderation</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Review reported forum items and manage report-based account bans.
        </p>
        <div className="mt-4 rounded-xl border border-slate-300/80 bg-slate-50/90 p-3 dark:border-slate-700/70 dark:bg-slate-950/40">
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-500 dark:text-slate-400">
            Filters
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => {
              const isActive = option.value === activeFilter;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActiveFilter(option.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-sky-500/80 bg-sky-500 text-white shadow-sm dark:border-sky-400 dark:bg-sky-500"
                      : "border-slate-300/80 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-white" : "bg-slate-400 dark:bg-slate-500"
                    }`}
                    aria-hidden="true"
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Showing {activeFilterOption.label} items: {queue.length}
        </p>
      </header>

      {notice ? (
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-100/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-600/70 dark:bg-emerald-900/20 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-300/80 bg-red-100/80 px-4 py-3 text-sm text-red-800 dark:border-red-600/70 dark:bg-red-900/20 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {isQueueLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading moderation queue...</p>
      ) : queue.length === 0 ? (
        <div className="rounded-2xl border border-slate-300/80 bg-white/85 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75 dark:text-slate-300 dark:shadow-black/20">
          {activeFilterOption.emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => {
            const actionState = actionById[item.id];
            const isBusy = Boolean(actionState?.isLoading);
            const relatedThreadId = item.targetType === "THREAD" ? item.targetId : item.relatedThreadId;
            const canReview = item.status === "PENDING";
            const isAuthorBanned = item.targetAuthor?.isBanned ?? false;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-300/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-black/25"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
                    {item.targetType}
                  </span>
                  <span className="rounded-full border border-sky-300/80 bg-sky-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/15 dark:text-sky-200">
                    AI confidence score: {formatAiScore(item.aiScore)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${statusBadgeClassName(
                      item.status
                    )}`}
                  >
                    Status: {formatStatus(item.status)}
                  </span>
                  <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
                    User Reports: {item.userReportCount}
                  </span>
                  <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
                    Reports: {item.reportCount}
                  </span>
                  <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
                    Pending: {item.pendingReportCount}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Reported User:{" "}
                  {item.targetAuthor ? `@${item.targetAuthor.username}` : "Unavailable"}
                </p>

                <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{getPreview(item)}</p>

                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <p>Verdict: {formatVerdict(item.verdict)}</p>
                  <p>Explanation: {item.verdictExplanation}</p>
                  <p>AI label: {item.aiLabel ?? "N/A"}</p>
                  <p>Latest report: {formatTimestamp(item.latestReportedAt)}</p>
                  <p>
                    Account status:{" "}
                    {item.targetAuthor ? (item.targetAuthor.isBanned ? "Banned" : "Active") : "Unavailable"}
                  </p>
                </div>

                <div className="mt-4 flex gap-3">
                  {relatedThreadId ? (
                    <Link
                      href={`/forums/${relatedThreadId}`}
                      className="rounded-full border border-slate-300/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    >
                      View Thread
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-slate-300/80 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400 dark:border-slate-700/70 dark:bg-slate-800 dark:text-slate-500"
                    >
                      Thread Unavailable
                    </button>
                  )}
                  {canReview ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleAction(item, "approve")}
                        disabled={isBusy}
                        className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                      >
                        {isBusy && actionState?.action === "approve" ? "Approving..." : "Approve & Hide"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAction(item, "dismiss")}
                        disabled={isBusy}
                        className="rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
                      >
                        {isBusy && actionState?.action === "dismiss" ? "Dismissing..." : "Dismiss"}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleBanToggle(item)}
                    disabled={isBusy || !item.targetAuthor}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${
                      isAuthorBanned
                        ? "border border-emerald-300/80 bg-emerald-100/90 text-emerald-800 hover:bg-emerald-200/90 disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                        : "bg-amber-500 text-white hover:bg-amber-400 disabled:bg-slate-400 dark:disabled:bg-slate-700"
                    }`}
                  >
                    {isBusy && actionState?.action === "ban"
                      ? "Banning..."
                      : isBusy && actionState?.action === "unban"
                        ? "Unbanning..."
                        : !item.targetAuthor
                          ? "Author Unavailable"
                          : isAuthorBanned
                            ? "Unban User"
                            : "Ban User"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
