import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PP2",
  description: "PP2 frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-5">
              <Link href="/" className="text-sm font-semibold tracking-wide text-sky-700">
                PP2
              </Link>
              <nav className="hidden items-center gap-1 sm:flex">
                <Link
                  href="/"
                  className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
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
              <details className="relative">
                <summary className="list-none cursor-pointer rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
                  Profile
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-48 rounded border border-slate-200 bg-white p-1 shadow-md">
                  <Link
                    href="/profile"
                    className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    My Feed
                  </button>
                  <Link
                    href="/profile/edit"
                    className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Settings/Edit Profile
                  </Link>
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Logout
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
