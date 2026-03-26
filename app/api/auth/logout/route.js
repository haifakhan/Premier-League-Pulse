export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ message: "Logged out" }, { status: 200 });
}
