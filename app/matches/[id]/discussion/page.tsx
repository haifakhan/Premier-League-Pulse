"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMatchThreadAvailability } from "@/lib/api/threads";

export default function MatchDiscussionRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params?.id ?? "";

  useEffect(() => {
    let cancelled = false;

    async function resolveDiscussionTarget() {
      if (!matchId) {
        router.replace("/matches");
        return;
      }

      try {
        const availability = await getMatchThreadAvailability(matchId);
        if (cancelled) return;

        if (availability.thread?.id) {
          router.replace(`/forums/${availability.thread.id}`);
          return;
        }

        const reason =
          availability.availability === "PRE_WINDOW" ? "opens-soon" : "unavailable";
        router.replace(`/matches/${matchId}?discussion=${reason}`);
      } catch {
        if (cancelled) return;
        router.replace(`/matches/${matchId}?discussion=error`);
      }
    }

    void resolveDiscussionTarget();

    return () => {
      cancelled = true;
    };
  }, [matchId, router]);

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-300/80 bg-white/90 px-6 py-10 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/80">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Loading discussion thread...</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Resolving match discussion now.
      </p>
    </section>
  );
}
