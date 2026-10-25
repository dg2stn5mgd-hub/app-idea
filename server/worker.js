// Carriage live-data server (Cloudflare Worker).
//
// The app asks this server for live bus arrivals and train service status. The server asks
// LTA DataMall using the secret LTA_ACCOUNT_KEY, so the key never ends up inside the app.
// It also looks up places (schools, buildings, addresses, postal codes) on OneMap, Singapore's official map.
//
//   GET /arrivals?stop=92071&service=150   next 3 buses of one service at one stop
//   GET /arrivals?stop=92071               every service at that stop
//   GET /train-alerts                      MRT service status (normal or disrupted)
//   GET /search?q=dunman%20high%20school   find a place: name, address and where it is
//   GET /walk?from=1.2995,103.8823&to=1.2993,103.8746   walking directions along the streets (OneMap)
//   GET /check                             is the saved key OK? (never shows the key itself)

const DATAMALL = "https://datamall2.mytransport.sg/ltaodataservice";
const ONEMAP_SEARCH = "https://www.onemap.gov.sg/api/common/elastic/search";
const ONEMAP_LOGIN = "https://www.onemap.gov.sg/api/auth/post/getToken";
const ONEMAP_ROUTE = "https://www.onemap.gov.sg/api/public/routingsvc/route";
const CACHE_SECONDS = 20;   // LTA updates arrivals about every 20 s; caching saves your quota

// What LTA's short codes mean
const LOAD = { SEA: "Seats available", SDA: "Standing available", LSD: "Limited standing" };
const TYPE = { SD: "Single deck", DD: "Double deck", BD: "Bendy" };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return reply(null, 204, env);
    if (request.method !== "GET") return reply({ error: "Use GET." }, 405, env);
    if (url.pathname === "/check") return await check(env);
    if (url.pathname === "/search") {
      try { return await search(url, env, ctx); }
      catch (e) { return reply({ error: "Couldn't reach OneMap. Try again in a moment.", detail: String(e && e.message || e) }, 502, env); }
    }
    if (url.pathname === "/walk") {
      try { return await walk(url, env, ctx); }
      catch (e) { return reply({ error: String(e && e.message || e) }, 502, env); }
    }
    if (!cleanKey(env)) return reply({ error: "The server has no LTA_ACCOUNT_KEY yet. Add it in Settings → Variables and Secrets." }, 500, env);

    try {
      if (url.pathname === "/arrivals") return await arrivals(url, env, ctx);
      if (url.pathname === "/train-alerts") return await trainAlerts(env, ctx);
      return reply({ error: "Try /arrivals?stop=92071&service=150 or /train-alerts." }, 404, env);
    } catch (e) {
      return reply({ error: "Couldn't reach LTA DataMall. Try again in a moment.", detail: String(e && e.message || e) }, 502, env);
    }
  },
};

