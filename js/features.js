// Finds the key features of y = f(x) numerically, like a graphing calculator would:
// axial intercepts, turning points, vertical / horizontal / oblique asymptotes and symmetry.
import { toFraction } from './math.js';

const MINUS = '−';

// Round to a "nice" value if the number is very close to one (a fraction with a small denominator,
// or a simple multiple of π, √2, √3), otherwise give 3 significant figures like an exam answer.
export function nice(v, { exactOnly = false } = {}) {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e-7) return '0';
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(v * q);
    if (Math.abs(p / q - v) < 1e-6 * Math.max(1, Math.abs(v))) {
      const s = p < 0 ? MINUS : '';
      return q === 1 ? `${s}${Math.abs(p)}` : `${s}${Math.abs(p)}/${q}`;
    }
  }
  for (const [k, name] of [[Math.SQRT2, '√2'], [Math.sqrt(3), '√3'], [Math.sqrt(5), '√5'], [Math.PI, 'π']]) {
    for (const q of [1, 2, 3, 4, 6]) {
      const p = Math.round((v * q) / k);
      if (p !== 0 && Math.abs((p * k) / q - v) < 1e-7 * Math.max(1, Math.abs(v))) {
        const s = p < 0 ? MINUS : '';
        const num = Math.abs(p) === 1 ? name : `${Math.abs(p)}${name}`;
        return `${s}${num}${q === 1 ? '' : '/' + q}`;
      }
    }
  }
  if (exactOnly) return null;
  return sf3(v);
}
export const sf3 = (v) => {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e-9) return '0';
  return String(Number(v.toPrecision(3))).replace('-', MINUS);
};
// Exact fraction for slider maths, e.g. 3/2. Falls back to 3 s.f.
export function frac(v) {
  if (Math.abs(v) < 1e-10) return '0';
  const fr = toFraction(v, 200);
  if (!fr) return sf3(v);
  const [p, q] = fr;
  const s = p < 0 ? MINUS : '';
  return q === 1 ? `${s}${Math.abs(p)}` : `${s}${Math.abs(p)}/${q}`;
}
export const pt = (x, y) => `(${nice(x)}, ${nice(y)})`;

// Snap numbers that are almost exactly nice, so features land on the exact value.
function snap(v) {
  if (Math.abs(v) < 1e-7) return 0;
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(v * q);
    if (Math.abs(p / q - v) < 1e-7 * Math.max(1, Math.abs(v))) return p / q;
  }
  return v;
}

const deriv = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);

