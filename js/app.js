import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import {
  parseVector, parseScalar, add, sub, scale, dot, cross, len, isZeroVec, simplifyDir,
} from './math.js';
import { fmtNum, fmtExact, fmtVec, fmtRow, fmtPlaneCartesian, fmtLineCartesian } from './format.js';
import { analyze, lineEq } from './analysis.js';

// Maths uses z-up; three.js uses y-up. This maps maths (x, y, z) to three.js coordinates
// (it's a rotation, so right-handedness is preserved).
const M = (v) => new THREE.Vector3(v[0], v[2], -v[1]);

// =====================================================================
// 3D scene
// =====================================================================
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.prepend(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewport.insertBefore(labelRenderer.domElement, renderer.domElement.nextSibling);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f8fafc');
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function resetView() {
  // Narrow views (phones, small windows) need the camera further back to fit the axes.
  const zoomOut = camera.aspect < 1.4 ? 1.3 : 1;
  camera.position.copy(M([22, 13, 13])).multiplyScalar(zoomOut);
  controls.target.set(0, 0, 0);
  controls.update();
}
resetView();
document.getElementById('resetView').onclick = resetView;

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(10, 20, 15);
scene.add(sun);

const UP = new THREE.Vector3(0, 1, 0);

function rod(p, q, r, mat) {
  const P = M(p), Q = M(q);
  const dir = Q.clone().sub(P);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), mat);
  m.position.copy(P).add(Q).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

function arrowMesh(from, to, mat, r = 0.05, headR = 0.16, headL = 0.5) {
  const g = new THREE.Group();
  const v = sub(to, from);
  const L = len(v);
  if (L < 1e-9) return g;
  const hl = Math.min(headL, L * 0.4);
  const shaftEnd = add(from, scale(v, (L - hl) / L));
  g.add(rod(from, shaftEnd, r, mat));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(headR, hl, 16), mat);
  const S = M(shaftEnd), T = M(to);
  cone.position.copy(S).add(T).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(UP, T.clone().sub(S).normalize());
  g.add(cone);
  return g;
}

function sphere(p, r, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  m.position.copy(M(p));
  return m;
}

function label(text, p, cls = '', color) {
  const outer = document.createElement('div');
  const inner = document.createElement('span');
  inner.className = 'lbl ' + cls;
  inner.textContent = text;
  if (color) inner.style.color = color;
  outer.appendChild(inner);
  const o = new CSS2DObject(outer);
  o.position.copy(M(p));
  return o;
}

const solid = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

// ---- axes + grid (built once) ----
const AXIS = 10;
(function buildAxes() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#64748b' });
  ['x', 'y', 'z'].forEach((name, i) => {
    const e = [0, 0, 0]; e[i] = 1;
    g.add(arrowMesh(scale(e, -AXIS), scale(e, AXIS), mat, 0.02, 0.1, 0.35));
    g.add(label(name, scale(e, AXIS + 0.8), 'axis'));
    for (let t = -AXIS + 2; t < AXIS; t += 2) if (t !== 0) g.add(label(String(t), scale(e, t), 'tick'));
  });
  g.add(label('O', [0, 0, 0], 'tick off'));
  const grid = new THREE.GridHelper(2 * AXIS, 2 * AXIS, 0xcbd5e1, 0xe2e8f0);
  grid.material.transparent = true;
  grid.material.opacity = 0.8;
  g.add(grid);
  scene.add(g);
})();

const objectLayer = new THREE.Group();
const markLayer = new THREE.Group();
scene.add(objectLayer, markLayer);

function clearGroup(g) {
  const labels = [];
  g.traverse((o) => {
    if (o.isCSS2DObject) labels.push(o);
    o.geometry?.dispose();
    o.material?.dispose?.();
  });
  labels.forEach((l) => l.parent.remove(l)); // removes the label's DOM element too
  g.clear();
}

const EXTENT = 14; // how far lines/planes are drawn

