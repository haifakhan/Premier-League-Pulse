"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AuthApiError, getCurrentUser, login as loginRequest } from "@/lib/api/auth";
import { useAuth } from "@/lib/context/auth";

function getOAuthErrorMessage(errorCode: string) {
  switch (errorCode) {
    case "invalid_state":
      return "Google sign-in expired. Please try again.";
    case "missing_code":
      return "Google sign-in did not return a valid code.";
    case "token_exchange":
    case "profile_fetch":
    case "oauth_failed":
      return "Google sign-in failed. Please try again.";
    case "unverified_email":
      return "Google account email must be verified.";
    case "oauth_config":
      return "Google sign-in is not configured yet.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handledOAuthRef = useRef(false);

  useEffect(() => {
    const oauthError = searchParams.get("oauthError");
    if (!oauthError) {
      return;
    }
    setError(getOAuthErrorMessage(oauthError));
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("oauthError");
    window.history.replaceState(
      null,
      "",
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    );
  }, [searchParams]);

  useEffect(() => {
    if (handledOAuthRef.current) {
      return;
    }

    const hash = window.location.hash;
    if (!hash.startsWith("#")) {
      return;
    }

    const hashParams = new URLSearchParams(hash.slice(1));
    const oauthToken = hashParams.get("oauthToken");

    if (!oauthToken) {
      return;
    }

    handledOAuthRef.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    async function completeOAuthLogin() {
      setError("");
      setIsSubmitting(true);

      try {
        await login(oauthToken);
        const currentUser = await getCurrentUser(oauthToken);
        router.push(currentUser.isBanned ? "/appeals" : "/");
      } catch {
        setError("Unable to log in right now");
        handledOAuthRef.current = false;
      } finally {
        setIsSubmitting(false);
      }
    }

    void completeOAuthLogin();
  }, [login, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await loginRequest({ email, password });
      await login(response.token);
      router.push(response.user.isBanned ? "/appeals" : "/");
    } catch (caughtError) {
      if (caughtError instanceof AuthApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to log in right now");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-md items-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
            Account Access
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Log in</h1>
          <p className="text-sm text-slate-600">
            Use your email and password to access the dashboard.
          </p>
        </div>

        <Link
          href="/api/auth/google/start"
          className="mb-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Continue with Google
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Need an account?{" "}
          <Link href="/signup" className="font-medium text-sky-700 hover:text-sky-600">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Account restricted? Log in and submit an appeal request from your account menu.
        </p>
      </div>
    </section>
  );
}
