"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { listThreads } from "@/lib/api/threads";
import { getTeams, type TeamOption } from "@/lib/api/sports";
import { useAuth } from "@/lib/context/auth";
import { ForumBadge, ForumTagPill, ForumTeamCrest, ForumUserAvatar } from "@/components/forums/forum-ui";

type ThreadListItem = Awaited<ReturnType<typeof listThreads>>[number];
type ForumScope = "all" | "general" | "team";
type SortMode = "newest" | "oldest" | "replies";

interface ForumsBrowserProps {
  initialTeamId: string | null;
}

interface TeamForumItem {
  teamId: string;
  teamName: string;
  teamCrest: string | null;
  threadCount: number;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown date";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SidebarCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-300/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-black/20">
      <header className="flex items-center gap-2 px-4 py-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-300/70 bg-sky-100/80 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300">
          {icon}
        </span>
        <h3 className="text-sm font-bold tracking-wide text-slate-900 dark:text-slate-100">{title}</h3>
      </header>
      <div className="h-px bg-slate-200 dark:bg-slate-700/80" />
      <div className="p-3">{children}</div>
    </section>
  );
}

function ThreadCard({
  thread,
  teamMeta,
}: {
  thread: ThreadListItem;
  teamMeta: TeamOption | null;
}) {
  const repliesCount = Math.max(0, (thread.postsCount ?? 0) - 1);
  const isOpen = thread.status === "OPEN";
  const previewText = thread.matchId
    ? "Match-focused fan discussion. Open the thread to read the full post and replies."
    : thread.tags?.length
      ? `Topics: ${thread.tags.join(" • ")}`
      : "Open this discussion to read the full post and join the conversation.";

  return (
    <Link
      href={`/forums/${thread.id}`}
      className="group block rounded-xl border border-slate-300/80 bg-white/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/70 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20 dark:hover:border-sky-500/60 dark:hover:shadow-black/40"
    >
      <article className="flex gap-3">
        <div className="hidden md:block">
          <ForumUserAvatar name={thread.author.username} className="h-10 w-10" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ForumBadge tone={isOpen ? "success" : "warning"}>{thread.status}</ForumBadge>

            {thread.forumType === "TEAM" && thread.teamId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700 uppercase dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-200">
                <ForumTeamCrest
                  src={teamMeta?.crest ?? null}
                  teamName={teamMeta?.name ?? `Team ${thread.teamId}`}
                  className="h-4 w-4"
                />
                {teamMeta?.shortName ?? teamMeta?.name ?? `Team ${thread.teamId}`}
              </span>
            ) : (
              <ForumBadge tone="neutral">General</ForumBadge>
            )}

            {thread.matchId ? <ForumBadge tone="sky">Match Thread</ForumBadge> : null}
          </div>

          <h3 className="text-lg font-bold tracking-tight text-slate-900 transition-colors group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-300">
            {thread.title}
          </h3>

          <p className="text-sm leading-5 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden dark:text-slate-300">
            {previewText}
          </p>

          {thread.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {thread.tags.slice(0, 5).map((tag) => (
                <ForumTagPill key={`${thread.id}-${tag}`}>{tag}</ForumTagPill>
              ))}
            </div>
          ) : null}

          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>By {thread.author.username}</span>
            <span>{formatTimestamp(thread.createdAt)}</span>
            <span>{repliesCount} replies</span>
            <span>Views —</span>
          </footer>
        </div>
      </article>
    </Link>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M6 18.5A3.5 3.5 0 0 1 2.5 15V7A3.5 3.5 0 0 1 6 3.5h12A3.5 3.5 0 0 1 21.5 7v8a3.5 3.5 0 0 1-3.5 3.5H9l-4 3v-3Z" />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M12 2.5 20 6v6.2c0 4.7-3.4 8.9-8 9.8-4.6-.9-8-5.1-8-9.8V6l8-3.5Z" />
      <path d="M9 11h6M12 8v6" strokeLinecap="round" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M20.5 13.8 13.8 20.5a2 2 0 0 1-2.8 0L3.5 13V3.5H13l7.5 7.5a2 2 0 0 1 0 2.8Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  );
}

