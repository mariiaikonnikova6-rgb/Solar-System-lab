import { getLangFromUrl, I18N, t } from "./i18n.js";
import { jdNow } from "./orbitMath.js";
import { SceneApp } from "./scene.js";
import { applyI18n, renderHud, setActiveButton } from "./ui.js";
import { ExploreMode } from "./modes/explore.js";
import { RandomMode } from "./modes/random.js";
import { CompareMode } from "./modes/compare.js";
import { SearchMode } from "./modes/search.js";
import { KeplerMode } from "./modes/kepler.js";

const TIME_SCALES = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];

class AppState {
  constructor() {
    this.lang = getLangFromUrl();
    this.mode = new URLSearchParams(location.search).get("mode") || "explore";
    this.asteroidCount = 5000;

    this.layers = {
      planetOrbits: true,
      planets: true,
      mainbelt: true,
      neo: true,
      trojan: false,
      comet: false,
    };
    this.playing = false;
    this.scaleIdx = Number(new URLSearchParams(location.search).get("timeScaleIdx") || 2);
    this.scaleIdx = Math.max(0, Math.min(TIME_SCALES.length - 1, this.scaleIdx));
    this.scrubDays = Number(new URLSearchParams(location.search).get("scrub") || 0);
    const params = new URLSearchParams(location.search);
    this.asteroidScale = params.has("asteroidScale") ? Number(params.get("asteroidScale")) : 2.5;
    this.scaleMode = new URLSearchParams(location.search).get("scaleMode") || "visual";
    this.planetScale = Number(new URLSearchParams(location.search).get("planetScale") || 1);
  }

  layersString() {
    const on = [];
    if (this.layers.mainbelt) on.push("mainbelt");
    if (this.layers.neo) on.push("neo");
    if (this.layers.trojan) on.push("trojan");
    if (this.layers.comet) on.push("comet");
    return on.join(",");
  }
}

const state = new AppState();
const canvas = document.getElementById("c");
const hud = document.getElementById("hud");
const tooltip = document.getElementById("tooltip");
const modePanel = document.getElementById("mode-panel");
const app = new SceneApp(canvas);
const sampleNoteEl = document.getElementById("sample-note");

let selectedHudObject = null;
const setHudObject = (obj) => {
  selectedHudObject = obj;
  renderHud(hud, state.lang, obj);
};

function setSampleNote() {
  if (!sampleNoteEl) return;
  sampleNoteEl.textContent = t(state.lang, "sampleNote");
}

function setSampleStats() {
  setSampleNote();
}

function setSamplePlaceholder() {
  setSampleNote();
}
const modes = {
  explore: new ExploreMode(app, state, { setSampleStats }),
  random: new RandomMode(app, state, { setHudObject }),
  compare: new CompareMode(app, state, { setHudObject }),
  search: new SearchMode(app, state, { setHudObject }),
  kepler: new KeplerMode(app, state, { setHudObject }),
};
let currentMode = null;

function i18n() {
  return I18N[state.lang];
}

function setLang(lang) {
  state.lang = lang;
  const p = new URLSearchParams(location.search);
  p.set("lang", lang);
  history.replaceState({}, "", `${location.pathname}?${p.toString()}`);
  applyI18n(lang);
  setActiveButton(document.querySelector(".lang-toggle"), (el) => el.id === `lang-${state.lang}`);
  setHudObject(selectedHudObject);
  setSampleNote();
  if (currentMode?.enter) switchMode(state.mode);
}

async function switchMode(mode) {
  state.mode = mode;
  setActiveButton(document.querySelector(".tabs"), (el) => el.dataset.mode === mode);
  currentMode?.exit?.();
  currentMode = modes[mode] || modes.explore;
  const p = new URLSearchParams(location.search);
  p.set("mode", mode);
  history.replaceState({}, "", `${location.pathname}?${p.toString()}`);

  if (mode === "explore") {
    modePanel.innerHTML = `<div class="panel__title">${i18n().modePanels.explore}</div><div class="hint">${i18n().modePanels.exploreHint}</div>`;
    await currentMode.enter();
  } else {
    await currentMode.enter(modePanel, i18n());
  }
}

