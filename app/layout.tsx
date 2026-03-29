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
