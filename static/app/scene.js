import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { AU, orbitPolyline, positionAU, precompute } from "./orbitMath.js";
import { PLANETS, planetByName } from "./planets.js";

const AU_KM = 149597870;
const SUN_RADIUS_KM = 695700;

const COLORS = {
  mainbelt: 0x8fd3ff,
  neo: 0xffb86b,
  trojan: 0x7ce6b8,
  comet: 0xff6b8a,
  other: 0xaab2c5,
};

const isFiniteVec3 = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0x10000000;
  };
}

function colorToRGB(color) {
  const c = new THREE.Color(color);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function drawNoise(ctx, w, h, rng, alpha = 0.08, scale = 4) {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.floor(rng() * 255);
      const i = (y * w + x) * 4;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (scale !== 1) ctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, w, h);
}

function generateHeightmap(ctx, w, h, rng, { blobs = 60, base = 110, range = 80, soften = true } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < blobs; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 18 + rng() * 90;
    const v = base + (rng() - 0.5) * range * 2;
    ctx.fillStyle = `rgba(${v},${v},${v},0.9)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + rng() * 0.9), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  if (soften) {
    ctx.globalAlpha = 0.6;
    ctx.filter = "blur(6px)";
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }
}

function normalMapFromHeight(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const strength = 2.2;
  const getH = (x, y) => {
    const ix = ((y + h) % h) * w + ((x + w) % w);
    return src.data[ix * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = getH(x + 1, y) - getH(x - 1, y);
      const dy = getH(x, y + 1) - getH(x, y - 1);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      dst.data[i + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      dst.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst.data[i + 3] = 255;
    }
  }
  ctx.putImageData(dst, 0, 0);
}

function makePlanetMaps(p) {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const [r, g, b] = colorToRGB(p.color);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);

  const rng = seededRandom(
    p.name
      .split("")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 2654435761
  );

  if (["Jupiter", "Saturn"].includes(p.name)) {
    const bands = p.name === "Jupiter" ? 10 : 8;
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * h;
      const bandH = h / bands + rng() * 6;
      const tint = 12 + rng() * 28;
      ctx.fillStyle = `rgba(${Math.min(255, r + tint)},${Math.min(255, g + tint)},${Math.min(255, b + tint)},0.65)`;
      ctx.fillRect(0, y, w, bandH);
      ctx.fillStyle = `rgba(${Math.max(0, r - tint)},${Math.max(0, g - tint)},${Math.max(0, b - tint)},0.5)`;
      ctx.fillRect(0, y + bandH * 0.4, w, bandH * 0.3);
    }
  } else if (["Uranus", "Neptune"].includes(p.name)) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${r + 8},${g + 10},${b + 20},0.9)`);
    grad.addColorStop(1, `rgba(${r - 10},${g - 6},${b - 6},0.9)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${r + 14},${g + 10},${b + 10},0.9)`);
    grad.addColorStop(1, `rgba(${r - 12},${g - 12},${b - 12},0.95)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawNoise(ctx, w, h, rng, p.name === "Mercury" ? 0.2 : 0.12);

  if (p.name === "Earth") {
    ctx.fillStyle = "rgba(40,120,70,0.8)";
    for (let i = 0; i < 22; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const rw = 18 + rng() * 60;
      const rh = 10 + rng() * 35;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(250,250,255,0.6)";
    for (let i = 0; i < 12; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const rw = 30 + rng() * 70;
      const rh = 12 + rng() * 26;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(230,240,250,0.8)";
    ctx.beginPath();
    ctx.ellipse(w * 0.1, h * 0.1, 80, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.88, h * 0.9, 70, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;

  const specCanvas = document.createElement("canvas");
  specCanvas.width = w;
  specCanvas.height = h;
  const sctx = specCanvas.getContext("2d");
  const simg = ctx.getImageData(0, 0, w, h);
  const oimg = sctx.createImageData(w, h);
  for (let i = 0; i < simg.data.length; i += 4) {
    const r = simg.data[i];
    const g = simg.data[i + 1];
    const b = simg.data[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    let spec = 0.08 + lum * 0.2;
    if (p.name === "Earth") spec = 0.05 + (b / 255) * 0.6;
    if (["Jupiter", "Saturn", "Uranus", "Neptune", "Venus"].includes(p.name)) spec = 0.12 + lum * 0.1;
    const v = Math.round(Math.max(0, Math.min(1, spec)) * 255);
    oimg.data[i] = oimg.data[i + 1] = oimg.data[i + 2] = v;
    oimg.data[i + 3] = 255;
  }
  sctx.putImageData(oimg, 0, 0);
  const metalTex = new THREE.CanvasTexture(specCanvas);
  metalTex.colorSpace = THREE.NoColorSpace;
  metalTex.wrapS = THREE.RepeatWrapping;
  metalTex.wrapT = THREE.ClampToEdgeWrapping;
  metalTex.anisotropy = 4;
  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = w;
  heightCanvas.height = h;
  const hctx = heightCanvas.getContext("2d");
  if (["Jupiter", "Saturn", "Uranus", "Neptune"].includes(p.name)) {
    generateHeightmap(hctx, w, h, rng, { blobs: 40, base: 130, range: 25, soften: true });
  } else {
    generateHeightmap(hctx, w, h, rng, { blobs: 120, base: 120, range: 90, soften: true });
  }
  if (p.name === "Mars") {
    hctx.fillStyle = "rgba(180,180,180,0.9)";
    hctx.beginPath();
    hctx.ellipse(w * 0.15, h * 0.2, 70, 30, 0, 0, Math.PI * 2);
    hctx.fill();
  }
  if (p.name === "Mercury") {
    hctx.globalAlpha = 0.8;
    hctx.fillStyle = "rgba(200,200,200,0.9)";
    for (let i = 0; i < 12; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const rC = 10 + rng() * 50;
      hctx.beginPath();
      hctx.arc(x, y, rC, 0, Math.PI * 2);
      hctx.fill();
    }
    hctx.globalAlpha = 1;
  }
  normalMapFromHeight(heightCanvas);
  const normalTex = new THREE.CanvasTexture(heightCanvas);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.ClampToEdgeWrapping;
  normalTex.anisotropy = 4;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rctx = roughCanvas.getContext("2d");
  rctx.drawImage(heightCanvas, 0, 0);
  const rimg = rctx.getImageData(0, 0, w, h);
  for (let i = 0; i < rimg.data.length; i += 4) {
    const v = rimg.data[i] / 255;
    let rough = 1 - v;
    if (["Jupiter", "Saturn", "Uranus", "Neptune", "Venus"].includes(p.name)) rough = 0.35 + v * 0.2;
    if (p.name === "Earth") rough = 0.45 + v * 0.35;
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.round(rough * 255);
    rimg.data[i + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.colorSpace = THREE.NoColorSpace;
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.ClampToEdgeWrapping;
  roughTex.anisotropy = 4;

  return { map: tex, normalMap: normalTex, roughnessMap: roughTex, metalnessMap: metalTex };
}

function planetMaterial(p) {
  const { map, normalMap, roughnessMap, metalnessMap } = makePlanetMaps(p);
  const isGas = ["Jupiter", "Saturn", "Uranus", "Neptune"].includes(p.name);
  const roughness =
    p.name === "Venus" ? 0.55 : isGas ? 0.6 : p.name === "Mercury" ? 0.95 : 0.85;
  const normalScale = isGas ? 0.35 : p.name === "Earth" ? 0.6 : 0.75;
  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap,
    metalnessMap,
    roughness,
    metalness: p.name === "Earth" ? 0.12 : 0.06,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    emissive: p.name === "Earth" ? 0x0a2a4b : 0x050505,
    emissiveIntensity: p.name === "Earth" ? 0.25 : 0.0,
  });
}

function addAtmosphere(mesh, color, opacity = 0.35) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const geo = new THREE.SphereGeometry(mesh.geometry.parameters.radius * 1.04, 32, 32);
  const atm = new THREE.Mesh(geo, mat);
  atm.renderOrder = 1;
  mesh.add(atm);
  return atm;
}

function starfield(count = 5000, radius = 2400) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2 * Math.PI;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.9 + 0.1 * Math.random());
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    pos[i * 3 + 0] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.85 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function textSprite(text, { color = "rgba(255,255,255,0.85)", bg = "rgba(0,0,0,0.35)" } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const pad = 14;
  const font = "600 18px ui-sans-serif, system-ui, Segoe UI, Arial";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 42;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = bg;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(1, 1, w - 2, h - 2, 12);
  else ctx.rect(1, 1, w - 2, h - 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(canvas.width / 14, canvas.height / 14, 1);
  return spr;
}

export class AsteroidField {
  constructor(category, { size = 1.4, opacity = 0.9 } = {}) {
    this.category = category;
    this.object3d = null;
    this._pre = [];
    this._pos = null;
    this._geo = null;
    this._sizes = null;
    this._scale = 1;
    this._instanceDummy = new THREE.Object3D();
    this._pointsMat = new THREE.PointsMaterial({
      color: COLORS[category] ?? 0xffffff,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
    });
    this._sphereMat = new THREE.MeshStandardMaterial({
      color: COLORS[category] ?? 0xffffff,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    this._sphereGeo = new THREE.IcosahedronGeometry(0.6, 0);
    this._linesMat = new THREE.LineBasicMaterial({
      color: COLORS[category] ?? 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this._linesMat.toneMapped = false;
    this._linesPtsMat = new THREE.PointsMaterial({
      color: COLORS[category] ?? 0xffffff,
      size: Math.max(2.2, size + 1.2),
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this._linesPtsMat.toneMapped = false;
    this.visible = true;
    this.renderMode = "points"; // points|lines
    this.updateEvery = 1;
    this._frame = 0;
  }

  setObjects(objs) {
    const MIN_VISUAL = 0.06;
    const MAX_VISUAL = 0.28;
    const H_MIN = 12;
    const H_MAX = 26.5;
    const sizeFromH = (H) => {
      if (!Number.isFinite(H)) return null;
      const t = THREE.MathUtils.clamp((H_MAX - H) / (H_MAX - H_MIN), 0, 1);
      return MIN_VISUAL * Math.pow(MAX_VISUAL / MIN_VISUAL, t);
    };
    this._pre = objs.map((o) =>
      precompute({
        a: o.a,
        e: o.e,
        i: o.i,
        Omega: o.Omega,
        omega: o.omega,
        M0: o.M0,
        epochJD: 2440587.5 + Date.parse(o.epoch) / 86400000,
        spkid: o.spkid,
        name: o.name,
        category: o.category,
        epoch: o.epoch,
        H: o.H,
        q: o.q,
        Q: o.Q,
        period: o.period,
      })
    );
    this._sizes = objs.map((o, i) => {
      const size = sizeFromH(Number(o.H));
      if (size) return size;
      const seed = Number(o.spkid ?? i) * 2654435761;
      const rng = seededRandom(seed);
      const t = Math.pow(rng(), 1.6);
      return MIN_VISUAL * Math.pow(MAX_VISUAL / MIN_VISUAL, t);
    });
    this._rebuild();
  }

  setScale(scale) {
    const next = Number(scale);
    if (!Number.isFinite(next)) return;
    this._scale = THREE.MathUtils.clamp(next, 0.1, 1e6);
  }

  _rebuild() {
    const n = this._pre.length;
    if (this.renderMode === "lines") {
      this._pos = new Float32Array(n * 2 * 3);
      this._geo = new THREE.BufferGeometry();
      this._geo.setAttribute("position", new THREE.BufferAttribute(this._pos, 3));
      const lines = new THREE.LineSegments(this._geo, this._linesMat);
      const glow = new THREE.Points(this._geo, this._linesPtsMat);
      lines.renderOrder = 3;
      glow.renderOrder = 4;
      lines.frustumCulled = false;
      glow.frustumCulled = false;
      const group = new THREE.Group();
      group.add(lines, glow);
      this.object3d = group;
    } else {
      this._pos = new Float32Array(n * 3);
      this._geo = new THREE.BufferGeometry();
      this._geo.setAttribute("position", new THREE.BufferAttribute(this._pos, 3));
      const mesh = new THREE.InstancedMesh(this._sphereGeo, this._sphereMat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.object3d = mesh;
    }
    this._geo.computeBoundingSphere();
    this.object3d.frustumCulled = false;
    this.object3d.userData.category = this.category;
    this.object3d.visible = this.visible;
  }

  setRenderMode(mode) {
    const next = mode === "lines" ? "lines" : "points";
    if (this.renderMode === next) return;
    this.renderMode = next;
    if (this._pre.length) this._rebuild();
  }

  setVisible(v) {
    this.visible = v;
    if (this.object3d) this.object3d.visible = v;
  }

  update(tJD, { exaggeration = 1 } = {}) {
    if (!this.object3d || !this._pos || !this._geo) return;
    this._frame++;
    if (this.updateEvery > 1 && (this._frame % this.updateEvery) !== 0) return;
    const pos = this._pos;
    const pre = this._pre;
    const safe = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
    if (this.renderMode === "lines") {
      const trailDays = 6;
      for (let i = 0; i < pre.length; i++) {
        const v0 = positionAU(pre[i], tJD, exaggeration);
        const v1 = positionAU(pre[i], tJD + trailDays, exaggeration);
        if (!safe(v0) || !safe(v1)) {
          pos[i * 6 + 0] = 0;
          pos[i * 6 + 1] = 0;
          pos[i * 6 + 2] = 0;
          pos[i * 6 + 3] = 0;
          pos[i * 6 + 4] = 0;
          pos[i * 6 + 5] = 0;
          continue;
        }
        pos[i * 6 + 0] = v0.x * AU;
        pos[i * 6 + 1] = v0.y * AU;
        pos[i * 6 + 2] = v0.z * AU;
        pos[i * 6 + 3] = v1.x * AU;
        pos[i * 6 + 4] = v1.y * AU;
        pos[i * 6 + 5] = v1.z * AU;
      }
    } else {
      for (let i = 0; i < pre.length; i++) {
        const v = positionAU(pre[i], tJD, exaggeration);
        if (!safe(v)) {
          pos[i * 3 + 0] = 0;
          pos[i * 3 + 1] = 0;
          pos[i * 3 + 2] = 0;
          continue;
        }
        pos[i * 3 + 0] = v.x * AU;
        pos[i * 3 + 1] = v.y * AU;
        pos[i * 3 + 2] = v.z * AU;
        if (this.object3d && this.object3d.isInstancedMesh) {
          const s = (this._sizes?.[i] ?? 0.7) * this._scale;
          this._instanceDummy.position.set(pos[i * 3 + 0], pos[i * 3 + 1], pos[i * 3 + 2]);
          this._instanceDummy.scale.setScalar(s);
          this._instanceDummy.updateMatrix();
          this.object3d.setMatrixAt(i, this._instanceDummy.matrix);
        }
      }
      if (this.object3d && this.object3d.isInstancedMesh) {
        this.object3d.instanceMatrix.needsUpdate = true;
      }
    }
    this._geo.attributes.position.needsUpdate = true;
    if (this.object3d && this.object3d.isInstancedMesh) {
      const bs = this._geo.boundingSphere || { radius: 0, center: new THREE.Vector3() };
      if (!bs.radius || !Number.isFinite(bs.radius)) {
        this._geo.computeBoundingSphere();
      }
      const r = Math.max(1, this._geo.boundingSphere?.radius ?? 1);
      this.object3d.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), r);
    }
  }

  raycast(raycaster, intersects) {
    if (this.renderMode !== "points") return;
    if (!this.object3d || !this.object3d.visible) return;
    this.object3d.raycast(raycaster, intersects);
  }

  findNearestIndex(point) {
    if (!this._pos) return -1;
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < this._pre.length; i++) {
      const dx = this._pos[i * 3 + 0] - point.x;
      const dy = this._pos[i * 3 + 1] - point.y;
      const dz = this._pos[i * 3 + 2] - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
  }

  getObjectAtIndex(i) {
    return this._pre[i] ?? null;
  }
}

export class SceneApp {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const maxSize = Math.min(this.renderer.capabilities.maxRenderbufferSize || 8192, this.renderer.capabilities.maxTextureSize || 8192);
    const initW = Math.max(1, Math.min(canvas.clientWidth || 1, maxSize));
    const initH = Math.max(1, Math.min(canvas.clientHeight || 1, maxSize));
    this.renderer.setSize(initW, initH, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.00026);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 8000);
    this.camera.position.set(0, 120, 280);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enableZoom = false;
    this.controls.maxDistance = 2500;
    this.controls.minDistance = 25;
    this.controls.target.set(0, 0, 0);

    this._zoom = {
      active: false,
      target: this.controls.target.clone(),
      targetGoal: this.controls.target.clone(),
      distGoal: this.camera.position.distanceTo(this.controls.target),
    };
    this._zoomSmoothing = 14;
    this._zoomEpsDist = 0.2;
    this._zoomEpsTarget = 0.02;
    this._followBaseOffset = null;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.7, 0.2);
    this.composer.addPass(this.bloomPass);

    this.layers = {
      planets: new THREE.Group(),
      planetOrbits: new THREE.Group(),
      asteroids: new THREE.Group(),
      overlays: new THREE.Group(),
    };
    this.scene.add(this.layers.planetOrbits, this.layers.planets, this.layers.asteroids, this.layers.overlays);

    this.selected = null;
    this._selectedPre = null;
    this._lastTJD = 2460000.5;
    this.follow = false;
    this.followOffset = new THREE.Vector3(0, 30, 70);
    this._followBaseOffset = this.followOffset.clone();
    this.observer = "sun";
    this._planetScaleMode = "visual";
    this._planetScaleMul = 1;

    this.sunLight = null;

    this._initLighting();
    this._initBackground();
    this._initSunAndPlanets();

    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 10;
    this.pointer = new THREE.Vector2();

    this.fields = {
      mainbelt: new AsteroidField("mainbelt", { size: 1.3, opacity: 0.85 }),
      neo: new AsteroidField("neo", { size: 1.6, opacity: 0.95 }),
      trojan: new AsteroidField("trojan", { size: 1.4, opacity: 0.9 }),
      comet: new AsteroidField("comet", { size: 1.7, opacity: 0.95 }),
    };

    this.orbitLine = null;
    this._orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this._selectedMarker = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4ad0a3, emissiveIntensity: 0.6 })
    );
    this._selectedMarker.visible = false;
    this.layers.overlays.add(this._selectedMarker);

    this._scratch = new THREE.Vector3();
    this._planetByName = new Map();
    for (const p of this.layers.planets.children) {
      if (p.userData?.type === "planet") this._planetByName.set(p.userData.name, p);
    }
  }

  _initLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06));
    const key = new THREE.DirectionalLight(0xffffff, 0.35);
    key.position.set(0.2, 0.6, 0.2);
    this.scene.add(key);
  }

  _initBackground() {
    this.scene.add(starfield(7000, 2600));
  }

  _initSunAndPlanets() {
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(7, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0xffd27d, emissive: 0xffb44a, emissiveIntensity: 1.1 })
    );
    sun.name = "Sun";
    sun.userData = {
      type: "sun",
      baseRadius: 7,
      realRadius: (SUN_RADIUS_KM / AU_KM) * AU,
    };
    this.layers.planets.add(sun);

    const sunLight = new THREE.PointLight(0xffffff, 4.5, 0, 2);
    sunLight.position.set(0, 0, 0);
    this.layers.planets.add(sunLight);
    this.sunLight = sunLight;

    for (const p of PLANETS) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius, 32, 32),
        planetMaterial(p)
      );
      mesh.userData = {
        type: "planet",
        name: p.name,
        aAU: p.a,
        radiusLabel: `${p.a.toFixed(2)} AU`,
        baseRadius: p.radius,
        realRadius: p.radiusKm ? (p.radiusKm / AU_KM) * AU : p.radius,
      };
      mesh.userData.spin = p.spin ?? 0.2;
      mesh.userData.tilt = p.tilt ?? 0;
      mesh.rotation.z = mesh.userData.tilt;
      mesh.position.set(p.a * AU, 0, 0);
      if (p.name === "Saturn") {
        const ringGeo = new THREE.RingGeometry(p.radius * 1.35, p.radius * 2.35, 160);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xd9c8a5,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0.1,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.rotation.z = 0.42;
        ring.renderOrder = 2;
        mesh.add(ring);
      }
      if (p.name === "Earth") {
        const cloudCanvas = document.createElement("canvas");
        cloudCanvas.width = 512;
        cloudCanvas.height = 256;
        const cctx = cloudCanvas.getContext("2d");
        const rng = seededRandom(1337);
        cctx.fillStyle = "rgba(0,0,0,0)";
        cctx.fillRect(0, 0, cloudCanvas.width, cloudCanvas.height);
        cctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 80; i++) {
          const x = rng() * cloudCanvas.width;
          const y = rng() * cloudCanvas.height;
          const r = 14 + rng() * 80;
          cctx.beginPath();
          cctx.ellipse(x, y, r, r * (0.4 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
          cctx.fill();
        }
        cctx.globalAlpha = 0.6;
        cctx.filter = "blur(6px)";
        cctx.drawImage(cloudCanvas, 0, 0);
        cctx.filter = "none";
        cctx.globalAlpha = 1;

        const cloudTex = new THREE.CanvasTexture(cloudCanvas);
        cloudTex.colorSpace = THREE.SRGBColorSpace;
        cloudTex.wrapS = THREE.RepeatWrapping;
        cloudTex.wrapT = THREE.ClampToEdgeWrapping;
        const cloudMat = new THREE.MeshStandardMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          roughness: 0.9,
          metalness: 0.0,
        });
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.02, 32, 32), cloudMat);
        clouds.rotation.y = 0.2;
        clouds.userData.spin = 0.55;
        mesh.add(clouds);
        addAtmosphere(mesh, 0x6bb5ff, 0.28);
      }
      if (p.name === "Venus") {
        const cloudCanvas = document.createElement("canvas");
        cloudCanvas.width = 512;
        cloudCanvas.height = 256;
        const cctx = cloudCanvas.getContext("2d");
        const rng = seededRandom(2211);
        cctx.fillStyle = "rgba(0,0,0,0)";
        cctx.fillRect(0, 0, cloudCanvas.width, cloudCanvas.height);
        cctx.fillStyle = "rgba(245,230,200,0.85)";
        for (let i = 0; i < 90; i++) {
          const x = rng() * cloudCanvas.width;
          const y = rng() * cloudCanvas.height;
          const r = 18 + rng() * 90;
          cctx.beginPath();
          cctx.ellipse(x, y, r, r * (0.5 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
          cctx.fill();
        }
        cctx.globalAlpha = 0.7;
        cctx.filter = "blur(8px)";
        cctx.drawImage(cloudCanvas, 0, 0);
        cctx.filter = "none";
        cctx.globalAlpha = 1;
        const cloudTex = new THREE.CanvasTexture(cloudCanvas);
        cloudTex.colorSpace = THREE.SRGBColorSpace;
        cloudTex.wrapS = THREE.RepeatWrapping;
        cloudTex.wrapT = THREE.ClampToEdgeWrapping;
        const cloudMat = new THREE.MeshStandardMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          roughness: 0.6,
          metalness: 0.0,
        });
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.015, 32, 32), cloudMat);
        clouds.userData.spin = 0.25;
        mesh.add(clouds);
        addAtmosphere(mesh, 0xe8d2a2, 0.25);
      }
      if (p.name === "Jupiter") {
        const cloudCanvas = document.createElement("canvas");
        cloudCanvas.width = 1024;
        cloudCanvas.height = 512;
        const cctx = cloudCanvas.getContext("2d");
        const rng = seededRandom(7711);
        cctx.fillStyle = "rgba(0,0,0,0)";
        cctx.fillRect(0, 0, cloudCanvas.width, cloudCanvas.height);
        const bands = 14;
        for (let i = 0; i < bands; i++) {
          const y = (i / bands) * cloudCanvas.height;
          const h = cloudCanvas.height / bands;
          const v = 210 + rng() * 20;
          cctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.25})`;
          cctx.fillRect(0, y, cloudCanvas.width, h * (0.7 + rng() * 0.6));
        }
        cctx.globalAlpha = 0.6;
        cctx.filter = "blur(6px)";
        cctx.drawImage(cloudCanvas, 0, 0);
        cctx.filter = "none";
        cctx.globalAlpha = 1;
        const cloudTex = new THREE.CanvasTexture(cloudCanvas);
        cloudTex.colorSpace = THREE.SRGBColorSpace;
        cloudTex.wrapS = THREE.RepeatWrapping;
        cloudTex.wrapT = THREE.ClampToEdgeWrapping;
        const cloudMat = new THREE.MeshStandardMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          roughness: 0.7,
          metalness: 0.0,
        });
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.01, 32, 32), cloudMat);
        clouds.userData.spin = 0.75;
        mesh.add(clouds);
        addAtmosphere(mesh, 0xf0d6b2, 0.18);
      }
      if (["Saturn", "Uranus", "Neptune"].includes(p.name)) {
        addAtmosphere(mesh, 0xbfd8ff, p.name === "Saturn" ? 0.18 : 0.22);
      }
      this.layers.planets.add(mesh);

      const ringGeo = new THREE.RingGeometry(p.a * AU - 0.35, p.a * AU + 0.35, 256);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x5a6a89, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.userData = { type: "planetOrbit", name: p.name };
      this.layers.planetOrbits.add(ring);

      const label = textSprite(`${p.name} • ${p.a.toFixed(2)} AU`);
      label.position.set(p.a * AU, 0, 0);
      label.visible = false;
      this.layers.overlays.add(label);
      mesh.userData.label = label;
      ring.userData.label = label;
    }

  }

  _applyPlanetScale() {
    const useReal = this._planetScaleMode === "real";
    for (const obj of this.layers.planets.children) {
      if (obj.userData?.type === "planet") {
        const base = obj.userData.baseRadius || 1;
        const target = useReal ? obj.userData.realRadius : base * this._planetScaleMul;
        const scale = base > 0 ? target / base : 1;
        obj.scale.setScalar(scale);
      }
      if (obj.userData?.type === "sun") {
        const base = obj.userData.baseRadius || 1;
        const target = useReal ? obj.userData.realRadius : base * this._planetScaleMul;
        const scale = base > 0 ? target / base : 1;
        obj.scale.setScalar(scale);
      }
    }
  }

  setPlanetScaleMode(mode) {
    this._planetScaleMode = mode === "real" ? "real" : "visual";
    this._applyPlanetScale();
  }

  setPlanetScaleMultiplier(mult) {
    const next = Number(mult);
    if (!Number.isFinite(next)) return;
    this._planetScaleMul = THREE.MathUtils.clamp(next, 0.5, 3);
    if (this._planetScaleMode === "visual") this._applyPlanetScale();
  }


  setLayerVisible(key, v) {
    if (key === "planets") this.layers.planets.visible = v;
    if (key === "planetOrbits") this.layers.planetOrbits.visible = v;
    if (this.fields[key]) this.fields[key].setVisible(v);
  }

  setAsteroids(objs) {
    const byCat = { mainbelt: [], neo: [], trojan: [], comet: [] };
    for (const o of objs) {
      if (byCat[o.category]) byCat[o.category].push(o);
    }
    for (const k of Object.keys(byCat)) {
      const field = this.fields[k];
      if (!field) continue;
      if (field.object3d) this.layers.asteroids.remove(field.object3d);
      field.setObjects(byCat[k]);
      this.layers.asteroids.add(field.object3d);
    }
  }

  setAsteroidRenderMode(mode) {
    for (const f of Object.values(this.fields)) {
      const old = f.object3d;
      f.setRenderMode(mode);
      if (old && old !== f.object3d) {
        this.layers.asteroids.remove(old);
        if (f.object3d) this.layers.asteroids.add(f.object3d);
      }
    }
  }

  setAsteroidScale(scale) {
    for (const f of Object.values(this.fields)) f.setScale(scale);
  }


  setOrbitFromElements(elements, { color = 0xffffff, opacity = 0.9 } = {}) {
    this.clearOrbit();
    const pre = precompute(elements);
    const pts = orbitPolyline(pre, 360)
      .map((v) => v.multiplyScalar(AU))
      .filter(isFiniteVec3);
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    this.orbitLine = new THREE.Line(geo, mat);
    this.orbitLine.userData = { type: "orbitLine", name: elements?.name };
    this.layers.overlays.add(this.orbitLine);
  }

  setOrbitFromEphemeris(points, { color = 0xffffff, opacity = 0.9 } = {}) {
    this.clearOrbit();
    const pts = points
      .map((p) => new THREE.Vector3(p.x * AU, p.y * AU, p.z * AU))
      .filter(isFiniteVec3);
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    this.orbitLine = new THREE.Line(geo, mat);
    this.orbitLine.userData = { type: "orbitLine", name: this.selected?.name };
    this.layers.overlays.add(this.orbitLine);
  }

  clearOrbit() {
    if (this.orbitLine) this.layers.overlays.remove(this.orbitLine);
    this.orbitLine = null;
  }

  setSelectedObject(obj, worldPos) {
    this.selected = obj;
    if (obj) {
      if (typeof obj.n === "number" && typeof obj.cO === "number") {
        this._selectedPre = obj;
      } else if (obj.a && obj.e !== undefined) {
        this._selectedPre = precompute({
          a: obj.a,
          e: obj.e,
          i: obj.i ?? 0,
          Omega: obj.Omega ?? 0,
          omega: obj.omega ?? 0,
          M0: obj.M0 ?? 0,
          epochJD: 2440587.5 + Date.parse(obj.epoch) / 86400000,
          spkid: obj.spkid,
          name: obj.name,
          category: obj.category,
          epoch: obj.epoch,
          H: obj.H,
          q: obj.q,
          Q: obj.Q,
          period: obj.period,
        });
      } else {
        this._selectedPre = null;
      }
      this._selectedMarker.visible = true;
      if (worldPos) this._selectedMarker.position.copy(worldPos);
    } else {
      this._selectedPre = null;
      this._selectedMarker.visible = false;
    }
  }

  _zoomAlpha(dt) {
    const t = Math.max(0, dt ?? 0);
    return 1 - Math.exp(-this._zoomSmoothing * t);
  }

  _setZoomGoal({ target, dist, immediate = false } = {}) {
    if (target) this._zoom.targetGoal.copy(target);
    if (Number.isFinite(dist)) this._zoom.distGoal = dist;
    if (immediate) {
      this._zoom.target.copy(this._zoom.targetGoal);
      this.controls.target.copy(this._zoom.target);
      const curOffset = this.camera.position.clone().sub(this.controls.target);
      const dir = curOffset.lengthSq() > 1e-12 ? curOffset.normalize() : new THREE.Vector3(0, 0, 1);
      this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(this._zoom.distGoal));
      this.controls.update();
    }
    this._zoom.active = true;
  }

  _applyZoomSmoothing(dt) {
    if (!this._zoom.active) {
      this._zoom.target.copy(this.controls.target);
      this._zoom.targetGoal.copy(this.controls.target);
      this._zoom.distGoal = this.camera.position.distanceTo(this.controls.target);
      return;
    }

    const alpha = this._zoomAlpha(dt);
    if (this.follow && this._selectedMarker?.visible) {
      this._zoom.target.lerp(this._zoom.targetGoal, alpha);
      this.controls.target.copy(this._zoom.target);
      this._zoom.distGoal = this.followOffset.length();
      return;
    }

    const prevTarget = this.controls.target.clone();
    const prevOffset = this.camera.position.clone().sub(prevTarget);
    const dir = prevOffset.lengthSq() > 1e-12 ? prevOffset.normalize() : new THREE.Vector3(0, 0, 1);
    const curDist = this.camera.position.distanceTo(prevTarget);
    const nextDist = THREE.MathUtils.lerp(curDist, this._zoom.distGoal, alpha);

    this._zoom.target.lerp(this._zoom.targetGoal, alpha);
    this.controls.target.copy(this._zoom.target);

    this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(nextDist));

    const doneDist = Math.abs(this._zoom.distGoal - nextDist) < this._zoomEpsDist;
    const doneTarget = this._zoom.target.distanceTo(this._zoom.targetGoal) < this._zoomEpsTarget;
    if (doneDist && doneTarget) {
      this._zoom.active = false;
      this._zoom.target.copy(this.controls.target);
      this._zoom.targetGoal.copy(this.controls.target);
      this._zoom.distGoal = this.camera.position.distanceTo(this.controls.target);
    }
  }

  onWheelZoom(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (e.ctrlKey) return;

    const deltaModeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
    const dy = e.deltaY * deltaModeScale;
    if (!Number.isFinite(dy) || dy === 0) return;

    const minD = this.controls.minDistance ?? 10;
    const maxD = this.controls.maxDistance ?? 2500;
    const curGoal = this._zoom.active ? this._zoom.distGoal : this.camera.position.distanceTo(this.controls.target);

    const maxAbsDy = 600;
    const capped = Math.sign(dy) * Math.min(Math.abs(dy), maxAbsDy);
    const zoomStrength = 0.00125;
    const factor = Math.exp(capped * zoomStrength);
    const nextGoal = THREE.MathUtils.clamp(curGoal * factor, minD, maxD);
  
    if (this.follow && this._selectedMarker?.visible) {
      const baseLen = this._followBaseOffset.length() || 1;
      const nextScale = nextGoal / baseLen;
      this.followOffset.copy(this._followBaseOffset).multiplyScalar(nextScale);
      this._setZoomGoal({ dist: nextGoal });
      return;
    }

    const cx = e.clientX;
    const cy = e.clientY;
    this.pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((cy - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const hasHit = this.raycaster.ray.intersectPlane(plane, hit);

    const target = hasHit ? hit : null;
    this._setZoomGoal({ target, dist: nextGoal });
  }

  onWheelPan(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (e.ctrlKey) return;
    if (this.follow) return;

    const deltaModeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
    const rawDx = (e.deltaX || 0) + (e.shiftKey ? e.deltaY || 0 : 0);
    const dx = rawDx * deltaModeScale;
    if (!Number.isFinite(dx) || dx === 0) return;

    const maxAbsDx = 800;
    const capped = Math.sign(dx) * Math.min(Math.abs(dx), maxAbsDx);

    const offset = this.camera.position.clone().sub(this.controls.target);
    const targetDistance = offset.length() * Math.tan((this.camera.fov * Math.PI) / 360);
    const panLeftAmount = (2 * capped * targetDistance) / rect.height;

    const pan = new THREE.Vector3();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    pan.copy(right).multiplyScalar(-panLeftAmount);

    this.controls.target.add(pan);
    this.camera.position.add(pan);
    this._zoom.target.add(pan);
    this._zoom.targetGoal.add(pan);
    this.controls.update();
  }

  setObserver(kind, { planetName } = {}) {
    this.observer = kind;
    this.follow = kind === "follow";
    if (kind === "sun") {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 120, 280);
      this._zoom.active = false;
      this._zoom.target.copy(this.controls.target);
      this._zoom.targetGoal.copy(this.controls.target);
      this._zoom.distGoal = this.camera.position.distanceTo(this.controls.target);
      this.controls.update();
      return;
    }
    if (kind === "earth") planetName = "Earth";
    if (kind === "planet" && planetName) {
      const planet = this._planetByName.get(planetName);
      if (planet) {
        this.controls.target.copy(planet.position);
        this.camera.position.copy(planet.position).add(new THREE.Vector3(0, 22, 55));
        this._zoom.active = false;
        this._zoom.target.copy(this.controls.target);
        this._zoom.targetGoal.copy(this.controls.target);
        this._zoom.distGoal = this.camera.position.distanceTo(this.controls.target);
        this.controls.update();
      }
      return;
    }
    if (kind === "free") {
      this.follow = false;
      this._zoom.active = false;
      this._zoom.target.copy(this.controls.target);
      this._zoom.targetGoal.copy(this.controls.target);
      this._zoom.distGoal = this.camera.position.distanceTo(this.controls.target);
      return;
    }
  }

  onPointer(event, { onSelect } = {}) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = [];
    for (const f of Object.values(this.fields)) f.raycast(this.raycaster, hits);
    hits.sort((a, b) => a.distance - b.distance);
    const h = hits[0];
    if (!h) return;
    const field = h.object;
    const idx = h.instanceId ?? h.index;
    const cat = field.userData.category;
    const obj = this.fields[cat]?.getObjectAtIndex(idx);
    if (!obj) return;
    this.setSelectedObject(obj, h.point);
    onSelect?.(obj);
  }

  hoverAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    this.clearHover();

    const targets = [];
    for (const o of this.layers.planets.children) if (o.userData?.type === "planet") targets.push(o);
    for (const o of this.layers.planetOrbits.children) targets.push(o);
    if (this.orbitLine) targets.push(this.orbitLine);

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length) {
      const obj = hits[0].object;
      if (obj.userData?.label) obj.userData.label.visible = true;
      if (obj.userData?.type === "planet") return { kind: "planet", name: obj.userData.name, extra: obj.userData.radiusLabel };
      if (obj.userData?.type === "planetOrbit") return { kind: "planetOrbit", name: obj.userData.name };
      if (obj.userData?.type === "orbitLine") return { kind: "orbitLine", name: obj.userData.name || "Orbit" };
    }

    const asteroidHits = [];
    for (const f of Object.values(this.fields)) f.raycast(this.raycaster, asteroidHits);
    asteroidHits.sort((a, b) => a.distance - b.distance);
    const h = asteroidHits[0];
    if (!h) return null;
    const cat = h.object.userData.category;
    const idx = h.instanceId ?? h.index;
    const aObj = this.fields[cat]?.getObjectAtIndex(idx);
    if (!aObj) return null;
    return { kind: "asteroid", name: aObj.name, extra: aObj.category };
  }

  clearHover() {
    for (const o of this.layers.planets.children) if (o.userData?.label) o.userData.label.visible = false;
    for (const o of this.layers.planetOrbits.children) if (o.userData?.label) o.userData.label.visible = false;
  }

  zoomToScreenRect({ x0, y0, x1, y1 }) {
    const rect = this.canvas.getBoundingClientRect();
    const left = Math.max(rect.left, Math.min(x0, x1));
    const right = Math.min(rect.right, Math.max(x0, x1));
    const top = Math.max(rect.top, Math.min(y0, y1));
    const bottom = Math.min(rect.bottom, Math.max(y0, y1));
    const w = right - left;
    const h = bottom - top;
    if (w < 12 || h < 12) return;

    const cx = left + w / 2;
    const cy = top + h / 2;
    this.pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((cy - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const hasHit = this.raycaster.ray.intersectPlane(plane, hit);
    const nextTarget = hasHit ? hit : null;

    const frac = Math.max(w / rect.width, h / rect.height);
    const desiredFill = 0.72;
    const curDist = this.camera.position.distanceTo(this.controls.target);
    const minD = this.controls.minDistance ?? 10;
    const maxD = this.controls.maxDistance ?? 2500;
    const newDist = THREE.MathUtils.clamp(curDist * (frac / desiredFill), minD, maxD);
    this._setZoomGoal({ target: nextTarget, dist: newDist });
  }

  update(tJD, { exaggeration = 1, dt = 0.016 } = {}) {
    this._lastTJD = tJD;
    for (const f of Object.values(this.fields)) f.update(tJD, { exaggeration });
    if (this._selectedPre) {
      const v = positionAU(this._selectedPre, tJD, exaggeration).multiplyScalar(AU);
      this._selectedMarker.position.copy(v);
      this._selectedMarker.visible = true;
    }

    if (this.follow && this._selectedMarker.visible) {
      this._setZoomGoal({ target: this._selectedMarker.position });
      this._applyZoomSmoothing(dt);
      const alpha = this._zoomAlpha(dt);
      const desired = this._scratch.copy(this.controls.target).add(this.followOffset);
      this.camera.position.lerp(desired, alpha);
    } else {
      this._applyZoomSmoothing(dt);
    }

    for (const p of this.layers.planets.children) {
      if (p.userData?.type !== "planet") continue;
      const aAU = p.userData.aAU;
      const ang = (tJD - 2460000.5) / 365.25 * (1 / Math.pow(aAU, 1.5));
      p.position.set(Math.cos(ang) * aAU * AU, 0, Math.sin(ang) * aAU * AU);
      if (p.userData.spin) p.rotation.y += dt * p.userData.spin;
      for (const child of p.children) {
        if (child.userData?.spin) child.rotation.y += dt * child.userData.spin;
      }
    }
  }

  render() {
    this.controls.update();
    this.composer.render();
  }

  resize() {
    const maxSize = Math.min(this.renderer.capabilities.maxRenderbufferSize || 8192, this.renderer.capabilities.maxTextureSize || 8192);
    const w = Math.max(1, Math.min(this.canvas.clientWidth || 1, maxSize));
    const h = Math.max(1, Math.min(this.canvas.clientHeight || 1, maxSize));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  }

  focusSelected({ immediate = false } = {}) {
    if (!this._selectedMarker?.visible) return false;
    const dist = this._zoom.active ? this._zoom.distGoal : this.camera.position.distanceTo(this.controls.target);
    this._setZoomGoal({ target: this._selectedMarker.position, dist, immediate });
    return true;
  }
}
