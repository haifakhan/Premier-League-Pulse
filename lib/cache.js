import prisma from "./prisma.js";

export const CACHE_TTLS = {
  teams: 7 * 24 * 60 * 60 * 1000,        // 7d
  standings: 2 * 60 * 60 * 1000,         // 2h
  matchesList: 60 * 60 * 1000,           // 1h
  matchDetail: 60 * 60 * 1000,           // 1h
};

// fresh only (optional helper for callers who ONLY want valid cache)
export async function getCachedFresh(key) {
  const entry = await prisma.cacheEntry.findUnique({ where: { key } });
  if (!entry) return null;
  if (entry.expiresAt <= new Date()) return null;
  return entry.payload;
}

// any (fresh or stale) + metadata (used internally)
export async function getCachedAny(key) {
  const entry = await prisma.cacheEntry.findUnique({ where: { key } });
  if (!entry) return null;

  const isExpired = entry.expiresAt <= new Date();
  return { payload: entry.payload, expiresAt: entry.expiresAt, isExpired };
}

export async function setCached(key, payload, ttlMs) {
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.cacheEntry.upsert({
    where: { key },
    update: { payload, expiresAt },
    create: { key, payload, expiresAt },
  });
}

export async function getOrSetCache(key, ttlMs, fetchFn) {
  const cached = await getCachedAny(key);

  // return fresh cache immediately
  if (cached && !cached.isExpired) {
    return { data: cached.payload, cache: "HIT" };
  }

  // expired/miss -> try fetch
  try {
    const fresh = await fetchFn();
    await setCached(key, fresh, ttlMs);
    return { data: fresh, cache: cached ? "REFRESH" : "MISS" };
  } catch (err) {
    // handout requirement: return cached payload if exists (even stale)
    if (cached) {
      return { data: cached.payload, cache: "STALE", error: err?.message };
    }
    throw err;
  }
}