"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/context/auth";

export default function AuthNavbar() {
  const { user, isLoading, logout } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }

    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const mainLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/matches", label: "Matches" },
    { href: "/standings", label: "Standings" },
    { href: "/forums", label: "Forums" },
  ];

  const adminLinks =
    user?.role === "ADMIN"
      ? [
          { href: "/admin/moderation", label: "Moderation" },
          { href: "/admin/appeals", label: "Appeals" },
        ]
      : [];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isMenuOpen]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label="Home" className="inline-flex items-center">
            <Image
              src="/pllogo.png"
              alt="Premier League logo"
              width={140}
              height={44}
              className="h-11 w-auto object-contain"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="cursor-pointer rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:px-3"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          {isLoading ? (
            <div className="h-9 w-24 rounded border border-slate-300 bg-slate-100" aria-hidden="true" />
          ) : user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="cursor-pointer max-w-[8.5rem] truncate rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:max-w-none sm:px-3"
              >
                <span className="hidden sm:inline">{user.username}</span>
                <span className="sm:hidden">Account</span>
              </button>
              {isMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-48 rounded border border-slate-200 bg-white p-1 shadow-md">
                <Link
                  href="/profile"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  View Profile
                </Link>
                <Link
                  href="/profile/edit"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Edit Profile
                </Link>
                {user.role === "ADMIN" ? (
                  <>
                    <Link
                      href="/admin/moderation"
                      onClick={() => setIsMenuOpen(false)}
                      className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Moderation
                    </Link>
                    <Link
                      href="/admin/appeals"
                      onClick={() => setIsMenuOpen(false)}
                      className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Appeals Queue
                    </Link>
                  </>
                ) : null}
                {user.isBanned ? (
                  <Link
                    href="/appeals"
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Submit Appeal
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void logout();
                  }}
                  className="block w-full cursor-pointer rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  Logout
                </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
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

          <button
            type="button"
            onClick={() => {
              setIsMobileNavOpen((current) => !current);
              setIsMenuOpen(false);
            }}
            aria-expanded={isMobileNavOpen}
            aria-label="Toggle navigation"
            className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 sm:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              {isMobileNavOpen ? (
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="border-t border-slate-200 bg-white sm:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            {!user ? (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Sign Up
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
