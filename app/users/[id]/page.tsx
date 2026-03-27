"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTeams, type TeamOption } from "@/lib/api/sports";
import {
  followUser,
  getMyFollowers,
  getMyFollowing,
  getPublicUserProfile,
  removeFollower,
  type PublicUserPost,
  type PublicUserProfile,
  type PublicUserThread,
  type UserListItem,
  unfollowUser,
} from "@/lib/api/users";
import { useAuth } from "@/lib/context/auth";

type ActivityPoint = {
  date: string;
  label: string;
  threads: number;
  posts: number;
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDayLabel(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function buildActivitySeries(threads: PublicUserThread[], posts: PublicUserPost[]): ActivityPoint[] {
  const threadDates = threads.map((thread) => thread.createdAt);
  const postDates = posts.map((post) => post.createdAt);
  const allDates = [...threadDates, ...postDates]
    .map((value) => new Date(value))
    .filter((value) => Number.isFinite(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  if (allDates.length === 0) {
    return [];
  }

  const latest = allDates[allDates.length - 1];
  const windowEnd = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), latest.getUTCDate()));
  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(windowEnd.getUTCDate() - 29);

  const threadCounts = new Map<string, number>();
  const postCounts = new Map<string, number>();

  for (const thread of threads) {
    const date = thread.createdAt.slice(0, 10);
    if (date >= windowStart.toISOString().slice(0, 10) && date <= windowEnd.toISOString().slice(0, 10)) {
      threadCounts.set(date, (threadCounts.get(date) ?? 0) + 1);
    }
  }

  for (const post of posts) {
    const date = post.createdAt.slice(0, 10);
    if (date >= windowStart.toISOString().slice(0, 10) && date <= windowEnd.toISOString().slice(0, 10)) {
      postCounts.set(date, (postCounts.get(date) ?? 0) + 1);
    }
  }

  const points: ActivityPoint[] = [];

  for (let offset = 0; offset < 30; offset += 1) {
    const current = new Date(windowStart);
    current.setUTCDate(windowStart.getUTCDate() + offset);
    const date = current.toISOString().slice(0, 10);

    points.push({
      date,
      label: formatDayLabel(date),
      threads: threadCounts.get(date) ?? 0,
      posts: postCounts.get(date) ?? 0,
    });
  }

  return points;
}

function getInitial(username: string): string {
  return username.slice(0, 1).toUpperCase();
}

function truncateContent(content: string, maxLength = 180): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function sortByFollowTime(items: UserListItem[]): UserListItem[] {
  return [...items].sort(
    (left, right) => new Date(right.followedAt).getTime() - new Date(left.followedAt).getTime()
  );
}

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-600">No recent activity to chart.</p>;
  }

  const svgWidth = 720;
  const svgHeight = 220;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const groupWidth = plotWidth / data.length;
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.threads, point.posts]));
  const barWidth = Math.max(4, Math.min(9, groupWidth / 3));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-sky-500" aria-hidden="true" />
          Threads
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-slate-500" aria-hidden="true" />
          Posts & Replies
        </span>
      </div>

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-56 w-full" role="img" aria-label="User activity">
        <line
          x1={paddingLeft}
          y1={paddingTop + plotHeight}
          x2={svgWidth - paddingRight}
          y2={paddingTop + plotHeight}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {data.map((point, index) => {
          const groupX = paddingLeft + index * groupWidth + groupWidth / 2;
          const threadHeight = (point.threads / maxValue) * plotHeight;
          const postHeight = (point.posts / maxValue) * plotHeight;
          const labelEvery = data.length > 10 ? 3 : 1;

          return (
            <g key={point.date}>
              <rect
                x={groupX - barWidth - 1}
                y={paddingTop + plotHeight - threadHeight}
                width={barWidth}
                height={threadHeight}
                rx="2"
                fill="#0ea5e9"
              />
              <rect
                x={groupX + 1}
                y={paddingTop + plotHeight - postHeight}
                width={barWidth}
                height={postHeight}
                rx="2"
                fill="#64748b"
              />
              {index % labelEvery === 0 ? (
                <text
                  x={groupX}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UserAvatar({
  username,
  avatarUrl,
  className,
}: {
  username: string;
  avatarUrl: string | null;
  className: string;
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-500 ${className}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={`${username} avatar`} className="h-full w-full object-cover" />
      ) : (
        getInitial(username)
      )}
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params?.id) ? (params.id[0] ?? "") : (params?.id ?? "");
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [followers, setFollowers] = useState<UserListItem[]>([]);
  const [following, setFollowing] = useState<UserListItem[]>([]);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingFollow, setIsSubmittingFollow] = useState(false);
  const [removingFollowerId, setRemovingFollowerId] = useState<string | null>(null);

  const isOwnProfile = Boolean(user && userId && user.id === userId);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);
      setProfileError(null);

      try {
        const [nextProfile, nextTeams] = await Promise.all([getPublicUserProfile(userId), getTeams()]);

        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setTeams(nextTeams);
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setTeams([]);
          setProfileError(error instanceof Error ? error.message : "Unable to load profile.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (isAuthLoading || !userId) {
      return;
    }

    if (!user || !token) {
      setFollowers([]);
      setFollowing([]);
      setIsFollowingProfile(false);
      setSocialError(null);
      return;
    }

    const authUser = user;
    const authToken = token;
    let cancelled = false;

    async function loadSocialState() {
      setIsLoadingSocial(true);
      setSocialError(null);

      try {
        if (authUser.id === userId) {
          const [nextFollowers, nextFollowing] = await Promise.all([
            getMyFollowers(authToken),
            getMyFollowing(authToken),
          ]);

          if (cancelled) {
            return;
          }

          setFollowers(sortByFollowTime(nextFollowers));
          setFollowing(sortByFollowTime(nextFollowing));
          setIsFollowingProfile(false);
          return;
        }

        const nextFollowing = await getMyFollowing(authToken);

        if (cancelled) {
          return;
        }

        setFollowers([]);
        setFollowing([]);
        setIsFollowingProfile(nextFollowing.some((entry) => entry.id === userId));
      } catch (error) {
        if (!cancelled) {
          setFollowers([]);
          setFollowing([]);
          setIsFollowingProfile(false);
          setSocialError(error instanceof Error ? error.message : "Unable to load social data.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSocial(false);
        }
      }
    }

    void loadSocialState();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, token, user, userId]);

  const favoriteTeamName = useMemo(() => {
    if (!profile?.favoriteTeamId) {
      return "None";
    }

    return teams.find((team) => team.id === profile.favoriteTeamId)?.name ?? `Team ${profile.favoriteTeamId}`;
  }, [profile?.favoriteTeamId, teams]);

  const activityData = useMemo(() => {
    if (!profile) {
      return [];
    }

    return buildActivitySeries(profile.threads, profile.posts);
  }, [profile]);

  async function handleFollowToggle() {
    if (!token || !profile || isOwnProfile) {
      return;
    }

    setIsSubmittingFollow(true);
    setActionError(null);

    try {
      if (isFollowingProfile) {
        await unfollowUser(profile.id, token);
        setIsFollowingProfile(false);
        setProfile((current) =>
          current
            ? {
                ...current,
                followerCount: Math.max(0, current.followerCount - 1),
              }
            : current
        );
      } else {
        await followUser(profile.id, token);
        setIsFollowingProfile(true);
        setProfile((current) =>
          current
            ? {
                ...current,
                followerCount: current.followerCount + 1,
              }
            : current
        );
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update follow status.");
    } finally {
      setIsSubmittingFollow(false);
    }
  }

  async function handleRemoveFollower(followerId: string) {
    if (!token) {
      return;
    }

    setRemovingFollowerId(followerId);
    setActionError(null);

    try {
      await removeFollower(followerId, token);
      setFollowers((current) => current.filter((entry) => entry.id !== followerId));
      setProfile((current) =>
        current
          ? {
              ...current,
              followerCount: Math.max(0, current.followerCount - 1),
            }
          : current
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to remove follower.");
    } finally {
      setRemovingFollowerId(null);
    }
  }

  if (isLoadingProfile) {
    return <p className="text-sm text-slate-600">Loading user profile...</p>;
  }

  if (profileError) {
    return (
      <section className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Profile unavailable</h1>
        <p className="mt-2 text-sm text-red-700">{profileError}</p>
      </section>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <UserAvatar username={profile.username} avatarUrl={profile.avatarUrl} className="h-24 w-24 text-3xl" />

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-slate-900">{profile.username}</h1>
              <p className="text-sm text-slate-500">Favorite team: {favoriteTeamName}</p>
              {profile.bio ? <p className="max-w-2xl text-sm text-slate-600">{profile.bio}</p> : null}
              <p className="text-xs text-slate-500">Joined {formatTimestamp(profile.createdAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isOwnProfile ? (
              <Link
                href="/profile/edit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Edit Profile
              </Link>
            ) : !isAuthLoading && user && token ? (
              <button
                type="button"
                onClick={() => void handleFollowToggle()}
                disabled={isSubmittingFollow || isLoadingSocial}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmittingFollow ? "Updating..." : isFollowingProfile ? "Unfollow" : "Follow"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-6 border-t border-slate-200 pt-6 text-sm text-slate-700">
          <span>
            <span className="font-semibold text-slate-900">{profile.followerCount}</span> Followers
          </span>
          <span>
            <span className="font-semibold text-slate-900">{profile.followingCount}</span> Following
          </span>
          <span>
            <span className="font-semibold text-slate-900">{profile.threads.length}</span> Threads
          </span>
          <span>
            <span className="font-semibold text-slate-900">{profile.posts.length}</span> Posts & Replies
          </span>
        </div>

        {socialError ? <p className="mt-4 text-sm text-red-600">{socialError}</p> : null}
        {actionError ? <p className="mt-4 text-sm text-red-600">{actionError}</p> : null}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Activity</h2>
            <p className="text-sm text-slate-600">Daily thread and post/reply activity for the last 30 days.</p>
          </div>
        </div>
        <div className="mt-6">
          <ActivityChart data={activityData} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Threads</h2>
            <span className="text-sm text-slate-500">{profile.threads.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {profile.threads.length ? (
              profile.threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/forums/${thread.id}`}
                  className="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="font-medium text-slate-900">{thread.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatTimestamp(thread.createdAt)}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-600">No public threads yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Posts & Replies</h2>
            <span className="text-sm text-slate-500">{profile.posts.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {profile.posts.length ? (
              profile.posts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{truncateContent(post.content)}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatTimestamp(post.createdAt)}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600">No public posts or replies yet.</p>
            )}
          </div>
        </section>
      </div>

      {isOwnProfile ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900">Followers</h2>
              <span className="text-sm text-slate-500">{followers.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {followers.length ? (
                followers.map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        username={follower.username}
                        avatarUrl={follower.avatarUrl}
                        className="h-10 w-10 text-sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{follower.username}</p>
                        <p className="text-xs text-slate-500">Followed {formatTimestamp(follower.followedAt)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRemoveFollower(follower.id)}
                      disabled={removingFollowerId === follower.id}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {removingFollowerId === follower.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No followers yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900">Following</h2>
              <span className="text-sm text-slate-500">{following.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {following.length ? (
                following.map((followedUser) => (
                  <div
                    key={followedUser.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <UserAvatar
                      username={followedUser.username}
                      avatarUrl={followedUser.avatarUrl}
                      className="h-10 w-10 text-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{followedUser.username}</p>
                      <p className="text-xs text-slate-500">Followed {formatTimestamp(followedUser.followedAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">You are not following anyone yet.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