function updateTimeUI() {
  const scale = TIME_SCALES[state.scaleIdx];
  const label = scale === 1 ? "1" : scale.toExponential(0).replace("+", "");
  const speed = `×${label}`;
  document.getElementById("time-scale-label").textContent = speed;
  const speedValue = document.getElementById("time-speed-value");
  if (speedValue) speedValue.textContent = speed;
  const offsetValue = document.getElementById("time-offset-value");
  if (offsetValue) offsetValue.textContent = `${state.scrubDays >= 0 ? "+" : ""}${state.scrubDays}d`;
  document.getElementById("time-toggle").textContent = state.playing ? t(state.lang, "pause") : t(state.lang, "play");
}

function applyLayersToScene() {
  app.setLayerVisible("planetOrbits", state.layers.planetOrbits);
  app.setLayerVisible("planets", state.layers.planets);
  app.setLayerVisible("mainbelt", state.layers.mainbelt);
  app.setLayerVisible("neo", state.layers.neo);
  app.setLayerVisible("trojan", state.layers.trojan);
  app.setLayerVisible("comet", state.layers.comet);
}

function applyPerformance() {
  const updateEvery = state.asteroidCount >= 20000 ? 3 : state.asteroidCount >= 5000 ? 2 : 1;
  for (const f of Object.values(app.fields)) f.updateEvery = updateEvery;
}


