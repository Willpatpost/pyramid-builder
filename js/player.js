import { ITEMS, stackMax } from "./blocks.js";

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);
    this.selected = 0;
  }

  add(id, count = 1, dur) {
    let left = count;
    const isTool = id >= 100 && ITEMS[id] !== undefined && ITEMS[id].kind === "tool";
    if (isTool) {
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { id, count: 1, dur: dur !== undefined ? dur : ITEMS[id].tool.dur };
          left--;
        }
      }
      return left;
    }
    const max = stackMax(id);
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const take = Math.min(max - s.count, left);
        s.count += take;
        left -= take;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, left);
        this.slots[i] = { id, count: take };
        left -= take;
      }
    }
    return left;
  }

  removeSelected(n = 1) {
    const slot = this.slots[this.selected];
    if (!slot) return 0;
    const removed = Math.min(slot.count, n);
    slot.count -= removed;
    if (slot.count <= 0) this.slots[this.selected] = null;
    return removed;
  }

  count(id) {
    let total = 0;
    for (const s of this.slots) {
      if (s && s.id === id) total += s.count;
    }
    return total;
  }

  held() {
    return this.slots[this.selected] || null;
  }

  consume(id, n) {
    if (this.count(id) < n) return false;
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, left);
        s.count -= take;
        left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return true;
  }
}

export class Player {
  constructor(x, y, z) {
    this.hp = 20;
    this.maxHp = 20;
    this.dead = false;
    this.inv = new Inventory();
    this.pos = x !== undefined ? { x, y, z } : null;
    this.lastCause = null;
  }

  damage(n, cause) {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - n);
    this.lastCause = cause;
    if (this.hp === 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  heal(n) {
    if (!this.dead) this.hp = Math.min(this.maxHp, this.hp + n);
  }

  eat() {
    const held = this.inv.held();
    if (!held) return false;
    const def = ITEMS[held.id];
    if (!def || def.kind !== "food") return false;
    this.inv.consume(held.id, 1);
    this.heal(def.food.heal);
    return true;
  }

  respawn(pos) {
    this.hp = this.maxHp;
    this.dead = false;
    this.pos = { x: pos.x, y: pos.y, z: pos.z };
  }

  heldItem() {
    return this.inv.held();
  }

  damageHeld() {
    const slot = this.inv.held();
    if (slot && slot.dur !== undefined) {
      slot.dur -= 1;
      if (slot.dur <= 0) this.inv.slots[this.inv.selected] = null;
    }
  }
}