export function findFeatures(f, lo = -10, hi = 10, n = 4000) {
  const xs = [], ys = [];
  for (let i = 0; i <= n; i++) { const x = lo + ((hi - lo) * i) / n; xs.push(x); ys.push(f(x)); }
  const dx = (hi - lo) / n;
  const finite = ys.filter(Number.isFinite);
  const scale = finite.length ? Math.max(1, median(finite.map(Math.abs))) : 1;

  // --- vertical asymptotes: the function blows up between two samples, or at the edge of its domain ---
  const vas = [];
  // |f| keeps growing as you close in on x (from one side or both): a pole, or a log-type edge like ln x at 0.
  // Exponential growth or a finite limit doesn't keep growing at tiny scales, so it's rejected.
  const grows = (x, side = 0) => {
    const g = (h) => {
      const v = (side >= 0 ? [f(x + h)] : []).concat(side <= 0 ? [f(x - h)] : []).filter(Number.isFinite).map(Math.abs);
      return v.length ? Math.max(...v) : NaN;
    };
    const g12 = g(1e-12), g8 = g(1e-8), g4 = g(1e-4);
    return g12 > g8 + 4 && g8 > g4 + 4;
  };
  const addVA = (x) => {
    x = snap(x);
    if (!vas.some((v) => Math.abs(v - x) < dx * 2)) vas.push(x);
  };
  for (let i = 0; i < n; i++) {
    const a = ys[i], b = ys[i + 1];
    const fa = Number.isFinite(a), fb = Number.isFinite(b);
    if (fa !== fb) {
      // edge of the domain: find it, then see if f blows up there
      let l = xs[i], r = xs[i + 1];
      for (let k = 0; k < 80; k++) { const m = (l + r) / 2; (Number.isFinite(f(m)) === fa) ? (l = m) : (r = m); }
      const edge = (l + r) / 2;
      if (grows(edge, fa ? -1 : 1)) addVA(edge);
      continue;
    }
    if (!fa) continue;
    if (Math.sign(a) !== Math.sign(b) || Math.abs(b - a) > 50 * scale) {
      // possibly a pole: bisect on the sign change, or towards the bigger value
      let l = xs[i], r = xs[i + 1];
      const signChange = Math.sign(a) !== Math.sign(b);
      for (let k = 0; k < 80; k++) {
        const m = (l + r) / 2, fm = f(m);
        if (!Number.isFinite(fm)) { l = r = m; break; }
        if (signChange) { if (Math.sign(fm) === Math.sign(a)) l = m; else r = m; }
        else if (Math.abs(f(l)) > Math.abs(f(r))) r = m; else l = m;
      }
      const m = (l + r) / 2;
      if (grows(m)) addVA(m);
    }
  }
  vas.sort((a, b) => a - b);
  const nearVA = (x) => vas.some((v) => Math.abs(v - x) < dx * 3);

  // --- roots ---
  const roots = [];
  const addRoot = (x) => {
    x = snap(x);
    if (!roots.some((r) => Math.abs(r - x) < 1e-6) && !nearVA(x)) roots.push(x);
  };
  for (let i = 0; i < n; i++) {
    const a = ys[i], b = ys[i + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a === 0) { addRoot(xs[i]); continue; }
    if (Math.sign(a) !== Math.sign(b) && b !== 0) {
      let l = xs[i], r = xs[i + 1];
      for (let k = 0; k < 80; k++) { const m = (l + r) / 2; (Math.sign(f(m)) === Math.sign(a)) ? (l = m) : (r = m); }
      const m = (l + r) / 2;
      if (Math.abs(f(m)) < 1e-6 * scale) addRoot(m);
    }
  }
  if (ys[n] === 0) addRoot(xs[n]);

  // --- turning points (f' changes sign) ---
  const tps = [];
  const ds = xs.map((x, i) => (Number.isFinite(ys[i]) ? deriv(f, x) : NaN));
  for (let i = 1; i < n; i++) {
    const a = ds[i], b = ds[i + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b) || nearVA(xs[i])) continue;
    if (a === 0 || Math.sign(a) === Math.sign(b)) continue;
    // reject sign changes at a jump or corner-free asymptote (|f'| huge)
    if (Math.abs(a) > 1e4 * scale || Math.abs(b) > 1e4 * scale) continue;
    let l = xs[i], r = xs[i + 1];
    for (let k = 0; k < 60; k++) { const m = (l + r) / 2; (Math.sign(deriv(f, m)) === Math.sign(a)) ? (l = m) : (r = m); }
    const x = snap((l + r) / 2);
    const y = f(x);
    if (!Number.isFinite(y)) continue;
    // a sharp corner such as |x| still counts as a turning point here (it's a max/min), which matches the curve's look
    tps.push({ x, y: snap(y), type: a > 0 ? 'max' : 'min' });
    // touching the x-axis counts as a root too
    if (Math.abs(y) < 1e-7 * scale) addRoot(x);
  }
  roots.sort((a, b) => a - b);

  // --- y-intercept ---
  const y0 = f(0);
  const yInt = Number.isFinite(y0) ? snap(y0) : null;

  // --- horizontal / oblique asymptotes as x → ±∞ ---
  const ends = [];
  for (const sgn of [1, -1]) {
    const X1 = sgn * 1e5, X2 = sgn * 1e6;
    const a1 = f(X1), a2 = f(X2);
    if (!Number.isFinite(a1) || !Number.isFinite(a2)) continue;
    // Fit y = mx + c through the two far points, then check other far points sit on it too.
    const m = (a2 - a1) / (X2 - X1);
    const c = a2 - m * X2;
    const fits = [1e4, 3e4, 3e5, 7e5].every((X) => {
      const y = f(sgn * X);
      return Number.isFinite(y) && Math.abs(y - (m * sgn * X + c)) < 2e-2 * Math.max(1, Math.abs(c));
    });
    if (!fits) continue;
    if (Math.abs(m) < 1e-4) ends.push({ side: sgn, m: 0, c: snap(Math.round(a2 * 1e3) / 1e3) });
    else if (Math.abs(m) < 1e4) ends.push({ side: sgn, m: snap(Math.round(m * 1e4) / 1e4), c: snap(Math.round(c * 1e3) / 1e3) });
  }
  // merge identical left/right asymptotes
  const asymptotes = [];
  for (const e of ends) {
    const same = asymptotes.find((a) => Math.abs(a.m - e.m) < 1e-6 && Math.abs(a.c - e.c) < 1e-6);
    if (same) same.sides.push(e.side); else asymptotes.push({ m: e.m, c: e.c, sides: [e.side] });
  }

  // --- symmetry ---
  let even = true, odd = true, checked = 0;
  for (let i = 0; i <= 200; i++) {
    const x = 0.137 + (i * (hi - 0.137)) / 200;
    const a = f(x), b = f(-x);
    if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
    if (!Number.isFinite(a) || !Number.isFinite(b)) { even = odd = false; break; }
    checked++;
    const tol = 1e-7 * Math.max(1, Math.abs(a));
    if (Math.abs(a - b) > tol) even = false;
    if (Math.abs(a + b) > tol) odd = false;
  }
  const symmetry = checked < 5 ? null : even ? 'even' : odd ? 'odd' : null;

  return { roots, yInt, tps, vas, asymptotes, symmetry };
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

// "y = 2x − 1", "y = 3", "y = −x"
export function lineEq(m, c) {
  if (Math.abs(m) < 1e-9) return `y = ${nice(c)}`;
  let ms = Math.abs(m - 1) < 1e-9 ? '' : Math.abs(m + 1) < 1e-9 ? MINUS : nice(m);
  if (ms.includes('/')) ms = ms.startsWith(MINUS) ? `${MINUS}(${ms.slice(1)})` : `(${ms})`;
  const cs = Math.abs(c) < 1e-9 ? '' : c > 0 ? ` + ${nice(c)}` : ` ${MINUS} ${nice(-c)}`;
  return `y = ${ms}x${cs}`;
}