export default function ForumsBrowser({ initialTeamId }: ForumsBrowserProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [forumScope, setForumScope] = useState<ForumScope>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(initialTeamId);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadForumsData() {
      setIsLoading(true);
      setErrorMessage(null);

      const [threadsResult, teamsResult] = await Promise.allSettled([listThreads(), getTeams()]);
      if (!isMounted) return;

      const errors: string[] = [];

      if (threadsResult.status === "fulfilled") {
        setThreads(threadsResult.value);
      } else {
        setThreads([]);
        errors.push(toErrorMessage(threadsResult.reason, "Unable to load threads."));
      }

      if (teamsResult.status === "fulfilled") {
        setTeams(teamsResult.value);
      } else {
        setTeams([]);
        errors.push(toErrorMessage(teamsResult.reason, "Unable to load teams."));
      }

      setErrorMessage(errors.length > 0 ? errors.join(" ") : null);
      setIsLoading(false);
    }

    void loadForumsData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedTeamId(initialTeamId);
  }, [initialTeamId]);

  const teamLookup = useMemo(() => {
    const map = new Map<string, TeamOption>();
    for (const team of teams) {
      map.set(team.id, team);
    }
    return map;
  }, [teams]);

  const teamForums = useMemo(() => {
    const map = new Map<string, TeamForumItem>();

    for (const thread of threads) {
      if (thread.forumType !== "TEAM" || !thread.teamId) continue;
      const teamId = thread.teamId;
      const existing = map.get(teamId);
      const team = teamLookup.get(teamId);

      if (!existing) {
        map.set(teamId, {
          teamId,
          teamName: team?.name ?? `Team ${teamId}`,
          teamCrest: team?.crest ?? null,
          threadCount: 1,
        });
        continue;
      }

      existing.threadCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.threadCount !== a.threadCount) return b.threadCount - a.threadCount;
      return a.teamName.localeCompare(b.teamName);
    });
  }, [threads, teamLookup]);

  const effectiveSelectedTeamId = useMemo(() => {
    if (!selectedTeamId) return null;
    return teamForums.some((entry) => entry.teamId === selectedTeamId) ? selectedTeamId : null;
  }, [selectedTeamId, teamForums]);

  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads) {
      if (!thread.tags?.length) continue;
      for (const tag of thread.tags) {
        const normalized = tag.trim().toLowerCase();
        if (!normalized) continue;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    let next = [...threads];

    if (forumScope === "general") {
      next = next.filter((thread) => thread.forumType === "GENERAL");
    } else if (forumScope === "team") {
      next = next.filter((thread) => thread.forumType === "TEAM");
    }

    if (effectiveSelectedTeamId) {
      next = next.filter(
        (thread) => thread.forumType === "TEAM" && thread.teamId === effectiveSelectedTeamId
      );
    }

    if (selectedTag) {
      const target = selectedTag.trim().toLowerCase();
      next = next.filter((thread) =>
        Array.isArray(thread.tags)
          ? thread.tags.some((tag) => tag.trim().toLowerCase() === target)
          : false
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      next = next.filter((thread) => {
        if (thread.title.toLowerCase().includes(q)) return true;
        if (thread.author.username.toLowerCase().includes(q)) return true;
        if (Array.isArray(thread.tags) && thread.tags.some((tag) => tag.toLowerCase().includes(q))) {
          return true;
        }
        const team = thread.teamId ? teamLookup.get(thread.teamId) : null;
        if (team && team.name.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    next.sort((a, b) => {
      if (sortMode === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (sortMode === "replies") {
        const aReplies = Math.max(0, (a.postsCount ?? 0) - 1);
        const bReplies = Math.max(0, (b.postsCount ?? 0) - 1);
        if (bReplies !== aReplies) return bReplies - aReplies;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return next;
  }, [threads, forumScope, effectiveSelectedTeamId, selectedTag, searchQuery, sortMode, teamLookup]);

  function updateTeamQuery(nextTeamId: string | null) {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (nextTeamId) {
      params.set("teamId", nextTeamId);
    } else {
      params.delete("teamId");
    }

    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    router.replace(target, { scroll: false });
  }

  function handleSelectTeam(nextTeamId: string | null) {
    setSelectedTeamId(nextTeamId);
    updateTeamQuery(nextTeamId);
  }

  function clearFilters() {
    setSearchQuery("");
    setForumScope("all");
    setSortMode("newest");
    setSelectedTag(null);
    handleSelectTeam(null);
  }

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (searchQuery.trim()) chips.push(`Search: ${searchQuery.trim()}`);
    if (forumScope !== "all") chips.push(`Forum: ${forumScope === "team" ? "Team" : "General"}`);
    if (effectiveSelectedTeamId) {
      const team = teamLookup.get(effectiveSelectedTeamId);
      chips.push(`Team: ${team?.name ?? `Team ${effectiveSelectedTeamId}`}`);
    }
    if (selectedTag) chips.push(`Tag: ${selectedTag}`);
    return chips;
  }, [searchQuery, forumScope, effectiveSelectedTeamId, teamLookup, selectedTag]);

  const hasActiveFilters = activeFilterChips.length > 0;

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-200/70 via-transparent to-transparent dark:from-slate-950/60" />

      <header className="rounded-2xl border border-slate-300/80 bg-white/90 px-5 py-5 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-black/25 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300/70 bg-sky-100/80 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300">
              <ChatIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Forums & Discussions
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Browse league and team conversations, then jump into full thread pages with posts,
                replies, and polls.
              </p>
            </div>
          </div>

          {!isAuthLoading && user ? (
            <Link
              href="/forums/create"
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              New Thread
            </Link>
          ) : null}
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-amber-300/80 bg-amber-100/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-600/60 dark:bg-amber-900/20 dark:text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:h-fit">
          <SidebarCard title="Team Forums" icon={<TeamIcon className="h-4 w-4" />}>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSelectTeam(null)}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
                  effectiveSelectedTeamId === null
                    ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                    : "border-slate-300/80 bg-slate-100/70 text-slate-700 hover:border-slate-400/80 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600",
                ].join(" ")}
              >
                <span>All Teams</span>
                <span className="text-xs">{teamForums.reduce((sum, team) => sum + team.threadCount, 0)}</span>
              </button>

              {teamForums.map((team) => {
                const isSelected = effectiveSelectedTeamId === team.teamId;
                return (
                  <button
                    key={team.teamId}
                    type="button"
                    onClick={() => handleSelectTeam(team.teamId)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
                      isSelected
                        ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                        : "border-slate-300/80 bg-slate-100/70 text-slate-700 hover:border-slate-400/80 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ForumTeamCrest src={team.teamCrest} teamName={team.teamName} className="h-6 w-6" />
                      <span className="truncate">{team.teamName}</span>
                    </span>
                    <span className="text-xs">{team.threadCount}</span>
                  </button>
                );
              })}
            </div>
          </SidebarCard>

          <SidebarCard title="Popular Tags" icon={<TagIcon className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2">
              {popularTags.length > 0 ? (
                popularTags.map((entry) => {
                  const isSelected = selectedTag === entry.tag;
                  return (
                    <button
                      key={entry.tag}
                      type="button"
                      onClick={() => setSelectedTag((current) => (current === entry.tag ? null : entry.tag))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        isSelected
                          ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                          : "border-slate-300/80 bg-slate-100/70 text-slate-700 hover:border-slate-400/80 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600",
                      ].join(" ")}
                    >
                      #{entry.tag} ({entry.count})
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No tags yet.</p>
              )}
            </div>
          </SidebarCard>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-300/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-black/25 sm:p-5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search threads by title, author, tags, or team..."
                className="h-12 w-full rounded-xl border border-slate-300/80 bg-slate-100/80 pr-4 pl-11 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-sky-500"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["all", "general", "team"] as ForumScope[]).map((scope) => {
                const isActive = forumScope === scope;
                const label = scope === "all" ? "All" : scope === "general" ? "General" : "Team Forums";
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setForumScope(scope)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                        : "border-slate-300/80 bg-slate-100/70 text-slate-700 hover:border-slate-400 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-slate-600",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Sort</label>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="rounded-lg border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-sky-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:focus:border-sky-500"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="replies">Most Replies</option>
                </select>

                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300/80 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 lg:hidden dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  <FilterIcon className="h-3.5 w-3.5" />
                  Filters
                </button>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>

            {mobileFiltersOpen ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-300/80 bg-slate-100/70 p-3 lg:hidden dark:border-slate-700/70 dark:bg-slate-800/60">
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Team Forums
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTeam(null)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        effectiveSelectedTeamId === null
                          ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                          : "border-slate-300/80 bg-white/80 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200",
                      ].join(" ")}
                    >
                      All Teams
                    </button>
                    {teamForums.map((team) => {
                      const isSelected = effectiveSelectedTeamId === team.teamId;
                      return (
                        <button
                          key={team.teamId}
                          type="button"
                          onClick={() => handleSelectTeam(team.teamId)}
                          className={[
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            isSelected
                              ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                              : "border-slate-300/80 bg-white/80 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200",
                          ].join(" ")}
                        >
                          {team.teamName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Popular Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.slice(0, 10).map((entry) => (
                      <button
                        key={entry.tag}
                        type="button"
                        onClick={() => setSelectedTag((current) => (current === entry.tag ? null : entry.tag))}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          selectedTag === entry.tag
                            ? "border-sky-400/70 bg-sky-100/80 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-200"
                            : "border-slate-300/80 bg-white/80 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200",
                        ].join(" ")}
                      >
                        #{entry.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300/80 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
              {activeFilterChips.map((chip) => (
                <ForumTagPill key={chip}>{chip}</ForumTagPill>
              ))}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`forum-thread-skeleton-${index}`}
                  className="h-40 animate-pulse rounded-xl border border-slate-300/80 bg-slate-100/80 dark:border-slate-700/70 dark:bg-slate-800/70"
                />
              ))}
            </div>
          ) : filteredThreads.length > 0 ? (
            <div className="space-y-3">
              {filteredThreads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  teamMeta={thread.teamId ? teamLookup.get(thread.teamId) ?? null : null}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-300/80 bg-white/90 px-6 py-12 text-center shadow-sm dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-black/25">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300/80 bg-slate-100 dark:border-slate-700/70 dark:bg-slate-800">
                <SearchIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No threads match these filters</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Try adjusting search, forum scope, team selection, or tags.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-full border border-slate-300/80 bg-slate-100/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600"
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
