import { api } from "../api.js";

const CAT_COLOR = {
  mainbelt: 0x8fd3ff,
  neo: 0xffb86b,
  trojan: 0x7ce6b8,
  comet: 0xff6b8a,
};

export class CompareMode {
  constructor(app, state, { setHudObject } = {}) {
    this.app = app;
    this.state = state;
    this.setHudObject = setHudObject;
    this.panel = null;
    this._lines = [];
    this.normalize = true;
    this.clamp = true;
  }

  async enter(panel, i18n) {
    this.panel = panel;
    panel.innerHTML = `
      <div class="panel__title">${i18n.modePanels.compareTitle}</div>
      <div class="panel__grid">
        <label class="toggle"><input type="checkbox" id="cmp-norm" checked/> ${i18n.compare.normalize}</label>
        <label class="toggle"><input type="checkbox" id="cmp-clamp" checked/> ${i18n.compare.clamp}</label>
      </div>
      <div class="panel__row" style="margin-top:10px;">
        <button class="btn" id="cmp-run" style="flex:1">${i18n.compare.run}</button>
      </div>
      <div class="hint" id="cmp-status"></div>
    `;
    panel.querySelector("#cmp-norm").addEventListener("change", (e) => (this.normalize = e.target.checked));
    panel.querySelector("#cmp-clamp").addEventListener("change", (e) => (this.clamp = e.target.checked));
    panel.querySelector("#cmp-run").addEventListener("click", () => this.generate());
    await this.generate();
  }

  exit() {
    this._clear();
    this.panel = null;
  }

  _clear() {
    for (const l of this._lines) this.app.layers.overlays.remove(l);
    this._lines = [];
    this.setHudObject?.(null);
  }

  async generate() {
    this._clear();
    const status = this.panel?.querySelector("#cmp-status");
    if (status) status.textContent = "…";
    const cats = ["neo", "mainbelt", "trojan", "comet"];
    const picks = [];
    for (const c of cats) {
      const n = c === "mainbelt" ? 2 : 1;
      for (let i = 0; i < n; i++) picks.push(api.random(c));
    }
    try {
      const objs = await Promise.allSettled(picks);
      const good = objs.filter((r) => r.status === "fulfilled").map((r) => r.value);
      if (good.length === 0) {
        if (status) status.textContent = "No data in DB.";
        return;
      }
      const clampAU = this.clamp ? 10 : Infinity;
      for (const obj of good) {
        const a = Math.min(obj.a, clampAU);
        const factor = this.normalize ? Math.min(1, 5 / Math.max(0.001, a)) : 1;
        const scaled = a * factor;
        this.app.setOrbitFromElements(
          {
            name: obj.name,
            a: scaled,
            e: obj.e,
            i: obj.i,
            Omega: obj.Omega,
            omega: obj.omega,
            M0: obj.M0,
            epochJD: 2440587.5 + Date.parse(obj.epoch) / 86400000,
          },
          { color: CAT_COLOR[obj.category] ?? 0xffffff, opacity: 0.75 }
        );
        if (this.app.orbitLine) this._lines.push(this.app.orbitLine);
        this.app.orbitLine = null;
      }
      if (status) status.textContent = `Orbits: ${this._lines.length}`;
    } catch (e) {
      if (status) status.textContent = String(e);
    }
  }
}