// The key as LTA expects it: no spaces, line breaks or quote marks around it (easy to paste by accident)
const cleanKey = env => String(env.LTA_ACCOUNT_KEY || "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();

// Place search on OneMap. No key needed; if OneMap ever asks for one, add ONEMAP_TOKEN as a secret.
async function search(url, env, ctx) {
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2 || q.length > 60) return reply({ error: "q must be 2 to 60 characters, like dunman high school or 436895." }, 400, env);
  const target = ONEMAP_SEARCH + "?" + new URLSearchParams({ searchVal: q, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
  const data = await cachedJson(target, env.ONEMAP_TOKEN ? { Authorization: env.ONEMAP_TOKEN } : {}, 86400, ctx);
  const seen = new Set();
  const results = (data.results || []).map(r => ({
    name: titleCase(r.BUILDING && r.BUILDING !== "NIL" ? r.BUILDING : r.SEARCHVAL),
    address: titleCase(r.ADDRESS || ""),
    postal: r.POSTAL && r.POSTAL !== "NIL" ? r.POSTAL : null,
    lat: Number(r.LATITUDE), lng: Number(r.LONGITUDE),
  })).filter(r => r.lat && r.lng && !seen.has(r.name + r.postal) && seen.add(r.name + r.postal)).slice(0, 8);
  return reply({ query: q, results }, 200, env);
}
// Walking directions from OneMap. Routing needs a OneMap account: the server logs in with the secrets
// ONEMAP_EMAIL and ONEMAP_PASSWORD, and logs in again by itself when the pass runs out (every 3 days).
let onemapPass = null;                       // { token, expires } kept while this copy of the server runs
async function onemapToken(env, fresh) {
  if (!fresh && onemapPass && onemapPass.expires - Date.now() > 3600000) return onemapPass.token;
  const res = await fetch(ONEMAP_LOGIN, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: String(env.ONEMAP_EMAIL).trim(), password: String(env.ONEMAP_PASSWORD) }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`OneMap didn't accept the login (answered ${res.status}). Check ONEMAP_EMAIL and ONEMAP_PASSWORD.`);
  const exp = Number(body.expiry_timestamp);
  onemapPass = { token: body.access_token, expires: exp > 1e12 ? exp : exp > 0 ? exp * 1000 : Date.now() + 2 * 86400000 };
  return onemapPass.token;
}
const LATLNG = /^(1\.\d{1,7}),(10[34]\.\d{1,7})$/;
async function walk(url, env, ctx) {
  const a = (url.searchParams.get("from") || "").match(LATLNG), b = (url.searchParams.get("to") || "").match(LATLNG);
  if (!a || !b) return reply({ error: "from and to must be lat,lng in Singapore, like 1.2995,103.8823." }, 400, env);
  const from = [Number(a[1]), Number(a[2])], to = [Number(b[1]), Number(b[2])];
  const km = Math.hypot(from[0] - to[0], from[1] - to[1]) * 111.3;
  if (km > 3) return reply({ error: "That's more than 3 km apart: too far to walk." }, 400, env);
  if (!env.ONEMAP_EMAIL || !env.ONEMAP_PASSWORD) return reply({ error: "Walking directions aren't set up: add ONEMAP_EMAIL and ONEMAP_PASSWORD as secrets." }, 501, env);

  // Same walk asked before (to about 10 m)? Reuse it for a week
  const round = p => p.map(x => x.toFixed(4)).join(",");
  const cache = typeof caches !== "undefined" ? caches.default : null, cacheKey = new Request(`https://carriage-cache/walk/${round(from)}/${round(to)}`);
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return reply(await hit.json(), 200, env); }

  const ask = async fresh => fetch(ONEMAP_ROUTE + "?" + new URLSearchParams({ start: from.join(","), end: to.join(","), routeType: "walk" }),
    { headers: { Authorization: await onemapToken(env, fresh), accept: "application/json" } });
  let res = await ask(false);
  if (res.status === 401 || res.status === 403) res = await ask(true);     // pass ran out early: log in again once
  if (!res.ok) throw new Error(`OneMap routing answered ${res.status}.`);
  const data = await res.json();
  if (!data.route_geometry) throw new Error("OneMap found no walking route.");
  const steps = (data.route_instructions || []).map(ins => {
    const [lat, lng] = String(ins[3] || "").split(",").map(Number);
    const words = ins.find((x, i) => i > 3 && typeof x === "string" && / /.test(x) && /[a-z]/.test(x));
    return { text: words || `${ins[0] || "Continue"} ${titleCase(ins[1] || "")}`.trim(), metres: Number(ins[2]) || 0, lat, lng };
  }).filter(x => x.lat && x.lng);
  const out = { points: decodePolyline(data.route_geometry), steps,
    metres: Number(data.route_summary && data.route_summary.total_distance) || null,
    seconds: Number(data.route_summary && data.route_summary.total_time) || null };
  if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=604800", "content-type": "application/json" } })));
  return reply(out, 200, env);
}
// OneMap sends the route's shape as a Google-style "encoded polyline": turn it into [lat, lng] points
function decodePolyline(str) {
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, byte;
      do { byte = str.charCodeAt(i++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    pts.push([+(lat / 1e5).toFixed(6), +(lng / 1e5).toFixed(6)]);
  }
  return pts;
}

// OneMap answers in capitals: "DUNMAN HIGH SCHOOL" -> "Dunman High School"
const titleCase = t => String(t).toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bSingapore (\d{6})\b/, "Singapore $1");

