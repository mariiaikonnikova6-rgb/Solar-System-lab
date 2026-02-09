import { api } from "../api.js";

export class ExploreMode {
  constructor(app, state, { setSampleStats } = {}) {
    this.app = app;
    this.state = state;
    this.setSampleStats = setSampleStats;
    this._loading = false;
  }

  async enter() {
    await this.reload();
  }

  exit() {}

  async reload() {
    if (this._loading) return;
    this._loading = true;
    try {
      const layers = this.state.layersString();
      const data = await api.explore({ limit: this.state.asteroidCount, layers });
      this.app.setAsteroids(data.objects || []);
      this.setSampleStats?.(data.objects || [], { requested: this.state.asteroidCount, layers });
    } finally {
      this._loading = false;
    }
  }
}
