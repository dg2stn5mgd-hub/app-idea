// The Graphs and Transformations page: wires up each interactive section.
import { Plot } from './plot2d.js';
import { parseFunction } from './expr.js';
import { findFeatures, nice, sf3, frac, pt, lineEq } from './features.js';
import { gcd } from './math.js';

const C = {
  blue: '#2563eb', red: '#dc2626', green: '#059669', amber: '#d97706', violet: '#7c3aed',
  pink: '#db2777', teal: '#0891b2', grey: '#94a3b8', ink: '#0f172a', asym: '#64748b',
};
const MINUS = '−';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function legend(plot, entries) {
  let box = plot.el.querySelector('.plot-legend');
  if (!box) { box = document.createElement('div'); box.className = 'plot-legend'; plot.el.appendChild(box); }
  box.innerHTML = entries.map(([color, text, dash]) => `<span style="--c:${color}"><i class="${dash ? 'dash' : ''}"></i>${text}</span>`).join('');
}

// Slider rows. spec: [{ key, label, min, max, value, step, color }]. Calls onChange(values).
function sliders(container, spec, onChange) {
  const vals = {};
  for (const s of spec) {
    vals[s.key] = s.value;
    const row = document.createElement('label');
    row.className = 'slider';
    if (s.color) row.style.setProperty('--c', s.color);
    row.innerHTML = `<span>${s.label}</span><input type="range" min="${s.min}" max="${s.max}" step="${s.step || 1}" value="${s.value}" aria-label="${s.label}"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    const show = () => { out.textContent = frac(vals[s.key]); };
    input.addEventListener('input', () => { vals[s.key] = Number(input.value); show(); onChange({ ...vals }); });
    show();
    container.appendChild(row);
  }
  return vals;
}

const li = (k, v) => `<li><span class="k">${k}</span><span class="v">${v}</span></li>`;

// Polynomial-ish text: terms [[coef, 'x²'], [coef, 'x'], [coef, '']] → "2x² − x + 3"
function poly(terms) {
  let out = '';
  for (const [c, v] of terms) {
    if (Math.abs(c) < 1e-12) continue;
    const mag = Math.abs(c);
    let m = mag === 1 && v ? '' : frac(mag);
    if (m.includes('/') && v) m = `(${m})`;
    const body = m + v;
    out += out === '' ? (c < 0 ? MINUS : '') + body : (c < 0 ? ` ${MINUS} ` : ' + ') + body;
  }
  return out || '0';
}
const fracHTML = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;

/* ============================================================
   1. Graph explorer
   ============================================================ */
function initExplorer() {
  const plot = new Plot($('ex-plot'), { xmin: -8, xmax: 8, ymin: -10, ymax: 14 });
  const input = $('ex-input'), err = $('ex-err'), read = $('ex-read');
  const presets = [
    '(x^2 + x + 4)/(x - 1)', '(2x - 1)/(x + 3)', 'x^3 - 3x', 'x/(x^2 - 1)',
    'x e^(-x)', 'ln(x + 2)', 'e^(-x^2)', '|x^2 - 4|', '(x^2 - 1)/(x^2 + 1)',
  ];
  const box = $('ex-presets');
  for (const p of presets) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = p;
    b.addEventListener('click', () => { input.value = p; run(); });
    box.appendChild(b);
  }
  let f = null, feats = null;
  function run() {
    try {
      f = parseFunction(input.value);
      err.textContent = ''; input.classList.remove('bad');
    } catch (e) {
      err.textContent = e.message; input.classList.add('bad');
      return;
    }
    feats = findFeatures(f, -20, 20, 8000);
    draw();
  }
  function draw() {
    plot.clear();
    const showPts = $('ex-points').checked, showAs = $('ex-asym').checked;
    if (showAs) {
      for (const v of feats.vas) plot.vline(v, { label: `x = ${nice(v)}`, color: C.asym });
      for (const a of feats.asymptotes) plot.sline(a.m, a.c, { label: lineEq(a.m, a.c), color: C.asym });
    }
    plot.fn(f, { color: C.blue, width: 2.8 });
    if (showPts) {
      for (const r of feats.roots) plot.point(r, 0, { color: C.red, label: pt(r, 0), tip: `x-intercept ${pt(r, 0)}` });
      if (feats.yInt !== null && !feats.roots.some((r) => Math.abs(r) < 1e-9)) plot.point(0, feats.yInt, { color: C.green, label: pt(0, feats.yInt), tip: `y-intercept ${pt(0, feats.yInt)}` });
      for (const t of feats.tps) plot.point(t.x, t.y, { color: C.amber, label: pt(t.x, t.y), tip: `${t.type === 'max' ? 'Maximum' : 'Minimum'} ${pt(t.x, t.y)}` });
    }
    plot.draw();

    const list = (a) => (a.length ? a.join(', ') : '<span class="muted">none</span>');
    const ends = feats.asymptotes.map((a) => {
      const side = a.sides.length === 2 ? '' : a.sides[0] > 0 ? ' <span class="muted">(as x → ∞)</span>' : ' <span class="muted">(as x → −∞)</span>';
      return lineEq(a.m, a.c) + side;
    });
    read.innerHTML =
      li('x-intercepts', list(feats.roots.map((r) => pt(r, 0)))) +
      li('y-intercept', feats.yInt === null ? '<span class="muted">none (x = 0 not allowed)</span>' : pt(0, feats.yInt)) +
      li('Turning points', list(feats.tps.map((t) => `${t.type === 'max' ? 'max' : 'min'} ${pt(t.x, t.y)}`))) +
      li('Vertical asymptotes', list(feats.vas.map((v) => `x = ${nice(v)}`))) +
      li('Other asymptotes', list(ends)) +
      li('Symmetry', feats.symmetry === 'even' ? 'about the y-axis (even)' : feats.symmetry === 'odd' ? 'rotational, about O (odd)' : '<span class="muted">none about the axes or O</span>');
  }
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  $('ex-points').addEventListener('change', draw);
  $('ex-asym').addEventListener('change', draw);
  run();
}

/* ============================================================
   2. Transformations
   ============================================================ */
// Starting curves. pts: key points to follow. vas / has: vertical / horizontal asymptotes.
// show(inner): the formula with x replaced by the inner expression.
const wrap = (s) => (s === 'x' ? 'x' : `(${s})`);
const BASES = [
  { id: 'cubic', name: 'f(x) = x³ − 3x  (a typical exam curve)', f: (x) => x ** 3 - 3 * x, pts: [[-1, 2, 'max'], [1, -2, 'min'], [0, 0]], vas: [], has: [], view: [-6, 6, -8, 8] },
  { id: 'sq', name: 'f(x) = x²', f: (x) => x * x, show: (u) => `${wrap(u)}²`, pts: [[0, 0, 'min'], [1, 1], [-1, 1]], vas: [], has: [], view: [-6, 6, -6, 8] },
  { id: 'recip', name: 'f(x) = 1/x', f: (x) => 1 / x, show: (u) => `1/${wrap(u)}`, pts: [[1, 1], [-1, -1]], vas: [0], has: [0], view: [-6, 6, -6, 6] },
  { id: 'exp', name: 'f(x) = eˣ', f: Math.exp, show: (u) => `e^${wrap(u)}`, pts: [[0, 1], [1, Math.E]], vas: [], has: [0], view: [-6, 6, -6, 8] },
  { id: 'ln', name: 'f(x) = ln x', f: (x) => (x > 0 ? Math.log(x) : NaN), show: (u) => `ln${wrap(u)}`, pts: [[1, 0], [Math.E, 1]], vas: [0], has: [], view: [-6, 8, -6, 6] },
  { id: 'sqrt', name: 'f(x) = √x', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), show: (u) => `√${wrap(u)}`, pts: [[0, 0], [1, 1], [4, 2]], vas: [], has: [], view: [-6, 8, -5, 6] },
  { id: 'abs', name: 'f(x) = |x|', f: Math.abs, show: (u) => `|${u}|`, pts: [[0, 0, 'min'], [2, 2]], vas: [], has: [], view: [-6, 6, -5, 7] },
  { id: 'sin', name: 'f(x) = sin x', f: Math.sin, show: (u) => `sin${wrap(u)}`, pts: [[Math.PI / 2, 1, 'max'], [0, 0]], vas: [], has: [], view: [-7, 7, -4, 4] },
];

// y = p·f(m x + n) + q, starting from p = m = 1, n = q = 0.
function compose(steps) {
  let p = 1, m = 1, n = 0, q = 0;
  const states = [];
  for (const s of steps) {
    if (s.type === 'xtrans') n += m * s.a; // x → x + a
    else if (s.type === 'xscale') m *= s.a; // x → ax
    else if (s.type === 'yscale') { p *= s.a; q *= s.a; } // y → a y
    else if (s.type === 'ytrans') q += s.a;
    states.push({ p, m, n, q });
  }
  return { p, m, n, q, states };
}
function innerText(m, n) { return poly([[m, 'x'], [n, '']]); }
function eqText({ p, m, n, q }, base) {
  const inner = innerText(m, n);
  let coef = Math.abs(p - 1) < 1e-12 ? '' : Math.abs(p + 1) < 1e-12 ? MINUS : frac(p);
  if (coef.includes('/')) coef = `(${coef})`;
  let core;
  if (!base || !base.show) core = `${coef}f(${inner})`;
  else if (base.id === 'recip') core = `${coef === '' ? '1' : coef === MINUS ? MINUS + '1' : coef}/${wrap(inner)}`;
  else core = coef + base.show(inner);
  const tail = Math.abs(q) < 1e-12 ? '' : q > 0 ? ` + ${frac(q)}` : ` ${MINUS} ${frac(-q)}`;
  return `y = ${core}${tail}`;
}
function describe(s) {
  const a = s.a, A = frac(Math.abs(a));
  const units = (k) => `${frac(k)} unit${Math.abs(k) === 1 ? '' : 's'}`;
  switch (s.type) {
    case 'ytrans': return `Translation of ${units(Math.abs(a))} in the ${a > 0 ? 'positive' : 'negative'} y-direction`;
    case 'xtrans': return `Translation of ${units(Math.abs(a))} in the ${a > 0 ? 'negative' : 'positive'} x-direction`;
    case 'yscale':
      if (a === -1) return 'Reflection in the x-axis';
      if (a < 0) return `Reflection in the x-axis, then scaling parallel to the y-axis by a factor of ${A}`;
      return `Scaling parallel to the y-axis by a factor of ${A}`;
    case 'xscale':
      if (a === -1) return 'Reflection in the y-axis';
      if (a < 0) return `Reflection in the y-axis, then scaling parallel to the x-axis by a factor of ${frac(1 / Math.abs(a))}`;
      return `Scaling parallel to the x-axis by a factor of ${frac(1 / a)}`;
  }
}
const STEP_COLORS = [C.red, C.green, C.violet, C.amber, C.pink, C.teal];

let loadIntoBuilder = null;

function initTransformations() {
  const plot = new Plot($('tf-plot'), { xmin: -6, xmax: 6, ymin: -8, ymax: 8 });
  const baseSel = $('tf-base');
  for (const b of BASES) baseSel.add(new Option(b.name, b.id));
  let base = BASES[0];
  let steps = [{ type: 'xtrans', a: -1 }, { type: 'yscale', a: 2 }];
  let lastHome = '';
  let anim = null; // { i, t }: step i is t (0..1) of the way done
  let raf = 0;
  const ID = { p: 1, m: 1, n: 0, q: 0 };

  // Step i only partly applied, so the curve can slide / stretch smoothly.
  function partial(s, t) {
    if (s.type === 'xtrans' || s.type === 'ytrans') return { ...s, a: s.a * t };
    if (s.type === 'yscale') return { ...s, a: 1 + (s.a - 1) * t };
    // x-scaling: move the factor 1/a smoothly (a reflection squashes through the y-axis and flips)
    let k = 1 + (1 / s.a - 1) * t;
    if (Math.abs(k) < 0.03) k = 0.03 * (Math.sign(1 / s.a) || 1);
    return { ...s, a: 1 / k };
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function play(from = 0, to = steps.length - 1) {
    cancelAnimationFrame(raf);
    if (!steps.length) return;
    const dur = 1300, gap = 450;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = from, t0 = null;
    $('tf-play').textContent = '■ Stop';
    const frame = (now) => {
      if (t0 === null) t0 = now;
      const el = now - t0;
      const t = reduce ? 1 : Math.min(1, el / dur);
      anim = { i, t: ease(t) };
      render();
      if (el >= (reduce ? 700 : dur + gap)) {
        if (i >= to) { stop(); return; }
        i++; t0 = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; anim = null;
    $('tf-play').textContent = '▶ Animate';
    render();
  }

  function render() {
    const { states } = compose(steps);
    const fin = states.length ? states[states.length - 1] : ID;
    const g = (st) => (x) => st.p * base.f(st.m * x + st.n) + st.q;
    // What the moving curve shows right now.
    const cur = anim ? compose([...steps.slice(0, anim.i), partial(steps[anim.i], anim.t)]).states.at(-1) : fin;

    const seq = $('tf-seq');
    if (anim) {
      [...seq.children].forEach((li, j) => { li.classList.toggle('active', j === anim.i); li.classList.toggle('dim', j > anim.i); });
    } else {
    seq.innerHTML = steps.length ? '' : '<li style="--c:#cbd5e1" class="seq-empty">No steps yet. Add one below.</li>';
    steps.forEach((s, i) => {
      const item = document.createElement('li');
      item.style.setProperty('--c', STEP_COLORS[i % STEP_COLORS.length]);
      const rule = { xtrans: `replace x by x ${s.a < 0 ? MINUS : '+'} ${frac(Math.abs(s.a))}`, xscale: `replace x by ${poly([[s.a, 'x']])}`, yscale: `multiply y by ${frac(s.a)}`, ytrans: s.a > 0 ? `add ${frac(s.a)} to y` : `subtract ${frac(-s.a)} from y` }[s.type];
      item.innerHTML = `<div class="what"><span>${describe(s)}</span><span class="then">${rule} → ${esc(eqText(states[i], base))}</span></div><button type="button" aria-label="Remove step">×</button>`;
      item.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); stop(); steps.splice(i, 1); render(); });
      item.title = 'Click to animate this step';
      item.addEventListener('click', () => play(i, i));
      seq.appendChild(item);
    });
    if (!steps.length) seq.firstChild.style.gridTemplateColumns = '1fr';
    }

    // plot: original, faint intermediates, final
    plot.clear();
    const startEq = base.show ? `y = ${base.show('x')}` : 'y = f(x)';
    const finEq = eqText(fin, base);
    const lab = (v) => (anim ? '' : v);
    for (const v of base.vas) plot.vline((v - cur.n) / cur.m, { color: C.blue, label: lab(`x = ${nice((v - fin.n) / fin.m)}`) });
    for (const h of base.has) plot.sline(0, cur.p * h + cur.q, { color: C.blue, label: lab(`y = ${nice(fin.p * h + fin.q)}`) });
    plot.fn(base.f, { color: C.grey, width: 2.2, dash: [5, 5] });
    if (anim) {
      // faint ghost of where this step ends up
      plot.fn(g(states[anim.i]), { color: STEP_COLORS[anim.i % STEP_COLORS.length], width: 2, alpha: 0.35, dash: [4, 4] });
    } else states.slice(0, -1).forEach((st, i) => plot.fn(g(st), { color: STEP_COLORS[i % STEP_COLORS.length], width: 1.6, alpha: 0.45 }));
    if (states.length) plot.fn(g(cur), { color: C.blue, width: 3 });

    const trackLines = [];
    for (const [x0, y0, kind] of base.pts) {
      const x1 = (x0 - fin.n) / fin.m, y1 = fin.p * y0 + fin.q;
      plot.point(x0, y0, { color: C.grey, tip: `Original ${pt(x0, y0)}` });
      if (anim) {
        plot.point((x0 - cur.n) / cur.m, cur.p * y0 + cur.q, { color: C.blue });
      } else if (states.length) {
        plot.arrow(x0, y0, x1, y1, { color: '#94a3b8', dash: [3, 4], width: 1.3 });
        // a negative y-scaling swaps maxima and minima
        let k2 = kind;
        if (kind && fin.p < 0) k2 = kind === 'max' ? 'min' : 'max';
        plot.point(x1, y1, { color: C.blue, label: pt(x1, y1), tip: `${k2 ? (k2 === 'max' ? 'Maximum ' : 'Minimum ') : ''}${pt(x1, y1)}` });
        trackLines.push(`<div>${pt(x0, y0)} → <b>${pt(x1, y1)}</b>${k2 ? ` <span class="muted">(${k2})</span>` : ''}</div>`);
      }
      if (anim && states.length) trackLines.push(`<div>${pt(x0, y0)} → <b>${pt(x1, y1)}</b></div>`);
    }
    for (const v of base.vas) trackLines.push(`<div>Asymptote x = ${nice(v)} → <b>x = ${nice((v - fin.n) / fin.m)}</b></div>`);
    for (const h of base.has) trackLines.push(`<div>Asymptote y = ${nice(h)} → <b>y = ${nice(fin.p * h + fin.q)}</b></div>`);
    // Zoom out far enough to show where the key points and asymptotes end up.
    const [vx0, vx1, vy0, vy1] = base.view;
    const fx = [vx0, vx1], fy = [vy0, vy1];
    for (const [x0, y0] of base.pts) { fx.push((x0 - fin.n) / fin.m); fy.push(fin.p * y0 + fin.q); }
    for (const v of base.vas) fx.push((v - fin.n) / fin.m);
    for (const h of base.has) fy.push(fin.p * h + fin.q);
    const home = { xmin: Math.min(...fx.map((x) => x - 1.5)), xmax: Math.max(...fx.map((x) => x + 1.5)), ymin: Math.min(...fy.map((y) => y - 1.5)), ymax: Math.max(...fy.map((y) => y + 1.5)) };
    home.xmin = Math.min(home.xmin, vx0); home.xmax = Math.max(home.xmax, vx1);
    home.ymin = Math.min(home.ymin, vy0); home.ymax = Math.max(home.ymax, vy1);
    const key = JSON.stringify(home);
    if (key !== lastHome) { lastHome = key; plot.setHome(home); } else plot.draw();
    legend(plot, [[C.grey, esc(startEq), true], ...(states.length ? [[C.blue, esc(finEq)]] : [])]);

    $('tf-eq').textContent = anim ? eqText(states[anim.i], base) : finEq;
    $('tf-now').textContent = anim ? `Step ${anim.i + 1}: ${describe(steps[anim.i])}` : '';
    $('tf-now').style.setProperty('--c', anim ? STEP_COLORS[anim.i % STEP_COLORS.length] : 'transparent');
    $('tf-track').innerHTML = states.length ? `<div class="demo-title">Where things go</div>${trackLines.join('')}` : '';
  }

  baseSel.addEventListener('change', () => {
    stop();
    base = BASES.find((b) => b.id === baseSel.value);
    render();
  });
  $('tf-add').addEventListener('click', () => {
    let a;
    try { a = parseFunction($('tf-val').value)(0); } catch { a = NaN; }
    const type = $('tf-type').value;
    if (!Number.isFinite(a)) { $('tf-err').textContent = 'Type a number for a, e.g. 2, −3 or 1/2.'; return; }
    if (a === 0 && (type === 'xscale' || type === 'yscale')) { $('tf-err').textContent = 'A scale factor of 0 would squash the graph flat. Pick another value.'; return; }
    if (a === 0) { $('tf-err').textContent = 'Translating by 0 does nothing. Pick another value.'; return; }
    $('tf-err').textContent = '';
    stop();
    steps.push({ type, a });
    render();
    play(steps.length - 1, steps.length - 1);
  });
  $('tf-val').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('tf-add').click(); });
  $('tf-clear').addEventListener('click', () => { stop(); steps = []; render(); });
  $('tf-undo').addEventListener('click', () => { stop(); steps.pop(); render(); });
  $('tf-play').addEventListener('click', () => (raf ? stop() : play()));

  loadIntoBuilder = (newSteps) => {
    steps = newSteps.map((s) => ({ ...s }));
    base = BASES[0];
    baseSel.value = base.id;
    stop();
    render();
    setTimeout(() => play(), 600);
    $('tf-plot').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  render();
}

// Practice: y = f(x) → y = p f(mx + n) + q
function initPractice() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let cur = null;
  function make() {
    let p, m, n, q, nontrivial;
    do {
      m = pick([1, 1, 2, 3, 0.5, -1, -2]);
      n = pick([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
      p = pick([1, 1, 2, 3, 0.5, -1, -2]);
      q = pick([-3, -2, -1, 0, 1, 2, 3, 4]);
      nontrivial = [m !== 1, n !== 0, p !== 1, q !== 0].filter(Boolean).length;
    } while (nontrivial < 2);
    // Steps: translate x by n first, then scale x by m (so inner = mx + n), then y.
    const steps = [];
    if (n !== 0) steps.push({ type: 'xtrans', a: n });
    if (m !== 1) steps.push({ type: 'xscale', a: m });
    if (p !== 1) steps.push({ type: 'yscale', a: p });
    if (q !== 0) steps.push({ type: 'ytrans', a: q });
    cur = { p, m, n, q, steps };
    $('pr-q').innerHTML = `Describe a sequence of transformations that maps the graph of <span class="eq">y = f(x)</span> onto the graph of <span class="eq"><b>${esc(eqText({ p, m, n, q }))}</b></span>.`;
    const alt = [];
    if (m !== 1 && n !== 0) {
      alt.push(`<p class="muted">Another correct order: do the ${m < 0 ? 'reflection' : 'scaling'} in x first, then translate by <b>${frac(Math.abs(n / m))}</b> unit${Math.abs(n / m) === 1 ? '' : 's'} in the ${n / m > 0 ? 'negative' : 'positive'} x-direction, since ${esc(innerText(m, n))} = ${m === -1 ? MINUS : frac(m).includes('/') ? `(${esc(frac(m))})` : esc(frac(m))}(x ${n / m < 0 ? MINUS : '+'} ${frac(Math.abs(n / m))}).</p>`);
    }
    $('pr-ans').innerHTML = `<ol>${steps.map((s) => `<li>${describe(s)}</li>`).join('')}</ol>${alt.join('')}`;
    $('pr-ans').classList.remove('show');
    $('pr-show').textContent = 'Show answer';
  }
  $('pr-new').addEventListener('click', make);
  $('pr-show').addEventListener('click', () => {
    const on = $('pr-ans').classList.toggle('show');
    $('pr-show').textContent = on ? 'Hide answer' : 'Show answer';
  });
  $('pr-load').addEventListener('click', () => { if (cur && loadIntoBuilder) loadIntoBuilder(cur.steps); });
  make();
}

/* ============================================================
   3. y = (ax + b)/(cx + d)
   ============================================================ */
function initRational1() {
  const plot = new Plot($('r1-plot'), { xmin: -8, xmax: 8, ymin: -8, ymax: 8 });
  const spec = [
    { key: 'a', label: 'a', min: -5, max: 5, value: 2, color: C.blue },
    { key: 'b', label: 'b', min: -5, max: 5, value: -1, color: C.blue },
    { key: 'c', label: 'c', min: -5, max: 5, value: 1, color: C.red },
    { key: 'd', label: 'd', min: -5, max: 5, value: 3, color: C.red },
  ];
  const draw = ({ a, b, c, d }) => {
    const f = (x) => (a * x + b) / (c * x + d);
    const num = poly([[a, 'x'], [b, '']]), den = poly([[c, 'x'], [d, '']]);
    const rows = [li('Equation', `<span class="eq">y = ${fracHTML(num, den)}</span>`)];
    plot.clear();
    if (c === 0 && d === 0) {
      plot.draw(); legend(plot, []);
      $('r1-read').innerHTML = rows.join('') + li('Note', 'The denominator is 0 for every x, so there is no curve. Change c or d.');
      return;
    }
    const k = b * c - a * d;
    if (c === 0) {
      plot.fn(f, { color: C.blue, width: 2.8 });
      plot.draw(); legend(plot, [[C.blue, 'y = ' + esc(poly([[a / d, 'x'], [b / d, '']]))]]);
      rows.push(li('Note', `With c = 0 this is the straight line y = ${poly([[a / d, 'x'], [b / d, '']])}, not a hyperbola.`));
      $('r1-read').innerHTML = rows.join('');
      return;
    }
    const va = -d / c, ha = a / c;
    if (k === 0) {
      plot.sline(0, ha, { color: C.blue, width: 2.8, dash: false });
      plot.hole(va, ha, { color: C.blue });
      plot.draw(); legend(plot, [[C.blue, `y = ${frac(ha)}, x ≠ ${frac(va)}`]]);
      rows.push(li('Note', `bc − ad = 0, so the top and bottom cancel. This is the horizontal line y = ${frac(ha)} with a hole at x = ${frac(va)}.`));
      $('r1-read').innerHTML = rows.join('');
      return;
    }
    plot.vline(va, { label: `x = ${frac(va)}` });
    plot.sline(0, ha, { label: `y = ${frac(ha)}` });
    plot.fn(f, { color: C.blue, width: 2.8 });
    plot.point(va, ha, { color: C.asym, r: 3, tip: `Centre of symmetry (${frac(va)}, ${frac(ha)})` });
    if (a !== 0) plot.point(-b / a, 0, { color: C.red, label: `(${frac(-b / a)}, 0)` });
    if (d !== 0) plot.point(0, b / d, { color: C.green, label: `(0, ${frac(b / d)})` });
    plot.draw();
    legend(plot, [[C.blue, 'y = (' + esc(num) + ')/(' + esc(den) + ')']]);

    // rewrite as a/c + K/(x + d/c) with K = (bc − ad)/c²
    const K = k / (c * c), s = d / c;
    const shifted = poly([[1, 'x'], [s, '']]);
    const steps = [];
    if (s !== 0) steps.push(`translation of ${frac(Math.abs(s))} unit${Math.abs(s) === 1 ? '' : 's'} in the ${s > 0 ? 'negative' : 'positive'} x-direction`);
    if (K < 0) steps.push('reflection in the x-axis');
    if (Math.abs(K) !== 1) steps.push(`scaling parallel to the y-axis by a factor of ${frac(Math.abs(K))}`);
    if (ha !== 0) steps.push(`translation of ${frac(Math.abs(ha))} unit${Math.abs(ha) === 1 ? '' : 's'} in the ${ha > 0 ? 'positive' : 'negative'} y-direction`);
    rows.push(
      li('Divided out', `<span class="eq">y = ${ha !== 0 ? frac(ha) + (K < 0 ? ` ${MINUS} ` : ' + ') : K < 0 ? MINUS : ''}${fracHTML(frac(Math.abs(K)), shifted)}</span>`),
      li('Asymptotes', `x = ${frac(va)} and y = ${frac(ha)}`),
      li('Intercepts', [a !== 0 ? `(${frac(-b / a)}, 0)` : null, d !== 0 ? `(0, ${frac(b / d)})` : null].filter(Boolean).join(', ') || '<span class="muted">none</span>'),
      li('Restrictions', `x ≠ ${frac(va)}, y ≠ ${frac(ha)}`),
      li('Gradient', `dy/dx = ${frac(-k)}/(${den})² is always ${-k > 0 ? 'positive' : 'negative'}, so there are no turning points`),
      li('From y = 1/x', steps.length ? steps.map((t, i) => `${i + 1}. ${t[0].toUpperCase() + t.slice(1)}`).join('<br>') : 'It is y = 1/x'),
    );
    $('r1-read').innerHTML = rows.join('');
  };
  draw(sliders($('r1-sliders'), spec, draw));
}

/* ============================================================
   4. y = (ax² + bx + c)/(dx + e)
   ============================================================ */
// Exact form of (P + Q√s)/R with integers, e.g. "3 − 2√6", "(1 + √5)/2".
function surd(P, Q, s, R) {
  if (s < 0) return null;
  if (s === 0) return frac(P / R);
  let k = 1, t = s;
  for (let i = Math.floor(Math.sqrt(t)); i >= 2; i--) if (t % (i * i) === 0) { k = i; t /= i * i; break; }
  Q *= k;
  if (t === 1 || Q === 0) return frac((P + Q * (t === 1 ? 1 : 0)) / R);
  if (R < 0) { P = -P; Q = -Q; R = -R; }
  const g = gcd(gcd(Math.abs(P), Math.abs(Q)), R) || 1;
  P /= g; Q /= g; R /= g;
  const qs = `${Math.abs(Q) === 1 ? '' : Math.abs(Q)}√${t}`;
  const body = P === 0 ? `${Q < 0 ? MINUS : ''}${qs}` : `${P < 0 ? MINUS : ''}${Math.abs(P)} ${Q < 0 ? MINUS : '+'} ${qs}`;
  return R === 1 ? body : P === 0 ? `${body}/${R}` : `(${body})/${R}`;
}

function initRational2() {
  const plot = new Plot($('r2-plot'), { xmin: -10, xmax: 10, ymin: -14, ymax: 18 });
  const spec = [
    { key: 'a', label: 'a', min: -4, max: 4, value: 1, color: C.blue },
    { key: 'b', label: 'b', min: -6, max: 6, value: 1, color: C.blue },
    { key: 'c', label: 'c', min: -8, max: 8, value: 4, color: C.blue },
    { key: 'd', label: 'd', min: -3, max: 3, value: 1, color: C.red },
    { key: 'e', label: 'e', min: -5, max: 5, value: -1, color: C.red },
  ];
  const draw = ({ a, b, c, d, e }) => {
    const f = (x) => (a * x * x + b * x + c) / (d * x + e);
    const num = poly([[a, 'x²'], [b, 'x'], [c, '']]), den = poly([[d, 'x'], [e, '']]);
    const rows = [li('Equation', `<span class="eq">y = ${fracHTML(num, den)}</span>`)];
    plot.clear();
    const stop = (msg) => { plot.fn(f, { color: C.blue, width: 2.8 }); plot.draw(); legend(plot, []); $('r2-read').innerHTML = rows.join('') + li('Note', msg); };
    if (d === 0) return stop(e === 0 ? 'The denominator is 0 for every x. Change d or e.' : 'With d = 0 this is just a quadratic (a parabola). Move d away from 0.');
    if (a === 0) return stop('With a = 0 this is the linear-over-linear case from the section above. Move a away from 0.');

    const p = a / d, q = (b * d - a * e) / (d * d), r = c - q * e;
    const va = -e / d;
    if (Math.abs(r) < 1e-12) {
      plot.sline(p, q, { color: C.blue, width: 2.8, dash: false });
      plot.hole(va, p * va + q, { color: C.blue });
      plot.draw(); legend(plot, []);
      rows.push(li('Note', `dx + e is a factor of the top, so it cancels. This is the line ${lineEq(p, q)} with a hole at x = ${frac(va)}.`));
      $('r2-read').innerHTML = rows.join('');
      return;
    }
    plot.vline(va, { label: `x = ${frac(va)}` });
    plot.sline(p, q, { label: lineEq(p, q) });
    plot.fn(f, { color: C.blue, width: 2.8 });

    // turning points: (dx + e)² = r d² / a
    const tps = [];
    if (r / a > 0) {
      const w = Math.abs(d) * Math.sqrt(r / a);
      for (const sgn of [-1, 1]) {
        const x = (-e + sgn * w) / d;
        const y = f(x);
        // second derivative of r/(dx+e) is 2rd²/(dx+e)³
        const type = (2 * r * d * d) / Math.pow(d * x + e, 3) > 0 ? 'min' : 'max';
        tps.push({ x, y, type });
      }
    }
    for (const t of tps) plot.point(t.x, t.y, { color: C.amber, label: `${t.type} (${nice(t.x)}, ${nice(t.y)})` });
    // axis intercepts
    const disc = b * b - 4 * a * c;
    const roots = disc < 0 ? [] : disc === 0 ? [-b / (2 * a)] : [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].sort((u, v) => u - v);
    for (const x of roots) plot.point(x, 0, { color: C.red, label: `(${surd(-b, (x + b / (2 * a)) * a > 0 ? 1 : -1, disc, 2 * a) ?? nice(x)}, 0)` });
    if (e !== 0) plot.point(0, c / e, { color: C.green, label: `(0, ${frac(c / e)})` });
    plot.draw();
    legend(plot, [[C.blue, 'y = (' + esc(num) + ')/(' + esc(den) + ')']]);

    // range by discriminant: a x² + (b − d y) x + (c − e y) = 0  ⇒  d² y² + (4ae − 2bd) y + (b² − 4ac) ≥ 0
    const A = d * d, B = 4 * a * e - 2 * b * d, Cc = b * b - 4 * a * c;
    const D = B * B - 4 * A * Cc;
    const quadX = `${poly([[a, 'x²']])} + (${poly([[b, ''], [-d, 'y']])})x + (${poly([[c, ''], [-e, 'y']])}) = 0`;
    const quadY = `${poly([[A, 'y²'], [B, 'y'], [Cc, '']])} ≥ 0`;
    let range;
    if (D > 0) {
      const y1 = surd(-B, -1, D, 2 * A), y2 = surd(-B, 1, D, 2 * A);
      const v1 = (-B - Math.sqrt(D)) / (2 * A), v2 = (-B + Math.sqrt(D)) / (2 * A);
      const approx = (s, v) => (s.includes('√') ? `${s} ≈ ${sf3(v)}` : s);
      range = `y ≤ ${approx(y1, v1)} or y ≥ ${approx(y2, v2)}`;
    } else range = 'all real values of y';

    rows.push(
      li('Long division', `<span class="eq">y = ${poly([[p, 'x'], [q, '']])} ${r < 0 ? MINUS : '+'} ${fracHTML(frac(Math.abs(r)), den)}</span>`),
      li('Asymptotes', `x = ${frac(va)} and ${lineEq(p, q)}`),
      li('Turning points', tps.length ? tps.map((t) => `${t.type} (${nice(t.x)}, ${nice(t.y)})`).join('<br>') : `<span class="muted">none: r = ${frac(r)} and a = ${frac(a)} have opposite signs</span>`),
      li('x-intercepts', roots.length ? roots.map((x) => `(${nice(x)}, 0)`).join(', ') : `<span class="muted">none, since b² − 4ac = ${disc} &lt; 0</span>`),
      li('y-intercept', e !== 0 ? `(0, ${frac(c / e)})` : '<span class="muted">none (x = 0 is the asymptote)</span>'),
      li('Range method', `y(${den}) = ${num}<br>⇒ ${quadX}<br>Real x ⇒ discriminant ≥ 0:<br>${quadY}`),
      li('Range', range),
    );
    $('r2-read').innerHTML = rows.join('');
  };
  draw(sliders($('r2-sliders'), spec, draw));
}

/* ============================================================
   5. Conics
   ============================================================ */
function initConics() {
  const plot = new Plot($('cn-plot'), { xmin: -9, xmax: 9, ymin: -8, ymax: 8, equal: true });
  const typeSel = $('cn-type');
  const spec = [
    { key: 'a', label: 'a', min: 1, max: 6, value: 3, color: C.blue },
    { key: 'b', label: 'b', min: 1, max: 6, value: 2, color: C.red },
    { key: 'h', label: 'h', min: -4, max: 4, value: 0, color: C.green },
    { key: 'k', label: 'k', min: -4, max: 4, value: 0, color: C.green },
  ];
  let vals;
  const sq = (v) => (v === 0 ? 'x' : `(x ${v > 0 ? MINUS : '+'} ${Math.abs(v)})`);
  const sqy = (v) => (v === 0 ? 'y' : `(y ${v > 0 ? MINUS : '+'} ${Math.abs(v)})`);
  const draw = () => {
    const { a, b, h, k } = vals, T = typeSel.value;
    plot.clear();
    const X = `${sq(h)}²/${a * a}`, Y = `${sqy(k)}²/${b * b}`;
    const eq = T === 'E' ? `${X} + ${Y} = 1` : T === 'H' ? `${X} − ${Y} = 1` : `${Y} − ${X} = 1`;
    const rows = [li('Equation', `<span class="eq">${eq}</span>`), li('Centre', `(${frac(h)}, ${frac(k)})`), li('Lines of symmetry', `x = ${frac(h)} and y = ${frac(k)}`)];
    plot.vline(h, { color: '#cbd5e1', width: 1 });
    plot.sline(0, k, { color: '#cbd5e1', width: 1 });
    const pts = [];
    if (T === 'E') {
      plot.param((t) => h + a * Math.cos(t), (t) => k + b * Math.sin(t), 0, 2 * Math.PI, { color: C.blue, width: 2.8 });
      pts.push([h + a, k], [h - a, k], [h, k + b], [h, k - b]);
      rows.push(
        li('Ends of axes', pts.map(([x, y]) => `(${frac(x)}, ${frac(y)})`).join(', ')),
        li('Asymptotes', '<span class="muted">none (it is a closed curve)</span>'),
        li('Restrictions', `${frac(h - a)} ≤ x ≤ ${frac(h + a)}, ${frac(k - b)} ≤ y ≤ ${frac(k + b)}`),
        li('Shape', a === b ? 'a circle of radius ' + a : a > b ? 'wider than it is tall' : 'taller than it is wide'),
      );
    } else {
      const H = T === 'H';
      // branches with cosh/sinh
      const L = 4;
      if (H) {
        plot.param((t) => h + a * Math.cosh(t), (t) => k + b * Math.sinh(t), -L, L, { color: C.blue, width: 2.8 });
        plot.param((t) => h - a * Math.cosh(t), (t) => k + b * Math.sinh(t), -L, L, { color: C.blue, width: 2.8 });
        pts.push([h + a, k], [h - a, k]);
      } else {
        plot.param((t) => h + a * Math.sinh(t), (t) => k + b * Math.cosh(t), -L, L, { color: C.blue, width: 2.8 });
        plot.param((t) => h + a * Math.sinh(t), (t) => k - b * Math.cosh(t), -L, L, { color: C.blue, width: 2.8 });
        pts.push([h, k + b], [h, k - b]);
      }
      const m = b / a;
      plot.sline(m, k - m * h, { label: lineEq(m, k - m * h) });
      plot.sline(-m, k + m * h, { label: lineEq(-m, k + m * h) });
      let mm = frac(m);
      if (mm.includes('/')) mm = `(${mm})`;
      const form = (s) => (h === 0 && k === 0 ? `y = ${s}${mm === '1' ? '' : mm}x` : `${sqy(k)} = ${s}${mm === '1' ? '' : mm}${sq(h)}`);
      rows.push(
        li('Vertices', pts.map(([x, y]) => `(${frac(x)}, ${frac(y)})`).join(', ')),
        li('Asymptotes', `${form('')} and ${form(MINUS)}<br><span class="muted">i.e. ${lineEq(m, k - m * h)} and ${lineEq(-m, k + m * h)}</span>`),
        li('Restrictions', H ? `x ≤ ${frac(h - a)} or x ≥ ${frac(h + a)}` : `y ≤ ${frac(k - b)} or y ≥ ${frac(k + b)}`),
      );
    }
    for (const [x, y] of pts) plot.point(x, y, { color: C.ink, label: `(${frac(x)}, ${frac(y)})` });
    plot.point(h, k, { color: C.asym, r: 3, tip: `Centre (${frac(h)}, ${frac(k)})` });

    // intercepts with the axes
    const ints = [];
    const both = (c0, half) => (half < -1e-12 ? [] : Math.abs(half) < 1e-12 ? [c0] : [c0 - Math.sqrt(half), c0 + Math.sqrt(half)]);
    const sgnE = T === 'E' ? 1 : -1;
    // y = 0: (x−h)²/a² = 1 − sgn·k²/b² (E: 1 − k²/b², H: 1 + k²/b², V: k²/b² − 1)
    const xr = T === 'V' ? both(h, a * a * (k * k / (b * b) - 1)) : both(h, a * a * (1 - (sgnE * k * k) / (b * b)));
    const yr = T === 'H' ? both(k, b * b * (h * h / (a * a) - 1)) : both(k, b * b * (1 - (sgnE * h * h) / (a * a)));
    for (const x of xr) { ints.push(`(${nice(x)}, 0)`); plot.point(x, 0, { color: C.red, r: 3.5, tip: `x-intercept (${nice(x)}, 0)` }); }
    for (const y of yr) { ints.push(`(0, ${nice(y)})`); plot.point(0, y, { color: C.green, r: 3.5, tip: `y-intercept (0, ${nice(y)})` }); }
    rows.push(li('Axis intercepts', ints.length ? [...new Set(ints)].join(', ') : '<span class="muted">none</span>'));
    plot.draw();
    $('cn-read').innerHTML = rows.join('');
  };
  vals = sliders($('cn-sliders'), spec, (v) => { vals = v; draw(); });
  typeSel.addEventListener('change', draw);
  draw();
}

/* ============================================================
   6. Related graphs
   ============================================================ */
function initRelated() {
  const plot = new Plot($('rl-plot'), { xmin: -6, xmax: 6, ymin: -6, ymax: 6 });
  const bases = [
    { name: 'f(x) = (x − 1)(x + 2)', s: '(x-1)(x+2)' },
    { name: 'f(x) = x³ − 3x', s: 'x^3 - 3x' },
    { name: 'f(x) = (x + 1)/(x − 2)', s: '(x+1)/(x-2)' },
    { name: 'f(x) = ln x', s: 'ln x' },
    { name: 'f(x) = eˣ − 2', s: 'e^x - 2' },
    { name: 'f(x) = x − 2', s: 'x - 2' },
  ];
  const sel = $('rl-base');
  bases.forEach((b, i) => sel.add(new Option(b.name, i)));
  const modes = {
    abs: { label: 'y = |f(x)|', g: (f) => (x) => Math.abs(f(x)), text: 'Keep the parts of the curve on or above the x-axis. <b>Reflect the parts below the x-axis</b> in the x-axis. The result is never negative, and points on the x-axis stay put.' },
    fabs: { label: 'y = f(|x|)', g: (f) => (x) => f(Math.abs(x)), text: '<b>Delete the part with x &lt; 0</b>, keep the part with x ≥ 0, then reflect that part in the y-axis. The result is always symmetric about the y-axis.' },
    recip: { label: 'y = 1/f(x)', g: (f) => (x) => 1 / f(x), text: '<ul><li>x-intercepts of f become <b>vertical asymptotes</b>.</li><li>Vertical asymptotes of f become x-intercepts, as hollow points if f is undefined there.</li><li>A max of f becomes a min, and a min becomes a max, at the same x. The y-value becomes 1/y.</li><li>Where f → ±∞, 1/f → 0. Where f → k ≠ 0, 1/f → 1/k.</li><li>1/f has the same sign as f, and the points where f = ±1 stay where they are.</li></ul>' },
    deriv: { label: "y = f′(x)", g: (f) => (x) => (f(x + 1e-5) - f(x - 1e-5)) / 2e-5, text: '<ul><li>Turning points of f become <b>x-intercepts</b> of f′.</li><li>Where f is increasing, f′ is above the x-axis. Where f is decreasing, f′ is below it.</li><li>Points of inflexion of f become turning points of f′.</li><li>A vertical asymptote of f stays a vertical asymptote of f′. An oblique asymptote y = mx + c becomes the horizontal asymptote y = m.</li></ul>' },
  };
  let mode = 'abs';
  const box = $('rl-modes');
  const btns = {};
  for (const [k, m] of Object.entries(modes)) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = m.label;
    b.addEventListener('click', () => { mode = k; draw(); });
    box.appendChild(b); btns[k] = b;
  }
  function draw() {
    const base = bases[sel.value];
    const f = parseFunction(base.s);
    const g = modes[mode].g(f);
    for (const [k, b] of Object.entries(btns)) { b.style.borderColor = k === mode ? 'var(--accent)' : ''; b.style.color = k === mode ? 'var(--accent)' : ''; b.style.fontWeight = k === mode ? '600' : ''; }
    plot.clear();
    const fe = findFeatures(g, -20, 20, 6000);
    for (const v of fe.vas) plot.vline(v, { label: `x = ${nice(v)}`, color: C.red });
    for (const a of fe.asymptotes) plot.sline(a.m, a.c, { label: lineEq(a.m, a.c), color: C.red });
    plot.fn(f, { color: C.grey, width: 2.2, dash: [5, 5] });
    plot.fn(g, { color: C.red, width: 2.8 });
    // hollow points for 1/f where f had an asymptote
    if (mode === 'recip') for (const v of findFeatures(f, -20, 20, 6000).vas) plot.hole(v, 0, { color: C.red, tip: `(${nice(v)}, 0) is not on the curve` });
    plot.draw();
    const name = base.name.replace('f(x) = ', '');
    legend(plot, [[C.grey, 'y = ' + esc(name), true], [C.red, modes[mode].label]]);
    $('rl-read').innerHTML = `<div>${modes[mode].text}</div>`;
  }
  sel.addEventListener('change', draw);
  draw();
}

initExplorer();
initTransformations();
initPractice();
initRational1();
initRational2();
initConics();
initRelated();
