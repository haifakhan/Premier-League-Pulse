"use client";

import Link from "next/link";
import { useAuth } from "@/lib/context/auth";

export default function AuthNavbar() {
  const { user, isLoading, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-sm font-semibold tracking-wide text-sky-700">
            PP2
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/" className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              Dashboard
            </Link>
            <Link
              href="/matches"
              className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Matches
            </Link>
            <Link
              href="/standings"
              className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Standings
            </Link>
            <Link
              href="/forums"
              className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Forums
            </Link>
            {user?.role === "ADMIN" ? (
              <>
                <Link
                  href="/admin/moderation"
                  className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Moderation
                </Link>
                <Link
                  href="/admin/appeals"
                  className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Appeals
                </Link>
              </>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded border border-slate-300 px-2 py-1.5 sm:flex">
            <span className="text-xs text-slate-500">Search</span>
            <input
              type="text"
              placeholder="Search..."
              className="w-36 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              aria-label="Search"
            />
          </div>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Dark
          </button>

          {isLoading ? (
            <div className="h-9 w-24 rounded border border-slate-300 bg-slate-100" aria-hidden="true" />
          ) : user ? (
            <details className="relative">
              <summary className="list-none cursor-pointer rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
                {user.username}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-48 rounded border border-slate-200 bg-white p-1 shadow-md">
                <Link
                  href="/profile"
                  className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  View Profile
                </Link>
                <Link
                  href="/profile/edit"
                  className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Edit Profile
                </Link>
                {user.role === "ADMIN" ? (
                  <>
                    <Link
                      href="/admin/moderation"
                      className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Moderation
                    </Link>
                    <Link
                      href="/admin/appeals"
                      className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Appeals Queue
                    </Link>
                  </>
                ) : null}
                {user.isBanned ? (
                  <Link
                    href="/appeals"
                    className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Submit Appeal
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  Logout
                </button>
              </div>
            </details>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
