"use client";

import { type ReactNode, useState } from "react";

export type ForumBadgeTone = "neutral" | "success" | "warning" | "sky";

export function ForumBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: ForumBadgeTone;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/70 bg-emerald-100/80 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
      : tone === "warning"
        ? "border-amber-300/70 bg-amber-100/80 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
        : tone === "sky"
          ? "border-sky-300/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200"
          : "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
        toneClass,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function ForumTagPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
      {children}
    </span>
  );
}

function getInitials(name: string): string {
  const pieces = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (pieces.length === 0) return "??";
  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase();
  return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase();
}

export function ForumUserAvatar({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const finalClassName = className ?? "h-9 w-9";

  if (!imageUrl || hasError) {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-full border border-slate-300/80 bg-slate-100 text-[10px] font-bold text-slate-700 dark:border-slate-600/70 dark:bg-slate-800 dark:text-slate-200",
          finalClassName,
        ].join(" ")}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar-like images are optional dynamic URLs.
    <img
      src={imageUrl}
      alt={`${name} avatar`}
      onError={() => setHasError(true)}
      className={[
        "rounded-full border border-slate-300/80 bg-white object-cover dark:border-slate-600/70 dark:bg-slate-900",
        finalClassName,
      ].join(" ")}
      loading="lazy"
    />
  );
}

export function ForumTeamCrest({
  src,
  teamName,
  className,
}: {
  src: string | null;
  teamName: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const finalClassName = className ?? "h-8 w-8";

  if (!src || hasError) {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-full border border-slate-300/80 bg-slate-100 text-[10px] font-bold text-slate-700 dark:border-slate-600/70 dark:bg-slate-800 dark:text-slate-200",
          finalClassName,
        ].join(" ")}
      >
        {getInitials(teamName)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- crest URLs come from upstream and are not preconfigured domains.
    <img
      src={src}
      alt={`${teamName} crest`}
      onError={() => setHasError(true)}
      className={[
        "rounded-full border border-slate-300/80 bg-white object-contain p-1 dark:border-slate-600/70 dark:bg-slate-900",
        finalClassName,
      ].join(" ")}
      loading="lazy"
    />
  );
}
