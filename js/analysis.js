// Compare two objects the way an H2 Math question would.
// Each handler returns { verdict, rows: [[label, html]], method: [steps], marks: [...] }
// "marks" are extra things to draw in the 3D view (feet of perpendiculars, intersections, ...).
import {
  add, sub, scale, dot, cross, len, isZeroVec, acuteAngle, simplifyDir,
} from './math.js';
import { fmtNum, fmtExact, fmtVec, fmtAngle } from './format.js';

const RANK = { point: 0, vector: 1, line: 2, plane: 3 };
const TOL = 1e-7;

export const lineEq = (a, d) => `<b>r</b> = ${fmtVec(a)} + λ${fmtVec(d)}`;
const arr = (s) => `<span class="arr">${s}</span>`;
const relTiny = (x, scaleBy) => Math.abs(x) < TOL * Math.max(1, scaleBy);

export function analyze(A, B) {
  if (A.id === B.id) return { message: 'Pick two different objects to compare.' };
  const [P, Q] = RANK[A.type] <= RANK[B.type] ? [A, B] : [B, A];
  const fn = HANDLERS[`${P.type}-${Q.type}`];
  if (!fn) return { message: `There's no standard comparison between a ${P.type} and a ${Q.type}.` };
  return fn(P, Q);
}

