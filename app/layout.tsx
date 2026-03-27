import type { Metadata } from "next";
import AuthNavbar from "@/components/auth/navbar";
import { AuthProvider } from "@/lib/context/auth";
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
        <AuthProvider>
          <AuthNavbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
