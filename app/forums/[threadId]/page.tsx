type ThreadPageProps = {
  params: Promise<{
    threadId: string;
  }>;
};

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadId } = await params;

  return <h1>Thread Page: {threadId}</h1>;
}
