import { categoryLabel, t } from "./i18n.js";

export function setActiveButton(container, predicate) {
  for (const el of container.querySelectorAll("button")) {
    if (!el.dataset) continue;
    el.classList.toggle("is-active", predicate(el));
  }
}

export function renderHud(el, lang, obj) {
  if (!obj) {
    el.innerHTML = "";
    return;
  }
  const f = (v, digits = 3) => (v === null || v === undefined ? "—" : Number(v).toFixed(digits));
  el.innerHTML = `
    <div class="card__title">${obj.name}</div>
    <div class="card__meta">
      <div class="kv"><span>${t(lang, "hud.category")}</span><b>${categoryLabel(lang, obj.category)}</b></div>
      <div class="kv"><span>ID</span><b>${obj.spkid}</b></div>
      <div class="kv"><span>${t(lang, "hud.epoch")}</span><b>${obj.epoch ?? "—"}</b></div>
      <div class="kv"><span>${t(lang, "hud.period")}</span><b>${obj.period ? f(obj.period, 0) : "—"}</b></div>
      <div class="kv"><span>${t(lang, "hud.a")}</span><b>${f(obj.a, 3)}</b></div>
      <div class="kv"><span>${t(lang, "hud.e")}</span><b>${f(obj.e, 4)}</b></div>
      <div class="kv"><span>${t(lang, "hud.i")}</span><b>${f(obj.i, 2)}</b></div>
      <div class="kv"><span>${t(lang, "hud.q")}</span><b>${obj.q ? f(obj.q, 3) : "—"}</b></div>
      <div class="kv"><span>${t(lang, "hud.Q")}</span><b>${obj.Q ? f(obj.Q, 3) : "—"}</b></div>
      <div class="kv"><span>${t(lang, "hud.H")}</span><b>${obj.H ?? "—"}</b></div>
    </div>
  `;
}

export function applyI18n(lang) {
  document.getElementById("observer-title").textContent = t(lang, "observer");
  document.getElementById("time-title").textContent = t(lang, "time");
  const timeSpeedTitle = document.getElementById("time-speed-title");
  if (timeSpeedTitle) timeSpeedTitle.textContent = t(lang, "timeSpeed");
  const timeOffsetTitle = document.getElementById("time-offset-title");
  if (timeOffsetTitle) timeOffsetTitle.textContent = t(lang, "timeOffset");
  const asteroidScaleTitle = document.getElementById("asteroid-scale-title");
  if (asteroidScaleTitle) asteroidScaleTitle.textContent = t(lang, "asteroidScale");
  const asteroidScaleLabel = document.getElementById("asteroid-scale-label");
  if (asteroidScaleLabel) asteroidScaleLabel.textContent = t(lang, "asteroidScaleValue");
  const scaleModeTitle = document.getElementById("scale-mode-title");
  if (scaleModeTitle) scaleModeTitle.textContent = t(lang, "scaleMode");
  const scaleVisual = document.getElementById("scale-visual");
  if (scaleVisual) scaleVisual.textContent = t(lang, "scaleVisual");
  const scaleReal = document.getElementById("scale-real");
  if (scaleReal) scaleReal.textContent = t(lang, "scaleReal");
  const scaleComfort = document.getElementById("scale-comfort");
  if (scaleComfort) scaleComfort.textContent = t(lang, "scaleComfort");
  document.getElementById("layers-title").textContent = t(lang, "layers");
  const sampleNote = document.getElementById("sample-note");
  if (sampleNote) sampleNote.textContent = t(lang, "sampleNote");
  document.getElementById("layer-planet-orbits-label").textContent = t(lang, "planetOrbits");
  document.getElementById("layer-planets-label").textContent = t(lang, "planets");
  document.getElementById("layer-mainbelt-label").textContent = t(lang, "mainbelt");
  document.getElementById("layer-neo-label").textContent = t(lang, "neo");
  document.getElementById("layer-trojans-label").textContent = t(lang, "trojans");
  document.getElementById("layer-comets-label").textContent = t(lang, "comets");
  document.getElementById("time-hint").textContent = t(lang, "scrubHint");
  document.getElementById("share-link").textContent = t(lang, "share");
  const brandTitle = document.getElementById("brand-title");
  if (brandTitle) brandTitle.textContent = t(lang, "appName");
  const landingTitle = document.getElementById("landing-title");
  if (landingTitle) landingTitle.textContent = t(lang, "appName");
  const landingSlogan = document.getElementById("landing-slogan");
  if (landingSlogan) landingSlogan.textContent = t(lang, "landingSlogan");
  const landingEnter = document.getElementById("enter-scene");
  if (landingEnter) landingEnter.textContent = t(lang, "landingEnter");


  for (const b of document.querySelectorAll(".tab")) {
    const mode = b.dataset.mode;
    b.textContent = t(lang, `modes.${mode}`);
  }
  document.querySelector("#obs-sun").textContent = t(lang, "observers.sun");
  document.querySelector("#obs-earth").textContent = t(lang, "observers.earth");
  document.querySelector("#obs-follow").textContent = t(lang, "observers.follow");
  document.querySelector("#obs-free").textContent = t(lang, "observers.free");
  const planetSel = document.getElementById("obs-planet");
  planetSel.options[0].textContent = t(lang, "observers.fromPlanet");

  document.getElementById("lang-ua").setAttribute("aria-label", "Українська");
  document.getElementById("lang-en").setAttribute("aria-label", "English");

  const sidebarToggle = document.getElementById("sidebar-toggle");
  if (sidebarToggle) {
    const layoutEl = document.getElementById("app");
    const collapsed = !!layoutEl?.classList.contains("is-sidebar-collapsed");
    const label = collapsed ? t(lang, "sidebarToggle.show") : t(lang, "sidebarToggle.hide");
    sidebarToggle.setAttribute("aria-label", label);
    sidebarToggle.title = label;
  }
}
