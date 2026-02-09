import { api } from "../api.js";
import { categoryLabel } from "../i18n.js";

const CAT_COLOR = {
  mainbelt: 0x8fd3ff,
  neo: 0xffb86b,
  trojan: 0x7ce6b8,
  comet: 0xff6b8a,
  other: 0xaab2c5,
};

export class RandomMode {
  constructor(app, state, { setHudObject } = {}) {
    this.app = app;
    this.state = state;
    this.setHudObject = setHudObject;
    this.obj = null;
    this.panel = null;
  }

  async enter(panel, i18n) {
    this.panel = panel;
    panel.innerHTML = `
      <div class="panel__title">${i18n.modePanels.randomTitle}</div>
      <div class="panel__grid">
        <button class="btn" data-cat="neo">${i18n.random.neo}</button>
        <button class="btn" data-cat="mainbelt">${i18n.random.mainbelt}</button>
        <button class="btn" data-cat="trojan">${i18n.random.trojan}</button>
        <button class="btn" data-cat="comet">${i18n.random.comet}</button>
      </div>
      <div class="panel__row" style="margin-top:10px;">
        <button class="btn" data-cat="any" style="flex:1">${i18n.random.any}</button>
      </div>
      <div class="hint" id="random-status"></div>
    `;

    panel.querySelectorAll("button[data-cat]").forEach((b) => {
      b.addEventListener("click", async () => {
        const cat = b.dataset.cat;
        await this.pick(cat);
      });
    });
  }

  exit() {
    this.panel = null;
    this.obj = null;
    this.app.clearOrbit();
  }

  async pick(category) {
    const status = this.panel?.querySelector("#random-status");
    if (status) status.textContent = "…";
    try {
      const obj = await api.random(category);
      if (!obj || obj.missing || !obj.name) {
        if (status) status.textContent = obj?.detail || "No objects found.";
        return;
      }
      this.obj = obj;
      this.setHudObject?.(obj);
      this.app.setSelectedObject(obj);
      this.app.setOrbitFromElements(
        {
          name: obj.name,
          a: obj.a,
          e: obj.e,
          i: obj.i,
          Omega: obj.Omega,
          omega: obj.omega,
          M0: obj.M0,
          epochJD: 2440587.5 + Date.parse(obj.epoch) / 86400000,
        },
        { color: CAT_COLOR[obj.category] ?? 0xffffff, opacity: 0.9 }
      );
      if (status) status.textContent = `${obj.name} — ${categoryLabel(this.state.lang, obj.category)}`;
    } catch (e) {
      if (status) status.textContent = String(e);
    }
  }
}
