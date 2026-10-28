const TRACK_FIELDS = {
  mine: "mined",
  place: "placed",
  sandstone_place: "sandstonePlaced",
  craft: "crafts",
  death: "deaths",
  mummy_kill: "mummyKills"
};

export class Stats {
  constructor() {
    this.seconds = 0;
    this.mined = 0;
    this.placed = 0;
    this.sandstonePlaced = 0;
    this.crafts = 0;
    this.deaths = 0;
    this.mummyKills = 0;
  }

  track(ev, n = 1) {
    const field = TRACK_FIELDS[ev];
    if (field) this[field] += n;
  }

  tick(dt) {
    this.seconds += dt;
  }

  report() {
    return {
      seconds: this.seconds,
      mined: this.mined,
      placed: this.placed,
      sandstonePlaced: this.sandstonePlaced,
      crafts: this.crafts,
      deaths: this.deaths,
      mummyKills: this.mummyKills
    };
  }

  static fmtTime(s) {
    const t = Math.max(0, Math.floor(s));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const mm = String(m).padStart(2, "0");
    const ss = String(t % 60).padStart(2, "0");
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }
}
