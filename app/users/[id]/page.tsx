type UserProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params;

  return <h1>User Profile Page: {id}</h1>;
}