function drawObject(o, r) {
  const g = new THREE.Group();
  const c = o.color;
  const mat = solid(c);
  if (o.type === 'point') {
    g.add(sphere(r.p, 0.15, mat));
    g.add(label(`${o.name}(${fmtRow(r.p)})`, r.p, 'off', c));
  } else if (o.type === 'vector') {
    g.add(arrowMesh([0, 0, 0], r.v, mat, 0.055));
    g.add(label(o.name, r.v, 'off bold', c));
  } else if (o.type === 'line') {
    const { a, d } = r;
    const dh = scale(d, 1 / len(d));
    const c0 = sub(a, scale(d, dot(a, d) / dot(d, d))); // point on line nearest O
    g.add(rod(add(c0, scale(dh, -EXTENT)), add(c0, scale(dh, EXTENT)), 0.035, mat));
    g.add(label(o.name, add(c0, scale(dh, EXTENT * 0.75)), 'off', c));
    // the given point a and direction d
    g.add(sphere(a, 0.1, mat));
    g.add(arrowMesh(a, add(a, d), mat, 0.06, 0.17, 0.45));
    // moving point for λ
    if (o.lambda !== 0) {
      const P = add(a, scale(d, o.lambda));
      g.add(sphere(P, 0.16, solid('#0f172a')));
      g.add(label(`λ = ${fmtNum(o.lambda)}`, P, 'off small', '#0f172a'));
    }
  } else if (o.type === 'plane') {
    const { n, D } = r;
    const nh = scale(n, 1 / len(n));
    const c0 = scale(n, D / dot(n, n)); // point on plane nearest O
    const sub3 = new THREE.Group();
    const geo = new THREE.PlaneGeometry(EXTENT * 0.85, EXTENT * 0.85);
    sub3.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
    })));
    sub3.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: c })));
    sub3.position.copy(M(c0));
    sub3.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), M(nh).normalize());
    g.add(sub3);
    g.add(arrowMesh(c0, add(c0, scale(nh, 2.5)), mat, 0.045, 0.14, 0.4));
    g.add(label('n', add(c0, scale(nh, 2.6)), 'off bold small', c));
    // name near a corner
    const u = M(nh).clone();
    const t1 = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
    const tag = label(o.name, [0, 0, 0], 'off', c);
    tag.position.copy(M(c0)).addScaledVector(t1, EXTENT * 0.36);
    g.add(tag);
  }
  return g;
}

const HIGHLIGHT = '#d97706';

function drawMarks(marks) {
  for (const m of marks) {
    const color = m.faint ? '#a8a29e' : HIGHLIGHT;
    const mat = solid(color);
    if (m.kind === 'point') {
      markLayer.add(sphere(m.p, 0.16, mat));
      if (m.label) markLayer.add(label(m.label, m.p, 'off', m.faint ? '#78716c' : '#b45309'));
    } else if (m.kind === 'seg') {
      if (len(sub(m.p, m.q)) > 1e-6) markLayer.add(rod(m.p, m.q, 0.03, mat));
    } else if (m.kind === 'arrow') {
      markLayer.add(arrowMesh(m.from, m.to, mat, 0.05));
      if (m.label) markLayer.add(label(m.label, m.to, 'off', m.faint ? '#78716c' : '#b45309'));
    } else if (m.kind === 'line') {
      const dh = scale(m.d, 1 / len(m.d));
      markLayer.add(rod(add(m.a, scale(dh, -EXTENT)), add(m.a, scale(dh, EXTENT)), 0.05, mat));
    } else if (m.kind === 'parallelogram') {
      const pts = [[0, 0, 0], m.u, add(m.u, m.v), m.v].map(M);
      const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
      markLayer.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: HIGHLIGHT, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false,
      })));
    }
  }
}

