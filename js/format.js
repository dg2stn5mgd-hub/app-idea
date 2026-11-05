// Turning numbers and vectors into readable, exam-style text/HTML.
import { toFraction, gcd } from './math.js';

const MINUS = '−';

const sigFig3 = (v) => {
  const s = String(Number(v.toPrecision(3)));
  return s.replace('-', MINUS);
};

// Fraction if exact, otherwise 3 s.f.  e.g. 7/3, −2, 0.333
export function fmtNum(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < 1e-10) return '0';
  const fr = toFraction(v);
  if (fr) {
    const [p, q] = fr;
    const sign = p < 0 ? MINUS : '';
    return q === 1 ? `${sign}${Math.abs(p)}` : `${sign}${Math.abs(p)}/${q}`;
  }
  return sigFig3(v);
}

// Exact surd form k√m/q if v² is rational, e.g. √14, 2√3/5. Null otherwise.
function toSurd(v) {
  const fr = toFraction(v * v);
  if (!fr) return null;
  const [p, q] = fr;
  const N = p * q;
  if (N <= 0 || N > 1e7) return null;
  let k = 1, m = N;
  for (let i = Math.floor(Math.sqrt(N)); i >= 2; i--) {
    if (N % (i * i) === 0) { k = i; m = N / (i * i); break; }
  }
  if (m === 1) return null; // actually rational
  const g = gcd(k, q);
  k /= g;
  const den = q / g;
  const sign = v < 0 ? MINUS : '';
  return `${sign}${k === 1 ? '' : k}√${m}${den === 1 ? '' : '/' + den}`;
}

// Best exact answer, with a decimal when it isn't a plain fraction.
// e.g. "3", "7/3", "√14 ≈ 3.74", "2.18"
export function fmtExact(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < 1e-10) return '0';
  if (toFraction(v)) {
    const f = fmtNum(v);
    return f.includes('/') ? `${f} ≈ ${sigFig3(v)}` : f;
  }
  const s = toSurd(v);
  return s ? `${s} ≈ ${sigFig3(v)}` : sigFig3(v);
}

// Column vector as HTML.
export function fmtVec(v) {
  return `<span class="cv">${v.map((x) => `<span>${fmtNum(x)}</span>`).join('')}</span>`;
}

// Row form for labels: "1, 2, 3"
export const fmtRow = (v) => v.map(fmtNum).join(', ');

// Angles: H2 convention is 1 d.p. in degrees.
export function fmtAngle(rad) {
  const deg = (rad * 180) / Math.PI;
  const r = Math.round(deg * 10) / 10;
  return Number.isInteger(r) ? `${r}°` : `${r.toFixed(1)}°`;
}

// Linear expression like "x − 2y + 3z" from coefficients.
function linear(coefs, vars) {
  let out = '';
  coefs.forEach((c, i) => {
    if (Math.abs(c) < 1e-10) return;
    const mag = fmtNum(Math.abs(c));
    const term = (mag === '1' ? '' : mag) + vars[i];
    if (out === '') out = (c < 0 ? MINUS : '') + term;
    else out += (c < 0 ? ` ${MINUS} ` : ' + ') + term;
  });
  return out || '0';
}

export const fmtPlaneCartesian = (n, D) => `${linear(n, ['x', 'y', 'z'])} = ${fmtNum(D)}`;

// Cartesian form of a line, e.g. (x − 1)/2 = (y − 2)/(−1) = z − 3
export function fmtLineCartesian(a, d) {
  const vars = ['x', 'y', 'z'];
  const ratios = [];
  const fixed = [];
  for (let i = 0; i < 3; i++) {
    const ai = a[i], di = d[i];
    if (Math.abs(di) < 1e-10) { fixed.push(`${vars[i]} = ${fmtNum(ai)}`); continue; }
    const num = Math.abs(ai) < 1e-10 ? vars[i]
      : `${vars[i]} ${ai > 0 ? MINUS : '+'} ${fmtNum(Math.abs(ai))}`;
    if (Math.abs(di - 1) < 1e-10) ratios.push(num);
    else {
      const den = fmtNum(di);
      const denStr = den.includes('/') || den.startsWith(MINUS) ? `(${den})` : den;
      const numStr = num === vars[i] ? num : `(${num})`;
      ratios.push(`${numStr}/${denStr}`);
    }
  }
  return [ratios.length > 1 ? ratios.join(' = ') : null, ...fixed].filter(Boolean).join(', ');
}
