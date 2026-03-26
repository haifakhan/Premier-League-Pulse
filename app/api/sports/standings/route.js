import { getStandings } from "../../../../lib/footballData.js";
import { getOrSetCache, CACHE_TTLS } from "../../../../lib/cache.js";

export async function GET() {
  try {
    const result = await getOrSetCache(
      "sports:pl:standings",
      CACHE_TTLS.standings,
      () => getStandings()
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
