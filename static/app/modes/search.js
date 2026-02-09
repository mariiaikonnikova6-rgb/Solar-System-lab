import { api } from "../api.js";
import { categoryLabel } from "../i18n.js";

export class SearchMode {
  constructor(app, state, { setHudObject } = {}) {
    this.app = app;
    this.state = state;
    this.setHudObject = setHudObject;
    this.panel = null;
    this.results = [];
    this.selected = null;
    this.pinned = false;
  }

  async enter(panel, i18n) {
    this.panel = panel;
    panel.innerHTML = `
      <div class="panel__title">${i18n.modePanels.searchTitle}</div>
      <div class="panel__row" style="position:relative">
        <input id="srch-q" class="select" placeholder="${i18n.search.placeholder}" autocomplete="off" />
        <div id="srch-suggest" class="suggest" hidden></div>
      </div>
      <div class="panel__row">
        <button class="btn" id="srch-go" style="flex:1">${i18n.search.go}</button>
        <button class="btn" id="srch-follow">${i18n.search.follow}</button>
      </div>
      <div class="panel__row">
        <button class="btn btn--ghost" id="srch-pin">${i18n.search.pin}</button>
      </div>
      <div class="hint" id="srch-status"></div>
      <div id="srch-results" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;"></div>
    `;

    const q = panel.querySelector("#srch-q");
    const go = panel.querySelector("#srch-go");
    const follow = panel.querySelector("#srch-follow");
    const pin = panel.querySelector("#srch-pin");
    const suggest = panel.querySelector("#srch-suggest");

    const doSearch = async () => {
      const status = panel.querySelector("#srch-status");
      if (q.value.trim().length < 2) {
        this.results = [];
        this._renderSuggestions();
        this._renderResults();
        status.textContent = "";
        return;
      }

      status.textContent = "…";
      try {
        const data = await api.search(q.value);
        this.results = data.results || [];
        this._renderSuggestions();
        this._renderResults();
        status.textContent = this.results.length ? `${this.results.length}` : i18n.search.empty;
      } catch (e) {
        status.textContent = String(e);
      }
    };

    const hideSuggestions = () => {
      suggest.hidden = true;
      suggest.innerHTML = "";
    };

    q.addEventListener("focus", () => {
      if (this.results.length) this._renderSuggestions();
    });
    q.addEventListener("blur", () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || !this.panel?.contains(active)) hideSuggestions();
      }, 80);
    });
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
      if (e.key === "Escape") hideSuggestions();
    });
    q.addEventListener("input", () => {
      doSearch();
    });

    go.addEventListener("click", async () => this.goToSelected());
    follow.addEventListener("click", async () => this.followSelected());
    pin.addEventListener("click", () => {
      this.pinned = !this.pinned;
      pin.classList.toggle("is-active", this.pinned);
      if (!this.pinned) this.setHudObject?.(null);
      if (this.pinned && this.selected) this.setHudObject?.(this.selected);
    });
  }

  exit() {
    this.panel = null;
    this.results = [];
    this.selected = null;
    this.app.clearOrbit();
  }

  _renderSuggestions() {
    const suggest = this.panel?.querySelector("#srch-suggest");
    if (!suggest) return;

    suggest.innerHTML = "";
    if (!this.results.length) {
      suggest.hidden = true;
      return;
    }

    const max = 8;
    for (const r of this.results.slice(0, max)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "suggest__item";
      b.textContent = `${r.name} • ${categoryLabel(this.state.lang, r.category)}`;
      b.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        await this._selectResult(r);
      });
      suggest.appendChild(b);
    }
    suggest.hidden = false;
  }

  _setSelectedObject(obj) {
    this.selected = obj;
    this.app.setSelectedObject(obj);
    if (this.pinned) this.setHudObject?.(obj);
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
      { color: 0xffffff, opacity: 0.9 }
    );
  }

  async _selectResult(r) {
    const q = this.panel?.querySelector("#srch-q");
    if (q) q.value = r.name;

    const ident = r.id ?? r.spkid ?? r.name;
    const obj = await api.object(ident);
    this._setSelectedObject(obj);

    const suggest = this.panel?.querySelector("#srch-suggest");
    if (suggest) suggest.hidden = true;
  }

  _renderResults() {
    const box = this.panel.querySelector("#srch-results");
    box.innerHTML = "";
    for (const r of this.results.slice(0, 20)) {
      const b = document.createElement("button");
      b.className = "btn btn--ghost";
      b.style.textAlign = "left";
      b.textContent = `${r.name} • ${categoryLabel(this.state.lang, r.category)}`;
      b.addEventListener("click", async () => {
        await this._selectResult(r);
      });
      box.appendChild(b);
    }
  }

  async _ensureSelectedFromInputOrResults() {
    if (this.selected) return true;

    const q = this.panel?.querySelector("#srch-q");
    const raw = q?.value?.trim();
    if (!raw) return false;

    try {
      const obj = await api.object(raw);
      this._setSelectedObject(obj);
      return true;
    } catch {
      // ignore and fall back to search results
    }

    if (!this.results.length) {
      try {
        const data = await api.search(raw);
        this.results = data.results || [];
        this._renderSuggestions();
        this._renderResults();
      } catch {
        // ignore; handled below
      }
    }

    if (this.results.length) {
      await this._selectResult(this.results[0]);
      return true;
    }

    return false;
  }

  async goToSelected() {
    const ok = await this._ensureSelectedFromInputOrResults();
    if (!ok) return;
    this.app.setObserver("follow");
  }

  async followSelected() {
    await this.goToSelected();
  }
}
