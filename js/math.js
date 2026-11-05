// Vector maths + input parsing. Vectors are plain arrays [x, y, z].

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);

export const EPS = 1e-9;
export const isZero = (x) => Math.abs(x) < EPS;
export const isZeroVec = (a) => len(a) < EPS;

// Acute angle (radians) between two directions.
export const acuteAngle = (u, v) =>
  Math.acos(Math.min(1, Math.abs(dot(u, v)) / (len(u) * len(v))));

const gcd = (a, b) => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export { gcd };

// Best rational p/q (q <= maxQ) equal to v, or null. The first q found is the smallest,
// so the fraction is already in lowest terms.
export function toFraction(v, maxQ = 1000) {
  for (let q = 1; q <= maxQ; q++) {
    const p = Math.round(v * q);
    if (Math.abs(p / q - v) < 1e-9 * Math.max(1, Math.abs(v))) return [p, q];
  }
  return null;
}

// Scale a direction to the simplest integer multiple, e.g. (2, -4, 6) -> (1, -2, 3),
// (1/2, 1/3, 0) -> (3, 2, 0). Leaves irrational directions alone.
export function simplifyDir(v) {
  const fr = v.map((x) => toFraction(x));
  if (fr.some((f) => f === null)) return v;
  const lcm = fr.reduce((m, [, q]) => (m * q) / gcd(m, q), 1);
  const ints = fr.map(([p, q]) => (p * lcm) / q);
  const g = ints.reduce((a, b) => gcd(a, b), 0) || 1;
  let out = ints.map((x) => x / g);
  // Prefer a positive first non-zero component, like textbook answers.
  const first = out.find((x) => x !== 0);
  if (first < 0) out = out.map((x) => -x);
  return out.map((x) => x + 0); // turn -0 into 0
}

// ---------- parsing ----------

const NUM = String.raw`(?:\d+\.?\d*|\.\d+)`;
const SCALAR_RE = new RegExp(`^[+-]?${NUM}(?:/${NUM})?$`);

export function parseScalar(str) {
  const s = String(str).replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (s === '') throw new Error('Enter a number');
  if (!SCALAR_RE.test(s)) throw new Error(`"${String(str).trim()}" isn't a number`);
  const [p, q] = s.split('/');
  const v = q === undefined ? parseFloat(p) : parseFloat(p) / parseFloat(q);
  if (!isFinite(v)) throw new Error("Can't divide by zero");
  return v;
}

// Accepts "(1, 2, 3)", "1 2 3", "[1,2,3]", "1/2, -3, 0.5" or "2i - j + 3k".
export function parseVector(str) {
  const s = String(str).trim().replace(/[−–]/g, '-');
  if (s === '') throw new Error('Enter a vector, e.g. (1, 2, 3)');
  if (/[ijk]/i.test(s)) return parseIJK(s);
  const inner = s.replace(/^[([<]\s*/, '').replace(/\s*[)\]>]$/, '');
  const parts = inner.split(/\s*,\s*|\s+/).filter(Boolean);
  if (parts.length !== 3) throw new Error('Needs 3 components, e.g. (1, 2, 3)');
  return parts.map(parseScalar);
}

function parseIJK(s) {
  const t = s.replace(/\s+/g, '').toLowerCase();
  const re = /([+-]?)([0-9./]*)([ijk])/g;
  const v = [0, 0, 0];
  let m, pos = 0;
  while ((m = re.exec(t))) {
    if (m.index !== pos) break;
    pos = re.lastIndex;
    const c = m[2] === '' ? 1 : parseScalar(m[2]);
    v['ijk'.indexOf(m[3])] += (m[1] === '-' ? -1 : 1) * c;
  }
  if (pos === 0 || pos !== t.length) throw new Error("Couldn't read that. Try (1, 2, 3) or i + 2j + 3k");
  return v;
}
