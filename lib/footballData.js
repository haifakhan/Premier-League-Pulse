const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "PL";

function getApiKey() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing FOOTBALL_DATA_API_KEY environment variable");
  }
  return apiKey;
}

function buildUrl(path, query) {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request(path, { query, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildUrl(path, query), {
      headers: { "X-Auth-Token": getApiKey() },
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const err = new Error(`football-data.org error ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(t);
  }
}

export async function getTeams() {
  return request(`/competitions/${COMPETITION}/teams`);
}

export async function getStandings() {
  return request(`/competitions/${COMPETITION}/standings`);
}

export async function getMatches({ status, matchday } = {}) {
  return request(`/competitions/${COMPETITION}/matches`, {
    query: { status, matchday },
  });
}

export async function getMatch(id) {
  return request(`/matches/${id}`);
}
