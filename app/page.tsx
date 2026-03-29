import Link from "next/link";
import HomeDailyDigest from "@/components/matches/home-daily-digest";
import HomeDashboardMatches from "@/components/matches/home-dashboard-matches";

export default function Home() {
  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-2xl bg-[url('/pl.jpg')] bg-cover bg-center"
        aria-label="Homepage hero"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/65" />

        <div className="relative flex min-h-[62vh] items-end px-5 py-10 sm:px-8 sm:py-12 lg:min-h-[68vh] lg:px-12 lg:py-14">
          <div className="max-w-3xl space-y-5 text-white">
            <p className="text-sm font-medium tracking-wide text-slate-100 sm:text-base">
              Matchday discussions, standings, and fan insight
            </p>

            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              Follow every match. Join every conversation.
            </h1>

            <p className="max-w-2xl text-base text-slate-200 sm:text-lg">
              Track fixtures, explore standings, and dive into football discussions all in one
              place.
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href="/matches"
                className="inline-flex items-center justify-center rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
              >
                Browse Matches
              </Link>
              <Link
                href="/forums"
                className="inline-flex items-center justify-center rounded-md border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                Visit Forums
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeDailyDigest />
      <HomeDashboardMatches />
    </div>
  );
}