const HANDLERS = {
  'point-point'(A, B) {
    const ab = sub(B.p, A.p);
    const mid = scale(add(A.p, B.p), 0.5);
    return {
      verdict: `Distance ${A.name}${B.name} = ${fmtExact(len(ab))}`,
      rows: [
        [arr(A.name + B.name), fmtVec(ab)],
        [`|${arr(A.name + B.name)}|`, fmtExact(len(ab))],
        ['Midpoint', fmtVec(mid)],
      ],
      method: [`${arr(A.name + B.name)} = ${arr('O' + B.name)} − ${arr('O' + A.name)}`],
      marks: [{ kind: 'seg', p: A.p, q: B.p }, { kind: 'point', p: mid, label: 'mid' }],
    };
  },

  'point-vector'() {
    return { message: 'A point and a free vector can’t be compared directly. Try a point with a line or plane.' };
  },

  'point-line'(P, L) {
    const t = dot(sub(P.p, L.a), L.d) / dot(L.d, L.d);
    const F = add(L.a, scale(L.d, t));
    const dist = len(sub(P.p, F));
    if (dist < TOL) {
      return {
        verdict: `${P.name} lies on ${L.name} (at λ = ${fmtNum(t)}).`,
        rows: [['λ', fmtNum(t)]],
        method: [`Solve ${arr('O' + P.name)} = <b>a</b> + λ<b>d</b>.`],
        marks: [],
      };
    }
    const refl = sub(scale(F, 2), P.p);
    return {
      verdict: `Perpendicular distance from ${P.name} to ${L.name} = ${fmtExact(dist)}`,
      rows: [
        ['Foot of perpendicular F', `${fmtVec(F)} <span class="muted">(λ = ${fmtNum(t)})</span>`],
        ['Distance |' + arr(P.name + 'F') + '|', fmtExact(dist)],
        [`Reflection of ${P.name} in ${L.name}`, fmtVec(refl)],
      ],
      method: [
        `F lies on the line: ${arr('OF')} = <b>a</b> + λ<b>d</b>.`,
        `${arr(P.name + 'F')} is perpendicular to the line: ${arr(P.name + 'F')} · <b>d</b> = 0 gives λ = ${fmtNum(t)}.`,
        `Reflection: ${arr('OF')} is the midpoint, so ${arr("O" + P.name + "′")} = 2${arr('OF')} − ${arr('O' + P.name)}.`,
      ],
      marks: [
        { kind: 'seg', p: P.p, q: F },
        { kind: 'point', p: F, label: 'F' },
        { kind: 'point', p: refl, label: P.name + '′', faint: true },
        { kind: 'seg', p: F, q: refl, faint: true },
      ],
    };
  },

  'point-plane'(P, Pl) {
    const nn = dot(Pl.n, Pl.n);
    const t = (Pl.D - dot(Pl.n, P.p)) / nn;
    const F = add(P.p, scale(Pl.n, t));
    const dist = Math.abs(dot(Pl.n, P.p) - Pl.D) / Math.sqrt(nn);
    if (dist < TOL) {
      return { verdict: `${P.name} lies in ${Pl.name}.`, rows: [], method: [`${arr('O' + P.name)} · <b>n</b> = D.`], marks: [] };
    }
    const refl = sub(scale(F, 2), P.p);
    return {
      verdict: `Perpendicular distance from ${P.name} to ${Pl.name} = ${fmtExact(dist)}`,
      rows: [
        ['Foot of perpendicular F', fmtVec(F)],
        ['Distance', fmtExact(dist)],
        [`Reflection of ${P.name} in ${Pl.name}`, fmtVec(refl)],
      ],
      method: [
        `The line through ${P.name} along the normal: <b>r</b> = ${arr('O' + P.name)} + λ<b>n</b>.`,
        `Substitute into <b>r</b> · <b>n</b> = D to get λ = ${fmtNum(t)}, which gives F.`,
        `Distance = |${arr('O' + P.name)} · <b>n</b> − D| / |<b>n</b>|.`,
      ],
      marks: [
        { kind: 'seg', p: P.p, q: F },
        { kind: 'point', p: F, label: 'F' },
        { kind: 'point', p: refl, label: P.name + '′', faint: true },
        { kind: 'seg', p: F, q: refl, faint: true },
      ],
    };
  },

  'vector-vector'(U, V) {
    const d = dot(U.v, V.v);
    const c = cross(U.v, V.v);
    const lu = len(U.v), lv = len(V.v);
    if (lu < TOL || lv < TOL) return { message: 'One of the vectors is the zero vector.' };
    const ang = Math.acos(Math.max(-1, Math.min(1, d / (lu * lv))));
    let verdict = `Angle between ${U.name} and ${V.name} = ${fmtAngle(ang)}`;
    if (relTiny(d, lu * lv)) verdict = `${U.name} and ${V.name} are perpendicular (${U.name} · ${V.name} = 0).`;
    else if (isZeroVec(c)) verdict = `${U.name} and ${V.name} are parallel (${U.name} × ${V.name} = 0).`;
    const proj = scale(V.v, d / (lv * lv));
    return {
      verdict,
      rows: [
        [`${U.name} · ${V.name}`, fmtNum(d)],
        [`${U.name} × ${V.name}`, fmtVec(c)],
        ['Angle between them', fmtAngle(ang)],
        [`Area of parallelogram |${U.name} × ${V.name}|`, fmtExact(len(c))],
        [`Length of projection of ${U.name} onto ${V.name}`, fmtExact(Math.abs(d) / lv)],
        [`Projection vector of ${U.name} onto ${V.name}`, fmtVec(proj)],
      ],
      method: [
        `cos θ = (${U.name} · ${V.name}) / (|${U.name}||${V.name}|)`,
        `Projection length = |${U.name} · ${V.name}̂|, where ${V.name}̂ is the unit vector of ${V.name}.`,
      ],
      marks: [
        { kind: 'arrow', from: [0, 0, 0], to: c, label: `${U.name}×${V.name}` },
        { kind: 'parallelogram', u: U.v, v: V.v },
        { kind: 'seg', p: U.v, q: proj, faint: true },
        { kind: 'arrow', from: [0, 0, 0], to: proj, label: 'proj', faint: true },
      ],
    };
  },

  'vector-line'(V, L) {
    if (isZeroVec(V.v)) return { message: `${V.name} is the zero vector.` };
    const ang = acuteAngle(V.v, L.d);
    let verdict = `Acute angle between ${V.name} and ${L.name} = ${fmtAngle(ang)}`;
    if (isZeroVec(cross(V.v, L.d))) verdict = `${V.name} is parallel to ${L.name}.`;
    else if (relTiny(dot(V.v, L.d), len(V.v) * len(L.d))) verdict = `${V.name} is perpendicular to ${L.name}.`;
    return {
      verdict,
      rows: [['Angle', fmtAngle(ang)], [`${V.name} · <b>d</b>`, fmtNum(dot(V.v, L.d))]],
      method: ['cos θ = |<b>v</b> · <b>d</b>| / (|<b>v</b>||<b>d</b>|)'],
      marks: [],
    };
  },

  'vector-plane'(V, Pl) {
    if (isZeroVec(V.v)) return { message: `${V.name} is the zero vector.` };
    const s = Math.abs(dot(V.v, Pl.n)) / (len(V.v) * len(Pl.n));
    const ang = Math.asin(Math.min(1, s));
    let verdict = `Angle between ${V.name} and ${Pl.name} = ${fmtAngle(ang)}`;
    if (s < TOL) verdict = `${V.name} is parallel to ${Pl.name} (${V.name} · <b>n</b> = 0).`;
    else if (isZeroVec(cross(V.v, Pl.n))) verdict = `${V.name} is perpendicular to ${Pl.name} (parallel to its normal).`;
    return {
      verdict,
      rows: [['Angle with plane', fmtAngle(ang)], [`${V.name} · <b>n</b>`, fmtNum(dot(V.v, Pl.n))]],
      method: ['sin θ = |<b>v</b> · <b>n</b>| / (|<b>v</b>||<b>n</b>|) (use sin, not cos, because <b>n</b> is perpendicular to the plane)'],
      marks: [],
    };
  },

  'line-line'(L1, L2) {
    const { a: a1, d: d1 } = L1, { a: a2, d: d2 } = L2;
    const n = cross(d1, d2);
    const w = sub(a2, a1);
    if (isZeroVec(n)) {
      const dist = len(cross(w, d1)) / len(d1);
      if (dist < TOL) {
        return { verdict: `${L1.name} and ${L2.name} are the same line.`, rows: [], method: ['Directions are parallel and they share a point.'], marks: [] };
      }
      const t = dot(w, d1) / dot(d1, d1);
      const F = add(a1, scale(d1, t));
      return {
        verdict: `${L1.name} and ${L2.name} are parallel. Distance between them = ${fmtExact(dist)}`,
        rows: [['Distance between lines', fmtExact(dist)]],
        method: [
          `<b>d₁</b> × <b>d₂</b> = <b>0</b>, so the directions are parallel.`,
          'Distance = |(<b>a₂</b> − <b>a₁</b>) × <b>d₁</b>| / |<b>d₁</b>|',
        ],
        marks: [{ kind: 'seg', p: a2, q: F }, { kind: 'point', p: F, label: 'F' }],
      };
    }
    const nn = dot(n, n);
    const lam = dot(cross(w, d2), n) / nn;
    const mu = dot(cross(w, d1), n) / nn;
    const P1 = add(a1, scale(d1, lam));
    const P2 = add(a2, scale(d2, mu));
    const gap = len(sub(P1, P2));
    const ang = acuteAngle(d1, d2);
    if (gap < TOL * Math.max(1, len(P1))) {
      return {
        verdict: `${L1.name} and ${L2.name} intersect at ${'(' + P1.map(fmtNum).join(', ') + ')'}.`,
        rows: [
          ['Point of intersection', fmtVec(P1)],
          ['Parameters', `λ = ${fmtNum(lam)}, μ = ${fmtNum(mu)}`],
          ['Acute angle between lines', fmtAngle(ang)],
        ],
        method: [
          'Write the lines as <b>a₁</b> + λ<b>d₁</b> and <b>a₂</b> + μ<b>d₂</b>, then set them equal.',
          'Solve two of the three component equations for λ and μ, then check the third one is also satisfied.',
          'Angle: cos θ = |<b>d₁</b> · <b>d₂</b>| / (|<b>d₁</b>||<b>d₂</b>|)',
        ],
        marks: [{ kind: 'point', p: P1, label: 'X' }],
      };
    }
    return {
      verdict: `${L1.name} and ${L2.name} are skew (not parallel and they don't meet).`,
      rows: [
        ['Shortest distance', fmtExact(gap)],
        [`Closest point on ${L1.name}`, `${fmtVec(P1)} <span class="muted">(λ = ${fmtNum(lam)})</span>`],
        [`Closest point on ${L2.name}`, `${fmtVec(P2)} <span class="muted">(μ = ${fmtNum(mu)})</span>`],
        ['Acute angle between lines', fmtAngle(ang)],
      ],
      method: [
        'Not parallel: <b>d₁</b> × <b>d₂</b> ≠ <b>0</b>. When you set the equations equal, they have no common solution.',
        'Shortest distance = |(<b>a₂</b> − <b>a₁</b>) · (<b>d₁</b> × <b>d₂</b>)| / |<b>d₁</b> × <b>d₂</b>|',
        'The shortest segment is perpendicular to both lines.',
      ],
      marks: [
        { kind: 'seg', p: P1, q: P2 },
        { kind: 'point', p: P1, label: 'P' },
        { kind: 'point', p: P2, label: 'Q' },
      ],
    };
  },

  'line-plane'(L, Pl) {
    const dn = dot(L.d, Pl.n);
    const an = dot(L.a, Pl.n);
    const ln = len(Pl.n);
    if (relTiny(dn, len(L.d) * ln)) {
      const dist = Math.abs(an - Pl.D) / ln;
      if (dist < TOL) {
        return { verdict: `${L.name} lies in ${Pl.name}.`, rows: [], method: ['<b>d</b> · <b>n</b> = 0 and <b>a</b> · <b>n</b> = D.'], marks: [] };
      }
      const F = add(L.a, scale(Pl.n, (Pl.D - an) / (ln * ln)));
      return {
        verdict: `${L.name} is parallel to ${Pl.name}. Distance between them = ${fmtExact(dist)}`,
        rows: [['Distance from line to plane', fmtExact(dist)]],
        method: ['<b>d</b> · <b>n</b> = 0, so the line is parallel to the plane.', 'Distance = |<b>a</b> · <b>n</b> − D| / |<b>n</b>|'],
        marks: [{ kind: 'seg', p: L.a, q: F }, { kind: 'point', p: F, label: 'F' }],
      };
    }
    const lam = (Pl.D - an) / dn;
    const X = add(L.a, scale(L.d, lam));
    const ang = Math.asin(Math.min(1, Math.abs(dn) / (len(L.d) * ln)));
    return {
      verdict: `${L.name} meets ${Pl.name} at (${X.map(fmtNum).join(', ')}).`,
      rows: [
        ['Point of intersection', `${fmtVec(X)} <span class="muted">(λ = ${fmtNum(lam)})</span>`],
        ['Acute angle between line and plane', fmtAngle(ang)],
      ],
      method: [
        'Substitute <b>r</b> = <b>a</b> + λ<b>d</b> into <b>r</b> · <b>n</b> = D and solve for λ.',
        'Angle: sin θ = |<b>d</b> · <b>n</b>| / (|<b>d</b>||<b>n</b>|)',
      ],
      marks: [{ kind: 'point', p: X, label: 'X' }],
    };
  },

  'plane-plane'(P1, P2) {
    const { n: n1, D: D1 } = P1, { n: n2, D: D2 } = P2;
    const dir = cross(n1, n2);
    if (isZeroVec(dir)) {
      const q = scale(n2, D2 / dot(n2, n2));
      const dist = Math.abs(dot(n1, q) - D1) / len(n1);
      if (dist < TOL) return { verdict: `${P1.name} and ${P2.name} are the same plane.`, rows: [], method: [], marks: [] };
      return {
        verdict: `${P1.name} and ${P2.name} are parallel. Distance between them = ${fmtExact(dist)}`,
        rows: [['Distance between planes', fmtExact(dist)]],
        method: ['The normals are parallel.', 'Take any point on one plane and find its distance to the other.'],
        marks: [],
      };
    }
    // A point on both planes: set the coordinate with the biggest direction component to 0.
    let k = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(dir[i]) > Math.abs(dir[k])) k = i;
    const [i, j] = [0, 1, 2].filter((x) => x !== k);
    const det = n1[i] * n2[j] - n1[j] * n2[i];
    const p = [0, 0, 0];
    p[i] = (D1 * n2[j] - D2 * n1[j]) / det;
    p[j] = (n1[i] * D2 - n2[i] * D1) / det;
    const d = simplifyDir(dir);
    const ang = acuteAngle(n1, n2);
    const vn = 'xyz';
    return {
      verdict: `${P1.name} and ${P2.name} meet in a line.`,
      rows: [
        ['Line of intersection', lineEq(p, d)],
        ['Acute angle between planes', fmtAngle(ang)],
      ],
      method: [
        'The line\'s direction is perpendicular to both normals, so use <b>n₁</b> × <b>n₂</b>.',
        `To find a point on it, set ${vn[k]} = 0 and solve the two plane equations together (or use the GC).`,
        'Angle: cos θ = |<b>n₁</b> · <b>n₂</b>| / (|<b>n₁</b>||<b>n₂</b>|)',
      ],
      marks: [{ kind: 'line', a: p, d }, { kind: 'point', p, label: '' }],
    };
  },
};
