"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveAppeal,
  getAdminAppeals,
  rejectAppeal,
  type AdminAppeal,
} from "@/lib/api/appeals";
import { useAuth } from "@/lib/context/auth";

type AppealActionState = {
  action: "approve" | "reject";
  isLoading: boolean;
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminAppealsPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  const [appeals, setAppeals] = useState<AdminAppeal[]>([]);
  const [isAppealsLoading, setIsAppealsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionById, setActionById] = useState<Record<string, AppealActionState | undefined>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user || user.role !== "ADMIN" || !token) {
      setIsAppealsLoading(false);
      return;
    }
    const authToken = token;

    let cancelled = false;

    async function loadAppeals() {
      setIsAppealsLoading(true);
      setErrorMessage(null);

      try {
        const items = await getAdminAppeals(authToken);
        if (!cancelled) {
          setAppeals(items);
        }
      } catch (error) {
        if (!cancelled) {
          setAppeals([]);
          setErrorMessage(error instanceof Error ? error.message : "Unable to load appeals queue.");
        }
      } finally {
        if (!cancelled) {
          setIsAppealsLoading(false);
        }
      }
    }

    void loadAppeals();

    return () => {
      cancelled = true;
    };
  }, [isLoading, token, user]);

  async function handleAction(appeal: AdminAppeal, action: "approve" | "reject") {
    if (!token) {
      setErrorMessage("You must be logged in as an admin.");
      return;
    }

    setActionById((current) => ({
      ...current,
      [appeal.id]: { action, isLoading: true },
    }));
    setErrorMessage(null);
    setNotice(null);

    try {
      if (action === "approve") {
        await approveAppeal(appeal.id, token);
      } else {
        await rejectAppeal(appeal.id, token);
      }

      setAppeals((current) => current.filter((entry) => entry.id !== appeal.id));
      setNotice(
        action === "approve"
          ? `Appeal approved. @${appeal.user.username} was unbanned.`
          : `Appeal rejected for @${appeal.user.username}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to process appeal.");
    } finally {
      setActionById((current) => ({
        ...current,
        [appeal.id]: undefined,
      }));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Checking your session...</p>;
  }

  if (!user) {
    return null;
  }

  if (user.role !== "ADMIN") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-amber-300/80 bg-amber-100/80 p-6 dark:border-amber-600/70 dark:bg-amber-900/20">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin access required</h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          You do not have permission to access appeals moderation.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80 sm:p-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Appeals Queue</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Review banned-user appeals and decide whether to restore account access.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Pending appeals: {appeals.length}</p>
      </header>

      {notice ? (
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-100/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-600/70 dark:bg-emerald-900/20 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-rose-300/80 bg-rose-100/80 px-4 py-3 text-sm text-rose-800 dark:border-rose-600/70 dark:bg-rose-900/20 dark:text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {isAppealsLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading appeals queue...</p>
      ) : appeals.length === 0 ? (
        <div className="rounded-2xl border border-slate-300/80 bg-white/85 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75 dark:text-slate-300">
          No pending appeals right now.
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((appeal) => {
            const actionState = actionById[appeal.id];
            const isBusy = Boolean(actionState?.isLoading);

            return (
              <article
                key={appeal.id}
                className="rounded-2xl border border-slate-300/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
                    @{appeal.user.username}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      appeal.user.isBanned
                        ? "border-amber-300/80 bg-amber-100 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200"
                        : "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200"
                    }`}
                  >
                    {appeal.user.isBanned ? "Currently banned" : "Already unbanned"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Submitted {formatTimestamp(appeal.createdAt)}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{appeal.reason}</p>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleAction(appeal, "approve")}
                    disabled={isBusy}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                  >
                    {isBusy && actionState?.action === "approve" ? "Approving..." : "Approve & Unban"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction(appeal, "reject")}
                    disabled={isBusy}
                    className="rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
                  >
                    {isBusy && actionState?.action === "reject" ? "Rejecting..." : "Reject"}
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
