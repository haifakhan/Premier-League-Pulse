"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTeams, TeamOption } from "@/lib/api/sports";
import { updateMyProfile } from "@/lib/api/users";
import { useAuth } from "@/lib/context/auth";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, token, isLoading, refreshUser } = useAuth();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [form, setForm] = useState({
    username: "",
    avatarUrl: "",
    favoriteTeamId: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setForm({
      username: user.username,
      avatarUrl: user.avatarUrl ?? "",
      favoriteTeamId: user.favoriteTeamId ?? "",
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      try {
        setTeamsError(null);
        const nextTeams = await getTeams();

        if (!cancelled) {
          setTeams(nextTeams);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTeamsError(loadError instanceof Error ? loadError.message : "Unable to load teams.");
        }
      }
    }

    if (user) {
      loadTeams();
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setErrorMessage("You must be signed in to update your profile.");
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateMyProfile(token, {
        username: form.username,
        avatarUrl: form.avatarUrl,
        favoriteTeamId: form.favoriteTeamId || null,
      });
      await refreshUser();
      setSuccessMessage("Profile updated successfully.");
    } catch (saveError) {
      setErrorMessage(saveError instanceof Error ? saveError.message : "Unable to update profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading settings...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Edit Profile</h1>
        <p className="text-sm text-slate-600">Update your public details and favorite team.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Username</span>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Avatar URL</span>
          <input
            type="url"
            name="avatarUrl"
            value={form.avatarUrl}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            placeholder="https://example.com/avatar.png"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Favorite Team</span>
          <select
            name="favoriteTeamId"
            value={form.favoriteTeamId}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
          >
            <option value="">No favorite team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        {teamsError ? <p className="text-sm text-red-600">{teamsError}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <Link
            href="/profile"
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
