type MatchPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  return <h1>Match Page: {id}</h1>;
}
