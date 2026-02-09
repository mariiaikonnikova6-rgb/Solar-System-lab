import * as THREE from "three";
import { api } from "../api.js";
import { AU, orbitPolyline, positionAU, precompute } from "../orbitMath.js";
import { PLANETS } from "../planets.js";

function wrap2pi(x) {
  x = x % (Math.PI * 2);
  return x < 0 ? x + Math.PI * 2 : x;
}

function tJDForMeanAnomaly(pre, Mtarget) {
  const dM = wrap2pi(Mtarget - pre.M0);
  const dtYears = dM / pre.n;
  return pre.epochJD + dtYears * 365.25;
}

function perifocalToWorld(pre, xP, yP, exaggeration = 1) {
  const x1 = xP * pre.co - yP * pre.so;
  const y1 = xP * pre.so + yP * pre.co;

  const y1i = y1 * (1 + (exaggeration - 1) * 0.8);
  const x2 = x1;
  const y2 = y1i * pre.ci;
  const z2 = y1i * pre.si * exaggeration;

  const x = x2 * pre.cO - y2 * pre.sO;
  const y = x2 * pre.sO + y2 * pre.cO;
  const z = z2;
  return new THREE.Vector3(x, z, y);
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function updateSectorMesh(mesh, pre, t1JD, t2JD, exaggeration, { segments = 36 } = {}) {
  const origin = new THREE.Vector3(0, 0, 0);
  const pts = new Array(segments + 1);
  for (let i = 0; i <= segments; i++) {
    const t = t1JD + ((t2JD - t1JD) * i) / segments;
    pts[i] = positionAU(pre, t, exaggeration).multiplyScalar(AU);
  }

  const vertCount = 1 + pts.length;
  const verts = new Float32Array(vertCount * 3);
  verts[0] = origin.x;
  verts[1] = origin.y;
  verts[2] = origin.z;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const j = (i + 1) * 3;
    verts[j + 0] = p.x;
    verts[j + 1] = p.y;
    verts[j + 2] = p.z;
  }

  const indices = new Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const k = i * 3;
    indices[k + 0] = 0;
    indices[k + 1] = i + 1;
    indices[k + 2] = i + 2;
  }

  mesh.geometry.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  mesh.geometry.setIndex(indices);
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
}

