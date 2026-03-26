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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var KEY = "theme";
  var root = document.documentElement;
  var stored = localStorage.getItem(KEY);
  var validStored = stored === "dark" || stored === "light" ? stored : null;
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var initialTheme = validStored || (prefersDark ? "dark" : "light");

  function applyTheme(theme) {
    root.classList.toggle("dark", theme === "dark");
  }

  applyTheme(initialTheme);

  function bindThemeToggle() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
    var target = buttons.find(function (button) {
      return button.textContent && button.textContent.trim() === "Dark";
    });

    if (!target) return;

    var handler = window.__pp2ThemeToggleHandler;
    if (!handler) {
      handler = function () {
        var nextTheme = root.classList.contains("dark") ? "light" : "dark";
        applyTheme(nextTheme);
        localStorage.setItem(KEY, nextTheme);
      };
      window.__pp2ThemeToggleHandler = handler;
    }

    if (window.__pp2ThemeToggleTarget && window.__pp2ThemeToggleTarget !== target) {
      window.__pp2ThemeToggleTarget.removeEventListener("click", handler);
    }

    target.removeEventListener("click", handler);
    target.addEventListener("click", handler);
    window.__pp2ThemeToggleTarget = target;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindThemeToggle, { once: true });
  } else {
    bindThemeToggle();
  }
})();`,
          }}
        />
      </head>
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
