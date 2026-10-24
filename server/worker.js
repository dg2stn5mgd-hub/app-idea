// Carriage live-data server (Cloudflare Worker).
//
// The app asks this server for live bus arrivals and train service status. The server asks
// LTA DataMall using the secret LTA_ACCOUNT_KEY, so the key never ends up inside the app.
//
//   GET /arrivals?stop=92071&service=150   next 3 buses of one service at one stop
//   GET /arrivals?stop=92071               every service at that stop
//   GET /train-alerts                      MRT service status (normal or disrupted)

const DATAMALL = "https://datamall2.mytransport.sg/ltaodataservice";
const CACHE_SECONDS = 20;   // LTA updates arrivals about every 20 s; caching saves your quota

// What LTA's short codes mean
const LOAD = { SEA: "Seats available", SDA: "Standing available", LSD: "Limited standing" };
const TYPE = { SD: "Single deck", DD: "Double deck", BD: "Bendy" };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return reply(null, 204, env);
    if (request.method !== "GET") return reply({ error: "Use GET." }, 405, env);
    if (!env.LTA_ACCOUNT_KEY) return reply({ error: "The server has no LTA_ACCOUNT_KEY yet. Add it in Settings → Variables and Secrets." }, 500, env);

    try {
      if (url.pathname === "/arrivals") return await arrivals(url, env, ctx);
      if (url.pathname === "/train-alerts") return await trainAlerts(env, ctx);
      return reply({ error: "Try /arrivals?stop=92071&service=150 or /train-alerts." }, 404, env);
    } catch (e) {
      return reply({ error: "Couldn't reach LTA DataMall. Try again in a moment.", detail: String(e && e.message || e) }, 502, env);
    }
  },
};

async function arrivals(url, env, ctx) {
  const stop = url.searchParams.get("stop") || "";
  const service = url.searchParams.get("service") || "";
  if (!/^\d{5}$/.test(stop)) return reply({ error: "stop must be a 5-digit bus stop code, like 92071." }, 400, env);
  if (service && !/^[0-9]{1,3}[A-Za-z]{0,2}$/.test(service)) return reply({ error: "service must be a bus number, like 150 or 196e." }, 400, env);

  const q = new URLSearchParams({ BusStopCode: stop });
  if (service) q.set("ServiceNo", service.toUpperCase());
  const data = await datamall(`/v3/BusArrival?${q}`, env, ctx);

  const now = Date.now();
  const services = (data.Services || []).map(s => ({
    service: s.ServiceNo,
    operator: s.Operator,
    buses: [s.NextBus, s.NextBus2, s.NextBus3]
      .filter(b => b && b.EstimatedArrival)
      .map(b => {
        const at = new Date(b.EstimatedArrival);
        return {
          at: b.EstimatedArrival,                          // e.g. 2026-10-26T07:53:12+08:00
          minutes: Math.max(0, Math.round((at - now) / 60000)),
          live: Number(b.Monitored) === 1,                 // 1 = tracked by GPS, 0 = from the timetable
          load: LOAD[b.Load] || b.Load || null,
          type: TYPE[b.Type] || b.Type || null,
          wheelchair: b.Feature === "WAB",
          lat: Number(b.Latitude) || null,
          lng: Number(b.Longitude) || null,
        };
      }),
  }));
  return reply({ stop, fetchedAt: new Date(now).toISOString(), services }, 200, env);
}

async function trainAlerts(env, ctx) {
  const data = await datamall("/TrainServiceAlerts", env, ctx);
  const v = data.value || data;
  return reply({
    normal: Number(v.Status) !== 2,
    affected: (v.AffectedSegments || []).map(a => ({ line: a.Line, direction: a.Direction, stations: a.Stations, freeBus: a.FreePublicBus })),
    messages: (v.Message || []).map(m => m.Content).filter(Boolean),
  }, 200, env);
}

// Calls DataMall with the secret key, reusing an answer for CACHE_SECONDS
async function datamall(path, env, ctx) {
  const target = DATAMALL + path;
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(target);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json();
  }
  const res = await fetch(target, { headers: { AccountKey: env.LTA_ACCOUNT_KEY, accept: "application/json" } });
  if (!res.ok) throw new Error(`DataMall answered ${res.status}`);
  const body = await res.text();
  if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { "cache-control": `max-age=${CACHE_SECONDS}`, "content-type": "application/json" } })));
  return JSON.parse(body);
}

function reply(body, status, env) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Only the app's own site may call this server. Set ALLOWED_ORIGIN, e.g. https://carriage.example.com
      "access-control-allow-origin": (env && env.ALLOWED_ORIGIN) || "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "cache-control": "no-store",
    },
  });
}