function labelSprite(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = "600 18px ui-sans-serif, system-ui, Segoe UI, Arial";
  const w = Math.ceil(ctx.measureText(text).width) + 18 * 2;
  const h = 46;
  canvas.width = w;
  canvas.height = h;
  ctx.font = "600 18px ui-sans-serif, system-ui, Segoe UI, Arial";
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(1, 1, w - 2, h - 2, 12);
  else ctx.rect(1, 1, w - 2, h - 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 18, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(canvas.width / 14, canvas.height / 14, 1);
  return spr;
}

function drawChart(canvas, points, highlight) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  const xs = points.map((p) => Math.log10(p.a3));
  const ys = points.map((p) => Math.log10(p.T2));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (x) => 16 + ((x - minX) / (maxX - minX + 1e-9)) * (w - 32);
  const sy = (y) => h - 16 - ((y - minY) / (maxY - minY + 1e-9)) * (h - 32);

  for (const p of points) {
    const x = sx(Math.log10(p.a3));
    const y = sy(Math.log10(p.T2));
    ctx.fillStyle = p.key === highlight ? "rgba(74,208,163,0.95)" : "rgba(122,169,255,0.75)";
    ctx.beginPath();
    ctx.arc(x, y, p.key === highlight ? 4.2 : 3.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px ui-sans-serif, system-ui, Segoe UI, Arial";
  ctx.fillText("Kepler-3 (log-log): T² ~ a³", 12, 18);
}

export class KeplerMode {
  constructor(app, state, { setHudObject } = {}) {
    this.app = app;
    this.state = state;
    this.setHudObject = setHudObject;
    this.panel = null;
    this.obj = null;
    this.k1 = true;
    this.k2 = false;
    this.k3 = true;
    this.exag = 1.0;
    this._line = null;
    this._focus1 = null;
    this._focus2 = null;
    this._axisA = null;
    this._area = null;
    this._areaFar = null;
    this._labels = [];
    this._chart = null;
    this._chartPts = [];
  }

  async enter(panel, i18n) {
    this.panel = panel;
    panel.innerHTML = `
      <div class="panel__title">${i18n.modePanels.keplerTitle}</div>
      <div class="panel__row">
        <button class="btn" id="k-pick" style="flex:1">${i18n.kepler.body}</button>
      </div>
      <div class="panel__grid">
        <label class="toggle"><input type="checkbox" id="k1" checked/> ${i18n.kepler.k1}</label>
        <label class="toggle"><input type="checkbox" id="k2" /> ${i18n.kepler.k2}</label>
        <label class="toggle"><input type="checkbox" id="k3" checked/> ${i18n.kepler.k3}</label>
      </div>
      <div class="panel__row" style="margin-top:10px;">
        <div class="hint" style="flex:1">${i18n.kepler.exaggeration}</div>
      </div>
      <div class="panel__row">
        <input id="k-exag" class="range" type="range" min="1" max="6" step="0.25" value="1" />
      </div>
      <canvas id="k-chart" width="320" height="170" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.08);"></canvas>
      <div class="hint" id="k-status"></div>
    `;

    panel.querySelector("#k1").addEventListener("change", (e) => (this.k1 = e.target.checked));
    panel.querySelector("#k2").addEventListener("change", (e) => (this.k2 = e.target.checked));
    panel.querySelector("#k3").addEventListener("change", (e) => (this.k3 = e.target.checked));
    panel.querySelector("#k-exag").addEventListener("input", (e) => (this.exag = Number(e.target.value)));
    panel.querySelector("#k-pick").addEventListener("click", async () => {
      await this.pickRandom();
    });
    this._chart = panel.querySelector("#k-chart");
    this._chartPts = PLANETS.map((p) => ({ key: p.name, a3: Math.pow(p.a, 3), T2: Math.pow(2 * Math.PI * Math.pow(p.a, 1.5), 2) }));
    drawChart(this._chart, this._chartPts, "Earth");

    await this.pickRandom();
  }

  exit() {
    this._clearScene();
    this.panel = null;
    this.obj = null;
  }

  _clearScene() {
    if (this._line) this.app.layers.overlays.remove(this._line);
    if (this._focus1) this.app.layers.overlays.remove(this._focus1);
    if (this._focus2) this.app.layers.overlays.remove(this._focus2);
    if (this._axisA) this.app.layers.overlays.remove(this._axisA);
    if (this._area) this.app.layers.overlays.remove(this._area);
    if (this._areaFar) this.app.layers.overlays.remove(this._areaFar);
    for (const l of this._labels) this.app.layers.overlays.remove(l);
    this._line = this._focus1 = this._focus2 = this._axisA = this._area = this._areaFar = null;
    this._labels = [];
  }

  async pickRandom() {
    const status = this.panel?.querySelector("#k-status");
    if (status) status.textContent = "…";
    try {
      const obj = await api.random("any");
      this.obj = obj;
      this.setHudObject?.(obj);
      this._buildKepler1();
      this._buildKepler2();
      this._updateChart();
      if (status) status.textContent = `${obj.name} • a=${obj.a.toFixed(2)} AU • e=${obj.e.toFixed(3)}`;
    } catch (e) {
      if (status) status.textContent = String(e);
    }
  }

  _updateChart() {
    if (!this._chart || !this.obj) return;
    const p = { key: this.obj.spkid, a3: Math.pow(this.obj.a, 3), T2: Math.pow(2 * Math.PI * Math.pow(this.obj.a, 1.5), 2) };
    const pts = [...this._chartPts, p];
    drawChart(this._chart, pts, p.key);
  }

  _buildKepler1() {
    this._clearScene();
    if (!this.obj) return;
    const pre = precompute({
      a: this.obj.a,
      e: this.obj.e,
      i: this.obj.i,
      Omega: this.obj.Omega,
      omega: this.obj.omega,
      M0: this.obj.M0,
      epochJD: 2440587.5 + Date.parse(this.obj.epoch) / 86400000,
    });
    const pts = orbitPolyline(pre, 420).map((v) => v.multiplyScalar(AU));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this._line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7aa9ff, transparent: true, opacity: 0.85 }));
    this.app.layers.overlays.add(this._line);

    const focusMat = new THREE.MeshBasicMaterial({ color: 0x4ad0a3 });
    const focusMat2 = new THREE.MeshBasicMaterial({ color: 0xff5ff4 });
    this._focus1 = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 16), focusMat);
    this._focus1.position.set(0, 0, 0);
    this.app.layers.overlays.add(this._focus1);

    // Focus-2 is offset from the Sun by (-2ae, 0) in perifocal coordinates (origin at the Sun/focus-1).
    const f2World = perifocalToWorld(pre, -2 * this.obj.a * this.obj.e, 0, this.exag).multiplyScalar(AU);

    this._focus2 = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 16), focusMat2);
    this._focus2.position.copy(f2World);
    this.app.layers.overlays.add(this._focus2);

    // Semi-major axis segment (center -> perihelion), rendered as a contrasting dashed line.
    const q = this.obj.q ?? this.obj.a * (1 - this.obj.e);
    const Q = this.obj.Q ?? this.obj.a * (1 + this.obj.e);
    const pPeri = positionAU(pre, tJDForMeanAnomaly(pre, 0), this.exag).multiplyScalar(AU);
    const pAph = positionAU(pre, tJDForMeanAnomaly(pre, Math.PI), this.exag).multiplyScalar(AU);
    const center = pPeri.clone().add(pAph).multiplyScalar(0.5);
    const axisGeo = new THREE.BufferGeometry().setFromPoints([center, pPeri]);
    const axisMat = new THREE.LineDashedMaterial({ color: 0xff5ff4, dashSize: 2.2, gapSize: 1.2, transparent: true, opacity: 0.95 });
    this._axisA = new THREE.Line(axisGeo, axisMat);
    this._axisA.computeLineDistances();
    this.app.layers.overlays.add(this._axisA);

    const l1 = labelSprite(`a=${this.obj.a.toFixed(2)} AU  e=${this.obj.e.toFixed(3)}`);
    l1.position.set(this.obj.a * AU, 0, 0);
    const l2 = labelSprite(`q=${q.toFixed(2)} AU`);
    l2.position.set(q * AU, 0, 0);
    const l3 = labelSprite(`Q=${Q.toFixed(2)} AU`);
    l3.position.set(Q * AU, 0, 0);
    this._labels.push(l1, l2, l3);
    for (const l of this._labels) this.app.layers.overlays.add(l);
  }

  _buildKepler2() {
    if (!this.obj) return;
    const matNear = new THREE.MeshBasicMaterial({ color: 0x7aa9ff, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
    const matFar = new THREE.MeshBasicMaterial({ color: 0xff5ff4, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    this._area = new THREE.Mesh(new THREE.BufferGeometry(), matNear);
    this._areaFar = new THREE.Mesh(new THREE.BufferGeometry(), matFar);
    this.app.layers.overlays.add(this._area);
    this.app.layers.overlays.add(this._areaFar);
  }

  update(tJD) {
    if (!this.obj) return;
    const pre = precompute({
      a: this.obj.a,
      e: this.obj.e,
      i: this.obj.i,
      Omega: this.obj.Omega,
      omega: this.obj.omega,
      M0: this.obj.M0,
      epochJD: 2440587.5 + Date.parse(this.obj.epoch) / 86400000,
    });

    if (this.k1 && this._line) this._line.visible = true;
    if (!this.k1 && this._line) this._line.visible = false;
    if (this._focus1) this._focus1.visible = !!this.k1;
    if (this._focus2) this._focus2.visible = !!this.k1;
    if (this._axisA) this._axisA.visible = !!this.k1;
    for (const l of this._labels) l.visible = !!this.k1;

    if (this.k1) {
      if (this._focus2) this._focus2.position.copy(perifocalToWorld(pre, -2 * this.obj.a * this.obj.e, 0, this.exag).multiplyScalar(AU));
      if (this._axisA) {
        const pPeri = positionAU(pre, tJDForMeanAnomaly(pre, 0), this.exag).multiplyScalar(AU);
        const pAph = positionAU(pre, tJDForMeanAnomaly(pre, Math.PI), this.exag).multiplyScalar(AU);
        const center = pPeri.clone().add(pAph).multiplyScalar(0.5);
        const pos = this._axisA.geometry.getAttribute("position");
        pos.setXYZ(0, center.x, center.y, center.z);
        pos.setXYZ(1, pPeri.x, pPeri.y, pPeri.z);
        pos.needsUpdate = true;
        this._axisA.computeLineDistances();
        this._axisA.geometry.computeBoundingSphere();
      }
    }

    if (this._area) this._area.visible = !!this.k2;
    if (this._areaFar) this._areaFar.visible = !!this.k2;

    if (this.k2 && this._area && this._areaFar) {
      // Pick a time window large enough to be visually obvious for asteroids, but not so large that the sector dominates the orbit.
      // P(years)=2πa^(3/2) (mu=1), so P(days)=P*365.25.
      const periodDays = 2 * Math.PI * Math.pow(this.obj.a, 1.5) * 365.25;
      const dtDays = clamp(periodDays * 0.05, 12, 180); // 5% of orbit, bounded
      const tPeri = tJDForMeanAnomaly(pre, 0);
      const tAph = tJDForMeanAnomaly(pre, Math.PI);

      updateSectorMesh(this._area, pre, tPeri, tPeri + dtDays, this.exag);
      updateSectorMesh(this._areaFar, pre, tAph, tAph + dtDays, this.exag);
    }
  }
}
