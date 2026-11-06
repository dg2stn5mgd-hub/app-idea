// A small reusable 3D viewer for the Learn pages.
// Usage: const v = createViewer(element); v.arrow([0,0,0], [1,2,3], '#2563eb', 'a');
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { add, sub, scale, dot, len } from './math.js';

// Maths is z-up, three.js is y-up.
export const M = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
const UP = new THREE.Vector3(0, 1, 0);

const solid = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

function rod(p, q, r, mat) {
  const P = M(p), Q = M(q);
  const dir = Q.clone().sub(P);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), mat);
  m.position.copy(P).add(Q).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

function arrowMesh(from, to, mat, r = 0.05, headR = 0.15, headL = 0.45) {
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

function makeLabel(text, p, cls, color) {
  const outer = document.createElement('div');
  const inner = document.createElement('span');
  inner.className = 'lbl ' + (cls || '');
  inner.textContent = text;
  if (color) inner.style.color = color;
  outer.appendChild(inner);
  const o = new CSS2DObject(outer);
  o.position.copy(M(p));
  return o;
}

function clearGroup(g) {
  const labels = [];
  g.traverse((o) => {
    if (o.isCSS2DObject) labels.push(o);
    o.geometry?.dispose();
    o.material?.dispose?.();
  });
  labels.forEach((l) => l.parent.remove(l));
  g.clear();
}

export function createViewer(el, { axis = 6, cameraAt = [9, 5.5, 5.5], target = [0, 0, 0] } = {}) {
  el.classList.add('viewer');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  el.appendChild(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'labels';
  el.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f8fafc');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(10, 20, 15);
  scene.add(sun);

  // axes + grid
  const axisMat = new THREE.MeshBasicMaterial({ color: '#64748b' });
  ['x', 'y', 'z'].forEach((name, i) => {
    const e = [0, 0, 0]; e[i] = 1;
    scene.add(arrowMesh(scale(e, -axis), scale(e, axis), axisMat, 0.018, 0.09, 0.3));
    scene.add(makeLabel(name, scale(e, axis + 0.6), 'axis'));
    for (let t = -axis + 2; t < axis; t += 2) if (t !== 0) scene.add(makeLabel(String(t), scale(e, t), 'tick'));
  });
  scene.add(makeLabel('O', [0, 0, 0], 'tick off'));
  const grid = new THREE.GridHelper(2 * axis, 2 * axis, 0xcbd5e1, 0xe2e8f0);
  scene.add(grid);

  const layer = new THREE.Group();
  scene.add(layer);

  function resetView() {
    const zoomOut = camera.aspect < 0.9 ? 1.3 : 1; // tall, narrow views need more room
    camera.position.copy(M(cameraAt)).multiplyScalar(zoomOut).add(M(target));
    controls.target.copy(M(target));
    controls.update();
  }

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(el);
  resize();
  resetView();

  const btn = document.createElement('button');
  btn.className = 'viewer-reset';
  btn.textContent = 'Reset view';
  btn.onclick = resetView;
  el.appendChild(btn);

  // Only animate while on screen (saves battery with several demos on a page).
  const loop = () => { controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); };
  new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry.isIntersecting ? loop : null);
  }).observe(el);
  loop();

  return {
    clear: () => clearGroup(layer),
    arrow(from, to, color, text, { r = 0.055 } = {}) {
      layer.add(arrowMesh(from, to, solid(color), r, r * 3, 0.45));
      if (text) layer.add(makeLabel(text, to, 'off bold', color));
    },
    point(p, color, text) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), solid(color));
      m.position.copy(M(p));
      layer.add(m);
      if (text) layer.add(makeLabel(text, p, 'off', color));
    },
    seg(p, q, color, { r = 0.025 } = {}) {
      if (len(sub(p, q)) > 1e-6) layer.add(rod(p, q, r, solid(color)));
    },
    label(text, p, color, cls = '') { layer.add(makeLabel(text, p, cls, color)); },
    // Long line through a with direction d.
    line(a, d, color, extent = 9) {
      const dh = scale(d, 1 / len(d));
      layer.add(rod(add(a, scale(dh, -extent)), add(a, scale(dh, extent)), 0.03, solid(color)));
    },
    // Arc showing the angle between u and v, centred at `at`.
    arc(u, v, color, text, { r = 1.1, at = [0, 0, 0] } = {}) {
      const lu = len(u), lv = len(v);
      if (lu < 1e-9 || lv < 1e-9) return;
      const e1 = scale(u, 1 / lu);
      const perp = sub(v, scale(e1, dot(v, e1)));
      if (len(perp) < 1e-9) return; // parallel: no arc
      const e2 = scale(perp, 1 / len(perp));
      const theta = Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (lu * lv))));
      const pts = [];
      for (let i = 0; i <= 32; i++) {
        const t = (theta * i) / 32;
        pts.push(M(add(at, add(scale(e1, r * Math.cos(t)), scale(e2, r * Math.sin(t))))));
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.025, 8, false);
      layer.add(new THREE.Mesh(tube, solid(color)));
      if (text) {
        const mid = theta / 2;
        const p = add(at, add(scale(e1, (r + 0.5) * Math.cos(mid)), scale(e2, (r + 0.5) * Math.sin(mid))));
        layer.add(makeLabel(text, p, 'small', color));
      }
    },
    // Shaded parallelogram with sides u and v from `at`.
    parallelogram(u, v, color, { at = [0, 0, 0], opacity = 0.22 } = {}) {
      const P = [at, add(at, u), add(at, add(u, v)), add(at, v)].map(M);
      const geo = new THREE.BufferGeometry().setFromPoints([P[0], P[1], P[2], P[0], P[2], P[3]]);
      layer.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
      })));
    },
    // Small square marking a right angle at corner c between directions u and v.
    rightAngle(c, u, v, color, s = 0.35) {
      const uh = scale(u, s / len(u)), vh = scale(v, s / len(v));
      this.seg(add(c, uh), add(c, add(uh, vh)), color, { r: 0.015 });
      this.seg(add(c, vh), add(c, add(uh, vh)), color, { r: 0.015 });
    },
    resetView,
  };
}
