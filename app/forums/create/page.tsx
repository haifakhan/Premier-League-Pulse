"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createThread, getTagSuggestions } from "@/lib/api/threads";
import { getTeams, TeamOption } from "@/lib/api/sports";
import { useAuth } from "@/lib/context/auth";

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function formatTagLabel(tag: string) {
  return tag
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CreateThreadPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    content?: string;
    teamId?: string;
    tags?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    teamId: "general",
    tags: [] as string[],
  });

  useEffect(() => {
    if (!isLoading && (!user || !token)) {
      router.replace("/login");
    }
  }, [isLoading, router, token, user]);

  useEffect(() => {
    if (isLoading || !user || !token || user.isBanned) {
      return;
    }

    let cancelled = false;

    async function loadFormData() {
      setIsPageLoading(true);
      setTeamsError(null);
      setTagsError(null);

      const [teamsResult, tagsResult] = await Promise.allSettled([getTeams(), getTagSuggestions()]);

      if (cancelled) {
        return;
      }

      if (teamsResult.status === "fulfilled") {
        setTeams(teamsResult.value);
      } else {
        setTeams([]);
        setTeamsError(
          teamsResult.reason instanceof Error ? teamsResult.reason.message : "Unable to load teams."
        );
      }

      if (tagsResult.status === "fulfilled") {
        setTagSuggestions(tagsResult.value);
      } else {
        setTagSuggestions([]);
        setTagsError(
          tagsResult.reason instanceof Error ? tagsResult.reason.message : "Unable to load tag suggestions."
        );
      }

      setIsPageLoading(false);
    }

    void loadFormData();

    return () => {
      cancelled = true;
    };
  }, [isLoading, token, user]);

  const availableSuggestions = useMemo(
    () => tagSuggestions.filter((tag) => !form.tags.includes(tag)),
    [form.tags, tagSuggestions]
  );

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSubmitError(null);

    if (name === "title" || name === "content" || name === "teamId") {
      clearFieldError(name);
    }
  }

  function addTag(rawValue: string) {
    const normalized = normalizeTag(rawValue);

    if (!normalized) {
      setFieldErrors((current) => ({ ...current, tags: "Enter a tag name before adding it." }));
      return;
    }

    if (form.tags.includes(normalized)) {
      setFieldErrors((current) => ({ ...current, tags: "That tag is already selected." }));
      return;
    }

    setForm((current) => ({
      ...current,
      tags: [...current.tags, normalized],
    }));
    setTagInput("");
    setSubmitError(null);
    clearFieldError("tags");
  }

  function removeTag(tag: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((entry) => entry !== tag),
    }));
    setSubmitError(null);
    clearFieldError("tags");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
    }
  }

  function validateForm() {
    const nextErrors: typeof fieldErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = "Title is required.";
    }

    if (!form.content.trim()) {
      nextErrors.content = "Main post content is required.";
    }

    if (!form.teamId) {
      nextErrors.teamId = "Choose a forum.";
    }

    if (tagInput.trim()) {
      nextErrors.tags = "Add the typed tag or clear it before submitting.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setSubmitError("You must be logged in to create a thread.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isGeneralForum = form.teamId === "general";
      const thread = await createThread(token, {
        title: form.title.trim(),
        content: form.content.trim(),
        teamId: isGeneralForum ? null : form.teamId,
        tags: form.tags,
        forumType: isGeneralForum ? "GENERAL" : "TEAM",
      });

      router.push(`/forums/${thread.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create thread.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || (!user && !isLoading)) {
    return <p className="text-sm text-slate-600">Checking your session...</p>;
  }

  if (!user || !token) {
    return null;
  }

  if (user.isBanned) {
    return (
      <section className="mx-auto max-w-3xl rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Create Thread</h1>
        <p className="mt-3 text-sm text-amber-800">
          Banned users cannot create threads. If you believe this is a mistake, submit an appeal from your account menu.
        </p>
      </section>
    );
  }

  if (isPageLoading) {
    return <p className="text-sm text-slate-600">Loading thread form...</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Create Thread</h1>
        <p className="text-sm text-slate-600">Start a discussion in the general forum or a specific team forum.</p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleInputChange}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            placeholder="Enter a thread title"
            required
          />
          {fieldErrors.title ? <p className="text-sm text-red-600">{fieldErrors.title}</p> : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Main Post Content</span>
          <textarea
            name="content"
            value={form.content}
            onChange={handleInputChange}
            className="min-h-40 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            placeholder="Write the first post in your thread"
            required
          />
          {fieldErrors.content ? <p className="text-sm text-red-600">{fieldErrors.content}</p> : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Team Forum</span>
          <select
            name="teamId"
            value={form.teamId}
            onChange={handleInputChange}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            required
          >
            <option value="general">General</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {fieldErrors.teamId ? <p className="text-sm text-red-600">{fieldErrors.teamId}</p> : null}
          {teamsError ? <p className="text-sm text-red-600">{teamsError}</p> : null}
        </label>

        <div className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="tag-input" className="text-sm font-medium text-slate-700">
              Tags
            </label>
            <div className="flex gap-3">
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(event) => {
                  setTagInput(event.target.value);
                  setSubmitError(null);
                  clearFieldError("tags");
                }}
                onKeyDown={handleTagKeyDown}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                placeholder="Type a tag and press Enter"
              />
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Add Tag
              </button>
            </div>
            <p className="text-xs text-slate-500">Use existing suggestions or create a new tag name.</p>
            {fieldErrors.tags ? <p className="text-sm text-red-600">{fieldErrors.tags}</p> : null}
            {tagsError ? <p className="text-sm text-slate-500">{tagsError}</p> : null}
          </div>

          {form.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800 transition hover:bg-sky-200"
                >
                  {formatTagLabel(tag)} ×
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No tags selected yet.</p>
          )}

          {availableSuggestions.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Suggested Tags</p>
              <div className="flex flex-wrap gap-2">
                {availableSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    {formatTagLabel(tag)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Creating..." : "Create Thread"}
        </button>
      </form>
    </section>
  );
}
