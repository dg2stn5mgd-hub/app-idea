// A small 2D graph plotter on <canvas> for the Graphs pages.
// Keeps a list of things to draw (curves, asymptotes, points) and redraws them when you pan or zoom.

const AXIS = '#334155';
const GRID = '#e2e8f0';
const GRID_MINOR = '#f1f5f9';
const LABEL = '#64748b';

export class Plot {
  constructor(container, { xmin = -6, xmax = 6, ymin = -5, ymax = 5, equal = false } = {}) {
    this.el = container;
    this.el.classList.add('plot');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.el.appendChild(this.canvas);
    this.home = { xmin, xmax, ymin, ymax };
    this.equal = equal;
    this.view = { ...this.home };
    this.items = [];

    const reset = document.createElement('button');
    reset.className = 'viewer-reset';
    reset.type = 'button';
    reset.textContent = 'Reset view';
    reset.addEventListener('click', () => this.resetView());
    this.el.appendChild(reset);

    this.tip = document.createElement('div');
    this.tip.className = 'plot-tip';
    this.el.appendChild(this.tip);

    this._bindInput();
    new ResizeObserver(() => this._resize()).observe(this.el);
    this._resize();
  }

  // ---------- view ----------
  setHome(v) { this.home = { ...v }; this.resetView(); }
  resetView() { this.view = { ...this.home }; this._fitAspect(); this.draw(); }
  _fitAspect() {
    if (!this.equal || !this.w) return;
    const v = this.view;
    const cx = (v.xmin + v.xmax) / 2, cy = (v.ymin + v.ymax) / 2;
    const ppu = Math.min(this.w / (v.xmax - v.xmin), this.h / (v.ymax - v.ymin));
    const hw = this.w / ppu / 2, hh = this.h / ppu / 2;
    this.view = { xmin: cx - hw, xmax: cx + hw, ymin: cy - hh, ymax: cy + hh };
  }
  _resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const first = !this.w;
    this.w = r.width; this.h = r.height;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (first) this._fitAspect();
    else if (this.equal) this._fitAspect();
    this.draw();
  }
  px(x) { return ((x - this.view.xmin) / (this.view.xmax - this.view.xmin)) * this.w; }
  py(y) { return this.h - ((y - this.view.ymin) / (this.view.ymax - this.view.ymin)) * this.h; }
  ux(px) { return this.view.xmin + (px / this.w) * (this.view.xmax - this.view.xmin); }
  uy(py) { return this.view.ymin + ((this.h - py) / this.h) * (this.view.ymax - this.view.ymin); }

  _bindInput() {
    const c = this.canvas;
    const pointers = new Map();
    let last = null;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      last = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) { this._hover(e.offsetX, e.offsetY); return; }
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pointers.size === 1) {
        const dx = this.ux(prev.x) - this.ux(e.offsetX), dy = this.uy(prev.y) - this.uy(e.offsetY);
        const v = this.view;
        this.view = { xmin: v.xmin + dx, xmax: v.xmax + dx, ymin: v.ymin + dy, ymax: v.ymax + dy };
        this.draw();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (last) this._zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, last / d);
        last = d;
      }
      this.tip.style.display = 'none';
    });
    const up = (e) => { pointers.delete(e.pointerId); last = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { this.tip.style.display = 'none'; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoomAt(e.offsetX, e.offsetY, Math.exp(e.deltaY * 0.0015));
    }, { passive: false });
  }
  _zoomAt(sx, sy, k) {
    const x = this.ux(sx), y = this.uy(sy), v = this.view;
    this.view = {
      xmin: x + (v.xmin - x) * k, xmax: x + (v.xmax - x) * k,
      ymin: y + (v.ymin - y) * k, ymax: y + (v.ymax - y) * k,
    };
    this.draw();
  }
  // Show the coordinates of a labelled point when the mouse is near it.
  _hover(sx, sy) {
    let best = null, bestD = 12;
    for (const it of this.items) {
      if (it.kind !== 'point' || !it.tip) continue;
      const d = Math.hypot(this.px(it.x) - sx, this.py(it.y) - sy);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) { this.tip.style.display = 'none'; return; }
    this.tip.textContent = best.tip;
    this.tip.style.display = 'block';
    this.tip.style.left = Math.min(this.px(best.x) + 10, this.w - 160) + 'px';
    this.tip.style.top = Math.max(this.py(best.y) - 34, 4) + 'px';
  }

  // ---------- things to draw ----------
  clear() { this.items = []; return this; }
  // y = f(x).  opts: color, width, dash, alpha, xmin, xmax (restrict domain)
  fn(f, opts = {}) { this.items.push({ kind: 'fn', f, ...opts }); return this; }
  // (x(t), y(t)) for t in [t0, t1]
  param(fx, fy, t0, t1, opts = {}) { this.items.push({ kind: 'param', fx, fy, t0, t1, ...opts }); return this; }
  vline(x, opts = {}) { this.items.push({ kind: 'vline', x, ...opts }); return this; }
  // y = m x + c
  sline(m, c, opts = {}) { this.items.push({ kind: 'sline', m, c, ...opts }); return this; }
  point(x, y, opts = {}) { this.items.push({ kind: 'point', x, y, ...opts }); return this; }
  // Hollow circle, e.g. a point excluded from the graph.
  hole(x, y, opts = {}) { this.items.push({ kind: 'point', x, y, hollow: true, ...opts }); return this; }
  arrow(x1, y1, x2, y2, opts = {}) { this.items.push({ kind: 'arrow', x1, y1, x2, y2, ...opts }); return this; }

  // ---------- rendering ----------
  draw() {
    if (!this.w) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.w, this.h);
    this._grid();
    const order = { vline: 0, sline: 0, fn: 1, param: 1, arrow: 2, point: 3 };
    const items = [...this.items].sort((a, b) => order[a.kind] - order[b.kind]);
    for (const it of items) this['_' + it.kind](it);
    this._pointLabels(items.filter((i) => i.kind === 'point' && i.label));
  }

  _step() {
    const span = this.view.xmax - this.view.xmin;
    const target = span / Math.max(4, this.w / 70);
    const p = Math.pow(10, Math.floor(Math.log10(target)));
    for (const m of [1, 2, 5, 10]) if (m * p >= target) return m * p;
    return 10 * p;
  }
  _grid() {
    const ctx = this.ctx, v = this.view;
    const sx = this._step();
    // Same spacing both ways when the scales match, otherwise its own spacing for y.
    const ySpan = v.ymax - v.ymin;
    const tgt = ySpan / Math.max(4, this.h / 60);
    let sy = Math.pow(10, Math.floor(Math.log10(tgt)));
    for (const m of [1, 2, 5, 10]) if (m * sy >= tgt) { sy *= m; break; }
    const lines = (step, minor) => {
      ctx.strokeStyle = minor ? GRID_MINOR : GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.ceil(v.xmin / step) * step; x <= v.xmax; x += step) {
        const X = Math.round(this.px(x)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, this.h);
      }
      const ys = minor ? step * (sy / sx) : sy;
      for (let y = Math.ceil(v.ymin / ys) * ys; y <= v.ymax; y += ys) {
        const Y = Math.round(this.py(y)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(this.w, Y);
      }
      ctx.stroke();
    };
    lines(sx / 5, true);
    lines(sx, false);

    // axes
    const X0 = Math.round(this.px(0)) + 0.5, Y0 = Math.round(this.py(0)) + 0.5;
    ctx.strokeStyle = AXIS; ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (v.xmin < 0 && v.xmax > 0) { ctx.moveTo(X0, 0); ctx.lineTo(X0, this.h); }
    if (v.ymin < 0 && v.ymax > 0) { ctx.moveTo(0, Y0); ctx.lineTo(this.w, Y0); }
    ctx.stroke();

    // tick labels, kept on screen when the axis is off to one side
    ctx.fillStyle = LABEL;
    ctx.font = '11px system-ui, sans-serif';
    const ly = Math.min(Math.max(Y0 + 4, 4), this.h - 16);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) {
      if (Math.abs(x) < sx / 2) continue;
      ctx.fillText(tick(x, sx), this.px(x), ly);
    }
    const lx = Math.min(Math.max(X0 - 5, 28), this.w - 4);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) {
      if (Math.abs(y) < sy / 2) continue;
      ctx.fillText(tick(y, sy), lx, this.py(y));
    }
    if (v.xmin < 0 && v.xmax > 0 && v.ymin < 0 && v.ymax > 0) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('O', X0 - 4, Y0 + 3);
    }
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillStyle = AXIS;
    if (v.ymin < 0 && v.ymax > 0) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('x', this.w - 6, Y0 - 3); }
    if (v.xmin < 0 && v.xmax > 0) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('y', X0 + 6, 6); }
  }

  _stroke(it, fallbackWidth = 2.5) {
    const ctx = this.ctx;
    ctx.strokeStyle = it.color || '#2563eb';
    ctx.lineWidth = it.width || fallbackWidth;
    ctx.globalAlpha = it.alpha ?? 1;
    ctx.setLineDash(it.dash ? (it.dash === true ? [7, 6] : it.dash) : []);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  }
  _done() { const ctx = this.ctx; ctx.globalAlpha = 1; ctx.setLineDash([]); }

  _fn(it) {
    const ctx = this.ctx, v = this.view, f = it.f;
    const H = v.ymax - v.ymin;
    const lo = Math.max(v.xmin, it.xmin ?? -Infinity), hi = Math.min(v.xmax, it.xmax ?? Infinity);
    if (lo >= hi) return;
    const n = Math.ceil(((hi - lo) / (v.xmax - v.xmin)) * this.w * 2);
    const clampY = (y) => Math.max(-10 * this.h, Math.min(11 * this.h, this.py(y)));
    this._stroke(it);
    ctx.beginPath();
    let pen = false, px0 = 0, py0 = 0;
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      const y = f(x);
      if (!Number.isFinite(y)) { pen = false; continue; }
      if (pen) {
        // A big jump with a midpoint that isn't between the ends means an asymptote: lift the pen.
        if (Math.abs(y - py0) > H * 0.5) {
          const ym = f((x + px0) / 2);
          const between = Number.isFinite(ym) && ym >= Math.min(y, py0) - H * 0.05 && ym <= Math.max(y, py0) + H * 0.05;
          if (!between) pen = false;
        }
      }
      if (pen) ctx.lineTo(this.px(x), clampY(y));
      else ctx.moveTo(this.px(x), clampY(y));
      pen = true; px0 = x; py0 = y;
    }
    ctx.stroke();
    this._done();
  }
  _param(it) {
    const ctx = this.ctx;
    const n = 600;
    this._stroke(it);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = it.t0 + ((it.t1 - it.t0) * i) / n;
      const X = this.px(it.fx(t)), Y = this.py(it.fy(t));
      if (!Number.isFinite(X) || !Number.isFinite(Y) || Math.abs(X) > 1e5 || Math.abs(Y) > 1e5) continue;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    this._done();
  }
  _vline(it) {
    const ctx = this.ctx;
    this._stroke({ dash: true, width: 1.5, color: '#64748b', ...it });
    const X = this.px(it.x);
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, this.h); ctx.stroke();
    this._done();
    if (it.label) this._edgeLabel(it.label, X + 5, this.h - 14, it.color || '#64748b', 'left');
  }
  _sline(it) {
    const ctx = this.ctx, v = this.view;
    this._stroke({ dash: true, width: 1.5, color: '#64748b', ...it });
    ctx.beginPath();
    ctx.moveTo(this.px(v.xmin), this.py(it.m * v.xmin + it.c));
    ctx.lineTo(this.px(v.xmax), this.py(it.m * v.xmax + it.c));
    ctx.stroke();
    this._done();
    if (it.label) {
      // Put the label near the right edge, on the line if it's visible there.
      const x = this.ux(this.w - 8);
      let Y = this.py(it.m * x + it.c);
      if (Y < 12 || Y > this.h - 12) {
        // find where the line leaves the top/bottom instead
        const yEdge = it.m > 0 ? v.ymax : v.ymin;
        const xe = it.m !== 0 ? (yEdge - it.c) / it.m : x;
        this._edgeLabel(it.label, Math.min(this.px(xe) - 6, this.w - 8), it.m > 0 ? 16 : this.h - 10, it.color || '#64748b', 'right');
      } else this._edgeLabel(it.label, this.w - 8, Y - 9, it.color || '#64748b', 'right');
    }
  }
  _edgeLabel(text, x, y, color, align) {
    const ctx = this.ctx;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  _arrow(it) {
    const ctx = this.ctx;
    const x1 = this.px(it.x1), y1 = this.py(it.y1), x2 = this.px(it.x2), y2 = this.py(it.y2);
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 6) return;
    this._stroke({ width: 1.8, ...it });
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1), s = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4));
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4));
    ctx.stroke();
    this._done();
  }
  _point(it) {
    const ctx = this.ctx;
    const X = this.px(it.x), Y = this.py(it.y);
    if (X < -20 || X > this.w + 20 || Y < -20 || Y > this.h + 20) return;
    ctx.beginPath();
    ctx.arc(X, Y, it.r || 4.5, 0, Math.PI * 2);
    ctx.fillStyle = it.hollow ? '#fff' : it.color || '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = it.hollow ? it.color || '#0f172a' : '#fff';
    ctx.stroke();
  }
  // Labels for points, nudged so they don't sit on top of each other.
  _pointLabels(pts) {
    const ctx = this.ctx;
    ctx.font = '600 12px system-ui, sans-serif';
    const placed = [];
    for (const it of pts) {
      const X = this.px(it.x), Y = this.py(it.y);
      if (X < 0 || X > this.w || Y < 0 || Y > this.h) continue;
      const tw = ctx.measureText(it.label).width;
      const tries = [[8, -12], [8, 14], [-tw - 8, -12], [-tw - 8, 14], [8, -28], [-tw - 8, 30]];
      let box = null;
      for (const [dx, dy] of tries) {
        const b = { x: X + dx, y: Y + dy - 8, w: tw, h: 16 };
        if (b.x < 2 || b.x + b.w > this.w - 2 || b.y < 2 || b.y + b.h > this.h - 2) continue;
        if (!placed.some((p) => b.x < p.x + p.w && p.x < b.x + b.w && b.y < p.y + p.h && p.y < b.y + b.h)) { box = b; break; }
      }
      if (!box) box = { x: Math.min(X + 8, this.w - tw - 2), y: Y - 20, w: tw, h: 16 };
      placed.push(box);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeText(it.label, box.x, box.y + 8);
      ctx.fillStyle = it.labelColor || it.color || '#0f172a';
      ctx.fillText(it.label, box.x, box.y + 8);
    }
  }
}

function tick(v, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return (Math.round(v / step) * step).toFixed(d).replace('-', '−');
}
