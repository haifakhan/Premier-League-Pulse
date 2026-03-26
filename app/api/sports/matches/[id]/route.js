import { getMatch } from "../../../../../lib/footballData.js";
import { getOrSetCache, CACHE_TTLS } from "../../../../../lib/cache.js";

export async function GET(_request, context) {
  const params = await context.params;
  const idRaw = params?.id;
  const id = Number(idRaw);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      {
        cache: "MISS",
        data: null,
        error: {
          message: "Invalid match id",
          details: "id must be a positive integer",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await getOrSetCache(
      `sports:pl:match:${id}`,
      CACHE_TTLS.matchDetail,
      () => getMatch(id)
    );
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        cache: "MISS",
        data: null,
        error: { message: "Upstream error", details: err?.message },
      },
      { status: 502 }
    );
  }
}
