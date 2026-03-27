import ForumsBrowser from "@/components/forums/forums-browser";

type ForumsPageProps = {
  searchParams: Promise<{
    teamId?: string;
  }>;
};

export default async function ForumsPage({ searchParams }: ForumsPageProps) {
  const resolvedSearchParams = await searchParams;
  const teamIdValue = resolvedSearchParams?.teamId;
  const initialTeamId =
    typeof teamIdValue === "string" && teamIdValue.trim().length > 0
      ? teamIdValue.trim()
      : null;

  return <ForumsBrowser initialTeamId={initialTeamId} />;
}
