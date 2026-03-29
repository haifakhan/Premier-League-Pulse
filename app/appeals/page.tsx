"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyAppeals, submitAppeal, type UserAppeal } from "@/lib/api/appeals";
import { useAuth } from "@/lib/context/auth";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAppealStatus(status: UserAppeal["status"]): string {
  if (status === "PENDING") {
    return "Pending Review";
  }

  if (status === "APPROVED") {
    return "Approved";
  }

  return "Rejected";
}

function getAppealStatusClassName(status: UserAppeal["status"]): string {
  if (status === "PENDING") {
    return "border-amber-300/80 bg-amber-100 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (status === "APPROVED") {
    return "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  return "border-rose-300/80 bg-rose-100 text-rose-800 dark:border-rose-500/60 dark:bg-rose-500/15 dark:text-rose-200";
}

export default function AppealsPage() {
  const router = useRouter();
  const { user, token, isLoading, refreshUser } = useAuth();

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [appeals, setAppeals] = useState<UserAppeal[]>([]);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user || !token) {
      setIsDataLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAppeals() {
      setIsDataLoading(true);
      setErrorMessage(null);

      try {
        const data = await getMyAppeals(token);
        if (cancelled) {
          return;
        }

        setIsBanned(Boolean(data.isBanned));
        setAppeals(data.appeals);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load appeals.");
          setAppeals([]);
        }
      } finally {
        if (!cancelled) {
          setIsDataLoading(false);
        }
      }
    }

    void loadAppeals();

    return () => {
      cancelled = true;
    };
  }, [isLoading, token, user]);

  const hasPendingAppeal = useMemo(
    () => appeals.some((appeal) => appeal.status === "PENDING"),
    [appeals]
  );
  const latestAppeal = appeals[0] ?? null;
  const canSubmitAppeal = isBanned && !hasPendingAppeal;

  async function handleSubmitAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setErrorMessage("You must be logged in.");
      return;
    }

    if (!canSubmitAppeal) {
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMessage("Please describe why your account should be unbanned.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const createdAppeal = await submitAppeal(token, trimmedReason);
      setAppeals((current) => [createdAppeal, ...current]);
      setReason("");
      setNotice("Your appeal has been submitted and is now pending review.");
      await refreshUser();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit appeal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || isDataLoading) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Loading appeal status...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header className="rounded-2xl border border-slate-300/80 bg-white/95 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Account Appeals</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          If your account is banned, submit an appeal for admin review. Approved appeals lift account restrictions.
        </p>
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

      <section
        className={`rounded-2xl border p-5 text-sm ${
          isBanned
            ? "border-amber-300/80 bg-amber-100/80 text-amber-800 dark:border-amber-600/70 dark:bg-amber-900/20 dark:text-amber-200"
            : "border-emerald-300/80 bg-emerald-100/80 text-emerald-800 dark:border-emerald-600/70 dark:bg-emerald-900/20 dark:text-emerald-200"
        }`}
      >
        {isBanned ? (
          <p>
            Your account is currently restricted. You can submit an appeal request below and track its review status.
          </p>
        ) : (
          <p>Your account is currently active. You can review previous appeal outcomes below.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Submit Appeal</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Explain why you should be unbanned and what behavior will change going forward.
        </p>

        <form onSubmit={handleSubmitAppeal} className="mt-4 space-y-4">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={5}
            maxLength={1000}
            disabled={!canSubmitAppeal || isSubmitting}
            className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700/70 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-500/30 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            placeholder="Describe your situation and request an unban..."
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{reason.length}/1000 characters</p>
            <button
              type="submit"
              disabled={!canSubmitAppeal || isSubmitting}
              className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {isSubmitting ? "Submitting..." : "Submit Appeal"}
            </button>
          </div>
        </form>

        {!isBanned ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Appeal submission is disabled because your account is not currently banned.
          </p>
        ) : hasPendingAppeal ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            You already have a pending appeal. Submit a new one only after this review is resolved.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appeal History</h2>
        {latestAppeal ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Latest status:{" "}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${getAppealStatusClassName(
                latestAppeal.status
              )}`}
            >
              {formatAppealStatus(latestAppeal.status)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No appeals submitted yet.</p>
        )}

        {appeals.length > 0 ? (
          <div className="mt-4 space-y-3">
            {appeals.map((appeal) => (
              <article
                key={appeal.id}
                className="rounded-xl border border-slate-300/80 bg-white/85 p-4 dark:border-slate-700/70 dark:bg-slate-900/70"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${getAppealStatusClassName(
                      appeal.status
                    )}`}
                  >
                    {formatAppealStatus(appeal.status)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Submitted {formatTimestamp(appeal.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{appeal.reason}</p>
                {appeal.reviewedAt ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Reviewed {formatTimestamp(appeal.reviewedAt)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