function resize() {
  const { clientWidth: w, clientHeight: h } = viewport;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();
resetView();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

// =====================================================================
// Objects + UI
// =====================================================================
const PALETTE = ['#2563eb', '#dc2626', '#059669', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#65a30d'];

const TYPES = {
  point: {
    label: 'Point',
    names: 'ABCDEGHJKMNPQRST'.split(''),
    examples: [{ p: '(4, 3, 5)' }, { p: '(-2, 5, 1)' }, { p: '(3, -4, 2)' }],
  },
  vector: {
    label: 'Vector',
    names: 'abcpqsuvw'.split(''),
    examples: [{ v: '(2, -1, 2)' }, { v: '(1, 3, 0)' }, { v: 'i + j + k' }],
  },
  line: {
    label: 'Line',
    names: ['l₁', 'l₂', 'l₃', 'l₄', 'l₅', 'l₆', 'l₇', 'l₈'],
    examples: [
      { a: '(1, 2, 3)', d: '(2, -1, 1)' },
      { a: '(0, 5, -2)', d: '(1, 1, 2)' },
      { a: '(3, 0, 0)', d: '(0, 1, -1)' },
    ],
  },
  plane: {
    label: 'Plane',
    names: ['Π₁', 'Π₂', 'Π₃', 'Π₄', 'Π₅', 'Π₆'],
    examples: [
      { n: '(1, 1, 1)', D: '8' },
      { n: '(1, -2, 2)', D: '3' },
      { n: '(0, 0, 1)', D: '2' },
    ],
  },
};

const FIELDS = {
  point: [['p', 'Position vector']],
  vector: [['v', 'Components']],
  line: [['a', 'Point on line, a'], ['d', 'Direction, d']],
  'plane-normal': [['n', 'Normal, n'], ['D', 'Constant, D']],
  'plane-param': [['a', 'Point, a'], ['b', 'Direction, b'], ['c', 'Direction, c']],
};

const state = { objects: [], nextId: 1, selA: null, selB: null };

function makeObject(type) {
  const T = TYPES[type];
  const sameType = state.objects.filter((o) => o.type === type);
  const used = new Set(sameType.map((o) => o.name));
  const name = T.names.find((n) => !used.has(n)) ?? `${T.label} ${state.nextId}`;
  const ex = T.examples[sameType.length % T.examples.length];
  const o = {
    id: state.nextId++,
    type,
    name,
    color: PALETTE[(state.nextId - 2) % PALETTE.length],
    visible: true,
    lambda: 0,
    form: 'normal',
    fields: { a: '(8, 0, 0)', b: '(1, -1, 0)', c: '(1, 0, -1)', ...ex },
  };
  o.geom = resolve(o);
  return o;
}

function resolve(o) {
  const f = o.fields;
  const vec = (k) => {
    try { return parseVector(f[k]); } catch (e) { throw Object.assign(e, { field: k }); }
  };
  try {
    switch (o.type) {
      case 'point': return { p: vec('p') };
      case 'vector': return { v: vec('v') };
      case 'line': {
        const a = vec('a'), d = vec('d');
        if (isZeroVec(d)) throw Object.assign(new Error('The direction can’t be the zero vector.'), { field: 'd' });
        return { a, d };
      }
      case 'plane': {
        if (o.form === 'normal') {
          const n = vec('n');
          if (isZeroVec(n)) throw Object.assign(new Error('The normal can’t be the zero vector.'), { field: 'n' });
          let D;
          try { D = parseScalar(f.D); } catch (e) { throw Object.assign(e, { field: 'D' }); }
          return { n, D };
        }
        const a = vec('a'), b = vec('b'), c = vec('c');
        const n = simplifyDir(cross(b, c));
        if (isZeroVec(n)) throw Object.assign(new Error('b and c are parallel, so they don’t span a plane.'), { field: 'c' });
        return { n, D: dot(a, n), a, b, c };
      }
    }
  } catch (e) {
    return { error: e.message, field: e.field };
  }
}

// ---------- cards ----------
const $ = (s, root = document) => root.querySelector(s);
const objectsBox = $('#objects');

function el(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function renderCards() {
  objectsBox.innerHTML = '';
  if (!state.objects.length) {
    objectsBox.innerHTML = '<p class="empty">Add a point, vector, line or plane to get started.</p>';
  }
  for (const o of state.objects) objectsBox.appendChild(buildCard(o));
}

function buildCard(o) {
  const card = el('div', { class: 'card' + (o.visible ? '' : ' hidden-obj') });
  card.style.setProperty('--c', o.color);

  const head = el('div', { class: 'card-head' });
  const color = el('input', { type: 'color', value: o.color, title: 'Colour', 'aria-label': 'Colour' });
  color.oninput = () => { o.color = color.value; card.style.setProperty('--c', o.color); refresh(); };
  const name = el('input', { class: 'name', value: o.name, 'aria-label': 'Name', spellcheck: 'false' });
  name.oninput = () => { o.name = name.value.trim() || '?'; updateInfo(o); refresh(); };
  head.append(color, name, el('span', { class: 'type' }, TYPES[o.type].label));
  const eye = el('button', { class: 'icon', title: 'Show / hide' }, o.visible ? eyeIcon : eyeOffIcon);
  eye.onclick = () => {
    o.visible = !o.visible;
    eye.innerHTML = o.visible ? eyeIcon : eyeOffIcon;
    card.classList.toggle('hidden-obj', !o.visible);
    refresh();
  };
  const del = el('button', { class: 'icon', title: 'Delete' }, trashIcon);
  del.onclick = () => {
    state.objects = state.objects.filter((x) => x !== o);
    renderCards();
    refresh();
  };
  head.append(eye, del);
  card.appendChild(head);

  if (o.type === 'plane') {
    const seg = el('div', { class: 'seg' });
    [['normal', 'r · n = D'], ['param', 'r = a + λb + μc']].forEach(([val, text]) => {
      const b = el('button', { class: o.form === val ? 'on' : '' }, text);
      b.onclick = () => { o.form = val; o.geom = resolve(o); card.replaceWith(buildCard(o)); refresh(); };
      seg.appendChild(b);
    });
    card.appendChild(seg);
  }

  const fieldsKey = o.type === 'plane' ? `plane-${o.form}` : o.type;
  const fields = el('div', { class: 'fields' });
  o.inputs = {};
  for (const [key, text] of FIELDS[fieldsKey]) {
    const input = el('input', { value: o.fields[key], spellcheck: 'false', autocomplete: 'off' });
    input.oninput = () => { o.fields[key] = input.value; o.geom = resolve(o); updateInfo(o); refresh(); };
    o.inputs[key] = input;
    const lab = el('label', { class: key === 'D' ? 'short' : '' });
    lab.append(el('span', {}, text), input);
    fields.appendChild(lab);
  }
  card.appendChild(fields);

  if (o.type === 'line') {
    const wrap = el('div', { class: 'lambda' });
    const slider = el('input', { type: 'range', min: '-5', max: '5', step: '0.1', value: String(o.lambda), 'aria-label': 'λ' });
    const read = el('div', { class: 'lambda-read' });
    slider.oninput = () => { o.lambda = Number(slider.value); updateInfo(o); refresh(); };
    wrap.append(el('span', {}, 'Slide λ'), slider);
    card.append(wrap, read);
    o.lambdaRead = read;
  }

  o.info = el('div', { class: 'info' });
  o.err = el('div', { class: 'err' });
  card.append(o.info, o.err);
  updateInfo(o);
  return card;
}

function updateInfo(o) {
  if (!o.info) return;
  const g = o.geom;
  for (const [k, input] of Object.entries(o.inputs)) input.classList.toggle('bad', Boolean(g.error) && g.field === k);
  o.err.textContent = g.error ?? '';
  if (g.error) { o.info.innerHTML = ''; if (o.lambdaRead) o.lambdaRead.innerHTML = ''; return; }
  const arr = (s) => `<span class="arr">${s}</span>`;
  let html = '';
  if (o.type === 'point') html = `${arr('O' + o.name)} = ${fmtVec(g.p)}`;
  if (o.type === 'vector') html = `|<b>${o.name}</b>| = ${fmtExact(len(g.v))}`;
  if (o.type === 'line') {
    html = `<div>${lineEq(g.a, g.d)}</div><div class="cart">${fmtLineCartesian(g.a, g.d)}</div>`;
    const P = add(g.a, scale(g.d, o.lambda));
    o.lambdaRead.innerHTML = `λ = ${fmtNum(o.lambda)} gives the point (${fmtRow(P)})`;
  }
  if (o.type === 'plane') {
    html = `<div><b>r</b> · ${fmtVec(g.n)} = ${fmtNum(g.D)}</div><div class="cart">${fmtPlaneCartesian(g.n, g.D)}</div>`;
    if (o.form === 'param') html += `<div class="muted small">Normal <b>n</b> = <b>b</b> × <b>c</b> (simplified)</div>`;
  }
  o.info.innerHTML = html;
}

// ---------- compare ----------
const selA = $('#selA'), selB = $('#selB'), results = $('#results');
selA.onchange = () => { state.selA = Number(selA.value); refresh(); };
selB.onchange = () => { state.selB = Number(selB.value); refresh(); };

function fillSelect(sel, chosen) {
  sel.innerHTML = state.objects
    .map((o) => `<option value="${o.id}" ${o.id === chosen ? 'selected' : ''}>${escapeHTML(o.name)} (${TYPES[o.type].label.toLowerCase()})</option>`)
    .join('');
}

const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function currentAnalysis() {
  const ids = state.objects.map((o) => o.id);
  if (!ids.includes(state.selA)) state.selA = ids[0] ?? null;
  if (!ids.includes(state.selB) || (state.selB === state.selA && ids.length > 1)) {
    state.selB = ids.find((id) => id !== state.selA) ?? null;
  }
  fillSelect(selA, state.selA);
  fillSelect(selB, state.selB);
  const A = state.objects.find((o) => o.id === state.selA);
  const B = state.objects.find((o) => o.id === state.selB);
  if (!A || !B) return { message: 'Add at least two objects to compare them.' };
  if (A.geom.error || B.geom.error) return { message: 'Fix the input errors above first.' };
  const wrap = (o) => ({ id: o.id, type: o.type, name: escapeHTML(o.name), ...o.geom });
  return analyze(wrap(A), wrap(B));
}

function renderResults(r) {
  if (r.message) { results.innerHTML = `<p class="empty">${r.message}</p>`; return; }
  results.innerHTML = `
    <div class="verdict">${r.verdict}</div>
    ${r.rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    ${r.method.length ? `<details class="method" open><summary>How to work it out</summary><ol>${r.method.map((m) => `<li>${m}</li>`).join('')}</ol></details>` : ''}`;
}

// ---------- refresh everything ----------
function refresh() {
  clearGroup(objectLayer);
  clearGroup(markLayer);
  for (const o of state.objects) {
    if (o.visible && !o.geom.error) objectLayer.add(drawObject(o, o.geom));
  }
  const r = currentAnalysis();
  renderResults(r);
  if (!r.message) drawMarks(r.marks);
}

document.querySelectorAll('[data-add]').forEach((b) => {
  b.onclick = () => {
    const o = makeObject(b.dataset.add);
    state.objects.push(o);
    renderCards();
    refresh();
    objectsBox.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
});

// Icons (inline SVG)
const svg = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const eyeIcon = svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
const eyeOffIcon = svg('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>');
const trashIcon = svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>');

// Starting example: a line meeting a plane.
state.objects.push(makeObject('line'), makeObject('plane'));
renderCards();
refresh();