// Self-check: describes the saved key and asks LTA whether it accepts it, without revealing the key
async function check(env) {
  const raw = String(env.LTA_ACCOUNT_KEY || ""), key = cleanKey(env);
  if (!raw) return reply({ keySaved: false, advice: "No LTA_ACCOUNT_KEY saved. Add it in Settings → Variables and Secrets (type: Secret)." }, 200, env);
  const ask = async path => {
    try { const r = await fetch(DATAMALL + path, { headers: { AccountKey: key, accept: "application/json" } }); return r.status; }
    catch (e) { return "no answer"; }
  };
  const [bus, train] = await Promise.all([ask("/v3/BusArrival?BusStopCode=92071"), ask("/TrainServiceAlerts")]);
  let places;
  try { places = (await fetch(ONEMAP_SEARCH + "?searchVal=dunman%20high%20school&returnGeom=Y&getAddrDetails=Y&pageNum=1")).status; }
  catch (e) { places = "no answer"; }
  let walking = "not set up: add ONEMAP_EMAIL and ONEMAP_PASSWORD as secrets";
  if (env.ONEMAP_EMAIL && env.ONEMAP_PASSWORD) {
    try { await onemapToken(env, true); walking = "working: OneMap accepted the login"; }
    catch (e) { walking = String(e.message || e); }
  }
  const notes = [];
  if (raw !== raw.trim()) notes.push("The saved key has spaces or line breaks at the start or end. This check removes them before asking LTA.");
  if (/["'“”‘’]/.test(raw)) notes.push("The saved key has quote marks around it. This check removes them before asking LTA.");
  if (/\s/.test(key)) notes.push("The key has a space in the middle. It should be one unbroken string of letters and numbers.");
  if (/accountkey|key:/i.test(key)) notes.push("The saved value seems to include a label like 'AccountKey:'. Save only the key itself.");
  const ok = bus === 200;
  return reply({
    keySaved: true,
    keyLength: key.length,
    keyStartsWith: key.slice(0, 2) + "…",      // two characters only, so you can spot a copy slip
    keyEndsWith: "…" + key.slice(-2),
    ltaAcceptsKey: ok,
    ltaAnswers: { busArrival: bus, trainAlerts: train },
    placeSearch: places === 200 ? "working" : `OneMap answered ${places}`,
    walkingDirections: walking,
    notes,
    advice: ok ? "All good: LTA accepts the key. Try /arrivals?stop=92071."
      : bus === 401 || bus === 403 ? "LTA doesn't accept this key. Compare the length and first/last characters with the key in LTA's email. If they match, the key may not be switched on yet: wait an hour, or check LTA's email for an activation step."
      : "LTA didn't answer normally. Try again in a few minutes.",
  }, 200, env);
}

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
  return cachedJson(DATAMALL + path, { AccountKey: cleanKey(env) }, CACHE_SECONDS, ctx);
}

// Fetches JSON, reusing the answer for `seconds` so repeat questions don't use up quotas
async function cachedJson(target, headers, seconds, ctx) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(target);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json();
  }
  const res = await fetch(target, { headers: { ...headers, accept: "application/json" } });
  if (!res.ok) throw new Error(`${new URL(target).hostname.includes("onemap") ? "OneMap" : "DataMall"} answered ${res.status}`);
  const body = await res.text();
  if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { "cache-control": `max-age=${seconds}`, "content-type": "application/json" } })));
  return JSON.parse(body);
}

function reply(body, status, env) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Only the app's own site may call this server. Set ALLOWED_ORIGIN, e.g. https://carriage.example.com
      "access-control-allow-origin": (env && env.ALLOWED_ORIGIN) || "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "cache-control": "no-store",
    },
  });
}
