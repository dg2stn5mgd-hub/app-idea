// Checks the server with a pretend LTA reply (no internet or LTA key needed).
// Run:  node server/test.mjs
import worker from "./worker.js";
import assert from "node:assert/strict";

const inMin = m => new Date(Date.now() + m * 60000).toISOString();
const sampleArrival = {
  "odata.metadata": "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival",
  BusStopCode: "92071",
  Services: [{
    ServiceNo: "150", Operator: "SBST",
    NextBus:  { OriginCode: "84009", DestinationCode: "84009", EstimatedArrival: inMin(4),  Monitored: 1, Latitude: "1.3061", Longitude: "103.912", VisitNumber: "1", Load: "SEA", Feature: "WAB", Type: "DD" },
    NextBus2: { OriginCode: "84009", DestinationCode: "84009", EstimatedArrival: inMin(13), Monitored: 1, Latitude: "1.3112", Longitude: "103.931", VisitNumber: "1", Load: "SDA", Feature: "WAB", Type: "SD" },
    NextBus3: { OriginCode: "", DestinationCode: "", EstimatedArrival: "", Monitored: 0, Latitude: "0", Longitude: "0", VisitNumber: "", Load: "", Feature: "", Type: "" },
  }],
};
const sampleAlerts = { value: { Status: 2, AffectedSegments: [{ Line: "TEL", Direction: "Woodlands North", Stations: "TE24,TE25,TE26", FreePublicBus: "TE24,TE25,TE26" }], Message: [{ Content: "Delays of up to 15 mins on the TEL.", CreatedDate: "" }] } };

let calls = [];
globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), key: opts.headers.AccountKey });
  const body = String(url).includes("BusArrival") ? sampleArrival : sampleAlerts;
  return new Response(JSON.stringify(body), { status: 200 });
};
const env = { LTA_ACCOUNT_KEY: "test-key", ALLOWED_ORIGIN: "https://carriage.example.com" };
const get = async path => { const r = await worker.fetch(new Request("https://live.example.com" + path), env, { waitUntil() {} }); return [r.status, await r.json(), r]; };

// Live arrivals for one service
let [status, body, res] = await get("/arrivals?stop=92071&service=150");
assert.equal(status, 200);
assert.equal(calls[0].key, "test-key", "sends the secret key to LTA");
assert.match(calls[0].url, /v3\/BusArrival\?BusStopCode=92071&ServiceNo=150$/);
assert.equal(res.headers.get("access-control-allow-origin"), "https://carriage.example.com");
const s = body.services[0];
assert.equal(s.service, "150");
assert.equal(s.buses.length, 2, "skips the empty third bus");
assert.ok(s.buses[0].minutes >= 3 && s.buses[0].minutes <= 4, "minutes until the bus arrives");
assert.deepEqual([s.buses[0].live, s.buses[0].load, s.buses[0].type, s.buses[0].wheelchair], [true, "Seats available", "Double deck", true]);
assert.equal(s.buses[1].type, "Single deck");

// Bad input is refused before calling LTA
calls = [];
[status, body] = await get("/arrivals?stop=abc");
assert.equal(status, 400); assert.equal(calls.length, 0);
[status] = await get("/arrivals?stop=92071&service=150;drop");
assert.equal(status, 400);

// Train status
[status, body] = await get("/train-alerts");
assert.equal(status, 200);
assert.equal(body.normal, false);
assert.equal(body.affected[0].line, "TEL");
assert.equal(body.messages[0], "Delays of up to 15 mins on the TEL.");

