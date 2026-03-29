"use client";

import { FormEvent, useEffect } from "react";
import { REPORT_REASON_OPTIONS, type ReportReason, type ReportTargetType } from "@/lib/api/reports";

type ReportFormErrors = {
  reason?: string;
  details?: string;
  submit?: string;
};

type ReportModalProps = {
  isOpen: boolean;
  targetType: ReportTargetType;
  reason: ReportReason;
  details: string;
  errors: ReportFormErrors;
  isSubmitting: boolean;
  onReasonChange: (value: ReportReason) => void;
  onDetailsChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function ReportModal({
  isOpen,
  targetType,
  reason,
  details,
  errors,
  isSubmitting,
  onReasonChange,
  onDetailsChange,
  onClose,
  onSubmit,
}: ReportModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const modalTitle = targetType === "THREAD" ? "Report thread" : "Report reply/post";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        className="w-full max-w-lg rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-xl dark:border-slate-700/70 dark:bg-slate-900/90 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{modalTitle}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Reports are reviewed by moderators. Please choose the closest reason.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
          >
            Close
          </button>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Reason</span>
            <select
              value={reason}
              onChange={(event) => onReasonChange(event.target.value as ReportReason)}
              className="w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
              disabled={isSubmitting}
              required
            >
              {REPORT_REASON_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.reason ? <p className="text-sm text-red-600 dark:text-red-300">{errors.reason}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Details (optional)</span>
            <textarea
              value={details}
              onChange={(event) => onDetailsChange(event.target.value)}
              className="min-h-28 w-full rounded-xl border border-slate-300/80 bg-slate-100/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
              placeholder="Add context to help moderators review this report"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Details are required if you choose Other.</p>
            {errors.details ? <p className="text-sm text-red-600 dark:text-red-300">{errors.details}</p> : null}
          </label>

          {errors.submit ? <p className="text-sm text-red-600 dark:text-red-300">{errors.submit}</p> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-slate-300/80 bg-slate-100/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200/80 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:disabled:text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