function initUI() {
  applyI18n(state.lang);
  setSamplePlaceholder();
  initSidebarToggle();
  document.getElementById("lang-ua").addEventListener("click", () => setLang("ua"));
  document.getElementById("lang-en").addEventListener("click", () => setLang("en"));
  setActiveButton(document.querySelector(".lang-toggle"), (el) => el.id === `lang-${state.lang}`);

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  }

  document.getElementById("obs-sun").addEventListener("click", () => app.setObserver("sun"));
  document.getElementById("obs-earth").addEventListener("click", () => app.setObserver("planet", { planetName: "Earth" }));
  document.getElementById("obs-follow").addEventListener("click", () => app.setObserver("follow"));
  document.getElementById("obs-free").addEventListener("click", () => app.setObserver("free"));
  document.getElementById("obs-planet").addEventListener("change", (e) => {
    const name = e.target.value;
    if (!name) return;
    app.setObserver("planet", { planetName: name });
  });

  document.getElementById("time-toggle").addEventListener("click", () => {
    state.playing = !state.playing;
    updateTimeUI();
  });
  document.getElementById("time-scale").value = String(state.scaleIdx);
  document.getElementById("time-scale").addEventListener("input", (e) => {
    state.scaleIdx = Number(e.target.value);
    updateTimeUI();
  });
  document.getElementById("time-scrub").value = String(state.scrubDays);
  document.getElementById("time-scrub").addEventListener("input", (e) => {
    state.scrubDays = Number(e.target.value);
    updateTimeUI();
  });
  updateTimeUI();

  const asteroidScale = document.getElementById("asteroid-scale");
  const asteroidScaleValue = document.getElementById("asteroid-scale-value");
  if (asteroidScale && asteroidScaleValue) {
    const ASTEROID_SCALE_MIN = 0.4;
    const ASTEROID_SCALE_MAX = 10;
    const sliderToScale = (raw) => {
      const t = Math.max(0, Math.min(100, Number(raw))) / 100;
      return ASTEROID_SCALE_MIN * Math.pow(ASTEROID_SCALE_MAX / ASTEROID_SCALE_MIN, t);
    };
    const scaleToSlider = (scale) => {
      const s = Math.max(ASTEROID_SCALE_MIN, Math.min(ASTEROID_SCALE_MAX, Number(scale)));
      const t = Math.log(s / ASTEROID_SCALE_MIN) / Math.log(ASTEROID_SCALE_MAX / ASTEROID_SCALE_MIN);
      return Math.round(t * 100);
    };
    const applyScale = (raw) => {
      const next = sliderToScale(raw);
      if (!Number.isFinite(next)) return;
      state.asteroidScale = next;
      asteroidScaleValue.textContent = `${next.toFixed(2)}×`;
      asteroidScale.value = String(scaleToSlider(next));
      app.setAsteroidScale?.(next);
    };
    asteroidScale.value = String(scaleToSlider(state.asteroidScale));
    asteroidScale.addEventListener("input", () => applyScale(asteroidScale.value));
    applyScale(asteroidScale.value);

    const scaleToggle = document.getElementById("scale-mode-toggle");
    if (scaleToggle) {
      const applyMode = (mode) => {
        state.scaleMode = mode === "real" ? "real" : "visual";
        setActiveButton(scaleToggle, (el) => el.dataset.scale === state.scaleMode);
        app.setPlanetScaleMode?.(state.scaleMode);
        const lockReal = state.scaleMode === "real";
        asteroidScale.disabled = lockReal;
        if (lockReal) applyScale(0);
        if (lockReal) {
          state.planetScale = 1;
          app.setPlanetScaleMultiplier?.(1);
        } else {
          app.setPlanetScaleMultiplier?.(state.planetScale);
          if (state.asteroidScale < ASTEROID_SCALE_MIN || state.asteroidScale > ASTEROID_SCALE_MAX) {
            applyScale(70);
          }
        }
      };
      for (const btn of scaleToggle.querySelectorAll("button")) {
        btn.addEventListener("click", () => applyMode(btn.dataset.scale));
      }
      applyMode(state.scaleMode);

      const comfortBtn = document.getElementById("scale-comfort");
      if (comfortBtn) {
        comfortBtn.addEventListener("click", () => {
          applyMode("visual");
          state.planetScale = 1.6;
          app.setPlanetScaleMultiplier?.(state.planetScale);
          applyScale(85);
        });
      }
    }
  }

  const layers = [
    ["layer-planet-orbits", "planetOrbits"],
    ["layer-planets", "planets"],
    ["layer-mainbelt", "mainbelt"],
    ["layer-neo", "neo"],
    ["layer-trojans", "trojan"],
    ["layer-comets", "comet"],
  ];
  for (const [id, key] of layers) {
    const el = document.getElementById(id);
    el.checked = !!state.layers[key];
    el.addEventListener("change", () => {
      state.layers[key] = el.checked;
      applyLayersToScene();
      if (state.mode === "explore") modes.explore.reload();
    });
  }

  document.getElementById("share-link").addEventListener("click", async () => {
    const p = new URLSearchParams(location.search);
    p.set("mode", state.mode);
    p.set("lang", state.lang);
    p.set("timeScaleIdx", String(state.scaleIdx));
    p.set("scrub", String(state.scrubDays));
    p.set("asteroidScale", String(state.asteroidScale));
    p.set("scaleMode", state.scaleMode);
    p.set("planetScale", String(state.planetScale));
    const url = `${location.origin}${location.pathname}?${p.toString()}`;
    const out = document.getElementById("share-status");
    try {
      await navigator.clipboard.writeText(url);
      out.textContent = t(state.lang, "shareCopied");
    } catch {
      out.textContent = t(state.lang, "shareFailed");
    }
    setTimeout(() => (out.textContent = ""), 1200);
  });

}

function initSidebarToggle() {
  const layoutEl = document.getElementById("app");
  const toggleEl = document.getElementById("sidebar-toggle");
  if (!layoutEl || !toggleEl) return;

  const LS_KEY = "sidebarCollapsed";

  const apply = (collapsed) => {
    layoutEl.classList.toggle("is-sidebar-collapsed", collapsed);
    toggleEl.textContent = collapsed ? "⟩" : "⟨";
    const label = collapsed ? t(state.lang, "sidebarToggle.show") : t(state.lang, "sidebarToggle.hide");
    toggleEl.setAttribute("aria-label", label);
    toggleEl.title = label;
    app.resize();
  };

  try {
    apply(localStorage.getItem(LS_KEY) === "1");
  } catch {
    apply(false);
  }

  toggleEl.addEventListener("click", () => {
    const collapsed = !layoutEl.classList.contains("is-sidebar-collapsed");
    try {
      localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
    } catch {}
    apply(collapsed);
  });
}

