"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMyProfile } from "@/lib/api/users";
import { getTeams, TeamOption } from "@/lib/api/sports";
import { useAuth } from "@/lib/context/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getMyProfile>> | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function loadProfile() {
      try {
        setError(null);
        const [nextProfile, nextTeams] = await Promise.all([getMyProfile(authToken), getTeams()]);

        if (!cancelled) {
          setProfile(nextProfile);
          setTeams(nextTeams);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading profile...</p>;
  }

  if (!user) {
    return null;
  }

  const favoriteTeamName =
    teams.find((team) => team.id === (profile?.favoriteTeamId ?? user.favoriteTeamId))?.name ?? "None";
  const avatarUrl = profile?.avatarUrl ?? user.avatarUrl;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-600">Manage your account details and favorite club.</p>
        </div>
        <Link
          href="/profile/edit"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Edit Profile
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-3xl font-semibold text-slate-500">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={`${user.username} avatar`} className="h-full w-full object-cover" />
            ) : (
              user.username.slice(0, 1).toUpperCase()
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-900">
              {profile?.username ?? user.username}
            </h2>
            <p className="text-base text-slate-600">{profile?.email ?? user.email}</p>
            <p className="text-sm text-slate-500">Favorite team: {favoriteTeamName}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-6 border-t border-slate-200 pt-6">
          <Link href="#followers" className="text-sm text-slate-700 hover:text-slate-900">
            <span className="font-semibold text-slate-900">{profile?.followerCount ?? 0}</span> Followers
          </Link>
          <Link href="#following" className="text-sm text-slate-700 hover:text-slate-900">
            <span className="font-semibold text-slate-900">{profile?.followingCount ?? 0}</span> Following
          </Link>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="followers" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Followers</h3>
          <div className="mt-4 space-y-3">
            {profile?.followers.length ? (
              profile.followers.map((follower) => (
                <div
                  key={follower.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                    {follower.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={follower.avatarUrl}
                        alt={`${follower.username} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      follower.username.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{follower.username}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No followers yet.</p>
            )}
          </div>
        </section>

        <section id="following" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Following</h3>
          <div className="mt-4 space-y-3">
            {profile?.following.length ? (
              profile.following.map((followedUser) => (
                <div
                  key={followedUser.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                    {followedUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={followedUser.avatarUrl}
                        alt={`${followedUser.username} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      followedUser.username.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{followedUser.username}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">You are not following anyone yet.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