// Missing key and LTA being down give clear errors
[status, body] = await (async () => { const r = await worker.fetch(new Request("https://live.example.com/train-alerts"), {}, {}); return [r.status, await r.json()]; })();
assert.equal(status, 500); assert.match(body.error, /LTA_ACCOUNT_KEY/);
globalThis.fetch = async () => new Response("down", { status: 503 });
[status, body] = await get("/arrivals?stop=92071");
assert.equal(status, 502); assert.match(body.error, /Couldn't reach LTA/);

// A key pasted with a space and quote marks still works, and /check explains what's wrong without showing the key
calls = [];
globalThis.fetch = async (url, opts) => { calls.push({ url: String(url), key: opts.headers.AccountKey });
  return new Response(JSON.stringify(sampleArrival), { status: opts.headers.AccountKey === "test-key" ? 200 : 401 }); };
const messy = { LTA_ACCOUNT_KEY: '  "test-key"\n' };
let r = await worker.fetch(new Request("https://live.example.com/arrivals?stop=92071"), messy, { waitUntil() {} });
assert.equal(r.status, 200, "spaces and quotes around the key are removed");
r = await worker.fetch(new Request("https://live.example.com/check"), messy, {});
body = await r.json();
assert.equal(body.ltaAcceptsKey, true);
assert.equal(body.keyLength, 8);
assert.equal(body.notes.length, 2);
assert.ok(!JSON.stringify(body).includes("test-key"), "never shows the key");
r = await worker.fetch(new Request("https://live.example.com/check"), { LTA_ACCOUNT_KEY: "wrong-key" }, {});
body = await r.json();
assert.equal(body.ltaAcceptsKey, false); assert.equal(body.ltaAnswers.busArrival, 401); assert.match(body.advice, /doesn't accept/);
r = await worker.fetch(new Request("https://live.example.com/check"), {}, {});
assert.equal((await r.json()).keySaved, false);

// Place search: OneMap's capitals become normal names, duplicates are dropped, no LTA key needed
calls = [];
globalThis.fetch = async (url, opts) => { calls.push({ url: String(url), headers: opts && opts.headers });
  return new Response(JSON.stringify({ found: 3, results: [
    { SEARCHVAL: "DUNMAN HIGH SCHOOL", BLK_NO: "10", ROAD_NAME: "TANJONG RHU ROAD", BUILDING: "DUNMAN HIGH SCHOOL", ADDRESS: "10 TANJONG RHU ROAD DUNMAN HIGH SCHOOL SINGAPORE 436895", POSTAL: "436895", LATITUDE: "1.2994", LONGITUDE: "103.8834" },
    { SEARCHVAL: "DUNMAN HIGH SCHOOL", BLK_NO: "10", ROAD_NAME: "TANJONG RHU ROAD", BUILDING: "DUNMAN HIGH SCHOOL", ADDRESS: "10 TANJONG RHU ROAD DUNMAN HIGH SCHOOL SINGAPORE 436895", POSTAL: "436895", LATITUDE: "1.2994", LONGITUDE: "103.8834" },
    { SEARCHVAL: "NO PLACE", BUILDING: "NIL", ADDRESS: "", POSTAL: "NIL", LATITUDE: "", LONGITUDE: "" }] }), { status: 200 }); };
r = await worker.fetch(new Request("https://live.example.com/search?q=dunman%20high%20school"), {}, { waitUntil() {} });
body = await r.json();
assert.equal(r.status, 200, "search works even without the LTA key");
assert.match(calls[0].url, /onemap\.gov\.sg\/api\/common\/elastic\/search\?searchVal=dunman\+high\+school&returnGeom=Y/);
assert.equal(body.results.length, 1, "duplicates and places without a location are dropped");
assert.deepEqual(body.results[0], { name: "Dunman High School", address: "10 Tanjong Rhu Road Dunman High School Singapore 436895", postal: "436895", lat: 1.2994, lng: 103.8834 });
r = await worker.fetch(new Request("https://live.example.com/search?q=a"), {}, {});
assert.equal(r.status, 400);
globalThis.fetch = async () => new Response("no", { status: 500 });
r = await worker.fetch(new Request("https://live.example.com/search?q=dunman"), {}, {});
assert.equal(r.status, 502); assert.match((await r.json()).error, /OneMap/);

// Walking directions: logs in to OneMap once, reuses the pass, and turns OneMap's answer into simple steps
let logins = 0; calls = [];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); calls.push({ url, headers: opts.headers });
  if (url.includes("getToken")) { logins++; assert.deepEqual(JSON.parse(opts.body), { email: "me@example.com", password: "pw" });
    return new Response(JSON.stringify({ access_token: "pass-" + logins, expiry_timestamp: String(Math.floor(Date.now() / 1000) + 3 * 86400) }), { status: 200 }); }
  if (url.includes("routingsvc")) return new Response(JSON.stringify({ status: 0, route_geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    route_instructions: [["Head", "TANJONG RHU ROAD", 120, "1.2995,103.8823", 86, "120m", "West", "west", "walking", "Head West On Tanjong Rhu Road"],
                         ["Left", "FORT ROAD", 200, "1.2994,103.8790", 144, "200m", "South", "south", "walking", "Turn Left Onto Fort Road"]],
    route_summary: { total_distance: 320, total_time: 230 } }), { status: 200 });
  return new Response("{}", { status: 404 });
};
const walkEnv = { ONEMAP_EMAIL: " me@example.com ", ONEMAP_PASSWORD: "pw" };
r = await worker.fetch(new Request("https://live.example.com/walk?from=1.2995,103.8823&to=1.2993,103.8746"), walkEnv, { waitUntil() {} });
body = await r.json();
assert.equal(r.status, 200, JSON.stringify(body));
assert.deepEqual(body.points, [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]], "decodes the route's shape");
assert.deepEqual(body.steps[1], { text: "Turn Left Onto Fort Road", metres: 200, lat: 1.2994, lng: 103.879 });
assert.equal(body.metres, 320); assert.equal(body.seconds, 230);
assert.equal(calls.find(c => c.url.includes("routingsvc")).headers.Authorization, "pass-1");
await worker.fetch(new Request("https://live.example.com/walk?from=1.2995,103.8823&to=1.2993,103.8746"), walkEnv, { waitUntil() {} });
assert.equal(logins, 1, "reuses the OneMap pass");
r = await worker.fetch(new Request("https://live.example.com/walk?from=1.2995,103.8823&to=1.4400,103.8000"), walkEnv, {});
assert.equal(r.status, 400, "too far to walk");
r = await worker.fetch(new Request("https://live.example.com/walk?from=abc&to=1.2993,103.8746"), walkEnv, {});
assert.equal(r.status, 400);
r = await worker.fetch(new Request("https://live.example.com/walk?from=1.2995,103.8823&to=1.2993,103.8746"), {}, {});
assert.equal(r.status, 501); assert.match((await r.json()).error, /ONEMAP_EMAIL/);

console.log("All server checks passed.");