async function init() {
  const landing = document.getElementById("landing");
  const enterBtn = document.getElementById("enter-scene");
  if (landing && enterBtn) {
    const exitLanding = () => {
      landing.classList.add("landing--hidden");
      document.body.classList.remove("landing-active");
      setTimeout(() => landing.remove(), 400);
    };
    enterBtn.addEventListener("click", exitLanding);
  }

  initUI();
  applyLayersToScene();
  applyPerformance();
  app.setAsteroidRenderMode("points");

  canvas.addEventListener("pointerdown", (e) => {
    if (e.shiftKey) return;
    app.onPointer(e, {
      onSelect: (obj) => {
        setHudObject(obj);
        if (state.mode === "explore") app.setObserver("follow");
      },
    });
  });

  canvas.addEventListener("pointermove", (e) => {
    if (boxZoom.active) return;
    const h = app.hoverAt(e.clientX, e.clientY);
    if (!h) {
      tooltip.hidden = true;
      return;
    }
    const extra = h.extra ? ` • ${h.extra}` : "";
    tooltip.textContent = `${h.name}${extra}`;
    const stageRect = canvas.getBoundingClientRect();
    tooltip.style.left = `${e.clientX - stageRect.left}px`;
    tooltip.style.top = `${e.clientY - stageRect.top}px`;
    tooltip.hidden = false;
  });
  canvas.addEventListener("pointerleave", () => {
    tooltip.hidden = true;
    app.clearHover();
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (boxZoom.active) return;
      e.preventDefault();
      const absX = Math.abs(e.deltaX || 0);
      const absY = Math.abs(e.deltaY || 0);
      const wantsHorizontal = absX > 0 || (e.shiftKey && absY > 0);
      if (wantsHorizontal) {
        app.onWheelPan(e);
        return;
      }
      app.onWheelZoom(e);
    },
    { passive: false }
  );

  initBoxZoom();

  window.addEventListener("resize", () => app.resize());
  await switchMode(state.mode);
  loop();
}

const boxZoom = { active: false, x0: 0, y0: 0, x1: 0, y1: 0, root: null, rect: null };

function initBoxZoom() {
  const stage = canvas.parentElement;
  const root = document.createElement("div");
  root.className = "boxzoom";
  root.hidden = true;
  const rect = document.createElement("div");
  rect.className = "boxzoom__rect";
  root.appendChild(rect);
  stage.appendChild(root);
  boxZoom.root = root;
  boxZoom.rect = rect;

  canvas.addEventListener("pointerdown", (e) => {
    if (!e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    tooltip.hidden = true;
    boxZoom.active = true;
    boxZoom.x0 = e.clientX;
    boxZoom.y0 = e.clientY;
    boxZoom.x1 = e.clientX;
    boxZoom.y1 = e.clientY;
    boxZoom.root.hidden = false;
    app.controls.enabled = false;
    drawBox();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!boxZoom.active) return;
    boxZoom.x1 = e.clientX;
    boxZoom.y1 = e.clientY;
    drawBox();
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!boxZoom.active) return;
    boxZoom.active = false;
    boxZoom.root.hidden = true;
    app.controls.enabled = true;
    app.zoomToScreenRect({ x0: boxZoom.x0, y0: boxZoom.y0, x1: boxZoom.x1, y1: boxZoom.y1 });
  });
}

function drawBox() {
  const stageRect = canvas.getBoundingClientRect();
  const x0 = Math.min(boxZoom.x0, boxZoom.x1) - stageRect.left;
  const y0 = Math.min(boxZoom.y0, boxZoom.y1) - stageRect.top;
  const x1 = Math.max(boxZoom.x0, boxZoom.x1) - stageRect.left;
  const y1 = Math.max(boxZoom.y0, boxZoom.y1) - stageRect.top;
  boxZoom.rect.style.left = `${x0}px`;
  boxZoom.rect.style.top = `${y0}px`;
  boxZoom.rect.style.width = `${Math.max(1, x1 - x0)}px`;
  boxZoom.rect.style.height = `${Math.max(1, y1 - y0)}px`;
}

let last = performance.now();
let baseJD = jdNow();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state.playing) {
    const daysPerSecond = TIME_SCALES[state.scaleIdx];
    baseJD += dt * daysPerSecond;
  }
  const tJD = baseJD + state.scrubDays;

  app.update(tJD, { exaggeration: state.mode === "kepler" ? modes.kepler.exag : 1, dt });
  currentMode?.update?.(tJD);
  app.render();
}

init();
