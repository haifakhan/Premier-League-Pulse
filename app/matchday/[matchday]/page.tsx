type MatchdayPageProps = {
  params: Promise<{
    matchday: string;
  }>;
};

export default async function MatchdayPage({ params }: MatchdayPageProps) {
  const { matchday } = await params;

  return <h1>Matchday Page: {matchday}</h1>;
}
