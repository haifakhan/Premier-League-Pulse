"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTeams, type TeamOption } from "@/lib/api/sports";
import {
  followUser,
  getMyFollowers,
  getMyFollowing,
  getPublicUserActivity,
  getPublicUserProfile,
  type PublicUserActivityPoint,
  removeFollower,
  type PublicUserPost,
  type PublicUserProfile,
  type UserListItem,
  unfollowUser,
} from "@/lib/api/users";
import { useAuth } from "@/lib/context/auth";

type ActivityPoint = PublicUserActivityPoint & {
  label: string;
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

function getLastThirtyDayRange() {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);

  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - 29);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
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

function getPostKindLabel(post: PublicUserPost): string {
  return post.kind === "ROOT" ? "Post" : "Reply";
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
  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => [point.threads, point.rootPosts, point.replies])
  );
  const barWidth = Math.max(3, Math.min(8, groupWidth / 4));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-sky-500" aria-hidden="true" />
          Threads
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-500" aria-hidden="true" />
          Posts
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-slate-500" aria-hidden="true" />
          Replies
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
          const rootPostHeight = (point.rootPosts / maxValue) * plotHeight;
          const replyHeight = (point.replies / maxValue) * plotHeight;
          const labelEvery = data.length > 10 ? 3 : 1;

          return (
            <g key={point.date}>
              <rect
                x={groupX - barWidth * 1.5 - 2}
                y={paddingTop + plotHeight - threadHeight}
                width={barWidth}
                height={threadHeight}
                rx="2"
                fill="#0ea5e9"
              />
              <rect
                x={groupX - barWidth / 2}
                y={paddingTop + plotHeight - rootPostHeight}
                width={barWidth}
                height={rootPostHeight}
                rx="2"
                fill="#10b981"
              />
              <rect
                x={groupX + barWidth / 2 + 2}
                y={paddingTop + plotHeight - replyHeight}
                width={barWidth}
                height={replyHeight}
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

function UserProfileLink({
  userId,
  username,
  avatarUrl,
  avatarClassName,
  textClassName,
  className,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  avatarClassName: string;
  textClassName?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/users/${userId}`}
      className={`group inline-flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${className ?? ""}`}
    >
      <UserAvatar username={username} avatarUrl={avatarUrl} className={avatarClassName} />
      <span
        className={`truncate font-medium text-slate-900 transition group-hover:text-sky-700 group-focus-visible:text-sky-700 ${textClassName ?? ""}`}
      >
        {username}
      </span>
    </Link>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params?.id) ? (params.id[0] ?? "") : (params?.id ?? "");
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
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
        const { from, to } = getLastThirtyDayRange();
        const [nextProfile, nextTeams, nextActivity] = await Promise.all([
          getPublicUserProfile(userId),
          getTeams(),
          getPublicUserActivity(userId, from, to),
        ]);

        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setTeams(nextTeams);
        setActivity(nextActivity.map((point) => ({ ...point, label: formatDayLabel(point.date) })));
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setTeams([]);
          setActivity([]);
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

  const authoredPosts = useMemo(
    () => profile?.posts.filter((post) => post.kind === "ROOT") ?? [],
    [profile?.posts]
  );

  const authoredReplies = useMemo(
    () => profile?.posts.filter((post) => post.kind === "REPLY") ?? [],
    [profile?.posts]
  );
  const isFollowBlockedByBan = Boolean(user?.isBanned && !isFollowingProfile);

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
                disabled={isSubmittingFollow || isLoadingSocial || isFollowBlockedByBan}
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
        {isFollowBlockedByBan ? (
          <p className="mt-4 text-sm text-amber-700">
            Banned users cannot follow new users.
          </p>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Activity</h2>
            <p className="text-sm text-slate-600">
              Daily thread, post, and reply activity for the last 30 days.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <ActivityChart data={activity} />
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
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Posts</h3>
                    <span className="text-xs text-slate-500">{authoredPosts.length}</span>
                  </div>
                  {authoredPosts.length ? (
                    authoredPosts.map((post) => (
                      <article key={post.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                            {getPostKindLabel(post)}
                          </span>
                          {post.threadTitle ? (
                            <Link href={`/forums/${post.threadId}`} className="text-sky-700 hover:text-sky-600">
                              In {post.threadTitle}
                            </Link>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{truncateContent(post.content)}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatTimestamp(post.createdAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No public posts yet.</p>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Replies</h3>
                    <span className="text-xs text-slate-500">{authoredReplies.length}</span>
                  </div>
                  {authoredReplies.length ? (
                    authoredReplies.map((post) => (
                      <article key={post.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                            {getPostKindLabel(post)}
                          </span>
                          {post.threadTitle ? (
                            <Link href={`/forums/${post.threadId}`} className="text-sky-700 hover:text-sky-600">
                              In {post.threadTitle}
                            </Link>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{truncateContent(post.content)}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatTimestamp(post.createdAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No public replies yet.</p>
                  )}
                </div>
              </>
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
              <span className="text-sm text-slate-500">{profile.followerCount}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Sorted by most recent follow.</p>

            <div className="mt-4 space-y-3">
              {isLoadingSocial ? (
                <p className="text-sm text-slate-600">Loading followers...</p>
              ) : socialError ? (
                <p className="text-sm text-red-600">{socialError}</p>
              ) : followers.length ? (
                followers.map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <UserProfileLink
                        userId={follower.id}
                        username={follower.username}
                        avatarUrl={follower.avatarUrl}
                        avatarClassName="h-10 w-10 text-sm"
                        textClassName="text-sm"
                      />
                      <p className="text-xs text-slate-500">Followed {formatTimestamp(follower.followedAt)}</p>
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
              <span className="text-sm text-slate-500">{profile.followingCount}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Sorted by most recent follow.</p>

            <div className="mt-4 space-y-3">
              {isLoadingSocial ? (
                <p className="text-sm text-slate-600">Loading following list...</p>
              ) : socialError ? (
                <p className="text-sm text-red-600">{socialError}</p>
              ) : following.length ? (
                following.map((followedUser) => (
                  <div
                    key={followedUser.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <UserProfileLink
                        userId={followedUser.id}
                        username={followedUser.username}
                        avatarUrl={followedUser.avatarUrl}
                        avatarClassName="h-10 w-10 text-sm"
                        textClassName="text-sm"
                      />
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
