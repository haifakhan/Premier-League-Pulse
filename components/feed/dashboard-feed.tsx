"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FeedItem,
  getFeed,
  ThreadCreatedFeedItem,
  RepliesToMyPostFeedItem,
  FollowedUsersRepliedFeedItem,
  FavoriteTeamMatchResultFeedItem,
} from "@/lib/api/feed";
import { useAuth } from "@/lib/context/auth";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function truncate(value: string | null, maxLength = 180): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function ActorList({ usernames }: { usernames: string[] }) {
  if (usernames.length === 0) {
    return null;
  }

  return (
    <p className="text-sm text-slate-600 dark:text-slate-300">
      {usernames.join(", ")}
    </p>
  );
}

function ReasonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-300/80 bg-slate-100/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-200">
      {label}
    </span>
  );
}

function ThreadCreatedCard({ item }: { item: ThreadCreatedFeedItem }) {
  const preview = truncate(item.preview);
  const reasonLabels = item.reasons.map((reason) => {
    if (reason === "FOLLOWED_USER") return "Following";
    if (reason === "FAVORITE_TEAM_FORUM") return "Favorite Team Forum";
    return "Favorite Team Match";
  });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <ReasonBadge label="New Thread" />
        {reasonLabels.map((label) => (
          <ReasonBadge key={`${item.threadId}-${label}`} label={label} />
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <Link
          href={`/forums/${item.threadId}`}
          className="text-lg font-semibold text-slate-900 transition hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-300"
        >
          {item.threadTitle}
        </Link>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {item.author.username} started this thread • {formatTimestamp(item.createdAt)}
        </p>
        {preview ? (
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{preview}</p>
        ) : null}
      </div>
    </article>
  );
}

function RepliesToMyPostCard({ item }: { item: RepliesToMyPostFeedItem }) {
  const usernames = item.actors.map((actor) => actor.username);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <ReasonBadge label="Replies To Your Post" />
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {item.replyCount} new repl{item.replyCount === 1 ? "y" : "ies"}
        </p>
        <ActorList usernames={usernames} />
        {item.threadId && item.threadTitle ? (
          <Link
            href={`/forums/${item.threadId}`}
            className="text-sm font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
          >
            Open {item.threadTitle}
          </Link>
        ) : null}
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(item.createdAt)}</p>
      </div>
    </article>
  );
}

function FollowedUsersRepliedCard({ item }: { item: FollowedUsersRepliedFeedItem }) {
  const usernames = item.actors.map((actor) => actor.username);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <ReasonBadge label="Following Activity" />
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {item.replyCount} repl{item.replyCount === 1 ? "y" : "ies"} from people you follow
        </p>
        <ActorList usernames={usernames} />
        <Link
          href={`/forums/${item.threadId}`}
          className="text-sm font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
        >
          Open {item.threadTitle}
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(item.createdAt)}</p>
      </div>
    </article>
  );
}

function FavoriteTeamMatchResultCard({ item }: { item: FavoriteTeamMatchResultFeedItem }) {
  const homeScore = item.score.home ?? "-";
  const awayScore = item.score.away ?? "-";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <ReasonBadge label="Favorite Team Result" />
      </div>

      <div className="mt-3 space-y-2">
        <Link
          href={`/matches/${item.matchId}`}
          className="text-lg font-semibold text-slate-900 transition hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-300"
        >
          {item.homeTeam} {homeScore} - {awayScore} {item.awayTeam}
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(item.createdAt)}</p>
      </div>
    </article>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  if (item.type === "THREAD_CREATED") {
    return <ThreadCreatedCard item={item} />;
  }

  if (item.type === "REPLIES_TO_MY_POST") {
    return <RepliesToMyPostCard item={item} />;
  }

  if (item.type === "FOLLOWED_USERS_REPLIED") {
    return <FollowedUsersRepliedCard item={item} />;
  }

  return <FavoriteTeamMatchResultCard item={item} />;
}

function getFeedItemKey(item: FeedItem, index: number): string {
  if (item.type === "THREAD_CREATED") {
    return `${item.type}-${item.threadId}-${index}`;
  }

  if (item.type === "FAVORITE_TEAM_MATCH_RESULT") {
    return `${item.type}-${item.matchId}-${index}`;
  }

  if (item.type === "REPLIES_TO_MY_POST") {
    return `${item.type}-${item.postId}-${index}`;
  }

  return `${item.type}-${item.threadId}-${index}`;
}

export default function DashboardFeed() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user || !token) {
      setFeed([]);
      setErrorMessage(null);
      setIsLoadingFeed(false);
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function loadFeed() {
      setIsLoadingFeed(true);
      setErrorMessage(null);

      try {
        const nextFeed = await getFeed(authToken);
        if (!cancelled) {
          setFeed(nextFeed);
        }
      } catch (error) {
        if (!cancelled) {
          setFeed([]);
          setErrorMessage(error instanceof Error ? error.message : "Unable to load your feed.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFeed(false);
        }
      }
    }

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, token, user]);

  const visibleFeed = useMemo(() => feed.slice(0, 12), [feed]);

  if (isAuthLoading || !user) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/30 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your Feed</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Recent activity from your posts, the people you follow, and your favorite team.
            </p>
          </div>
        </div>

        <div className="mt-4">
          {isLoadingFeed ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`feed-skeleton-${index}`}
                  className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                />
              ))}
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-5 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-amber-200">
              {errorMessage}
            </div>
          ) : visibleFeed.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No personalized activity yet. Follow people, join discussions, or pick a favorite team to start filling your feed.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleFeed.map((item, index) => (
                <FeedCard key={getFeedItemKey(item, index)} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
