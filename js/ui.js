import { BLOCKS, ITEMS, RECIPES, canCraft } from "./blocks.js";
import { itemIconURL } from "./textures.js";

export class UI {
  constructor(handlers) {
    this.handlers = handlers || {};
    this.currentInv = null;
    this.pendingTimers = [];
    this.iconCache = {};

    this.hud = document.getElementById("hud");
    this.hearts = document.getElementById("hearts");
    this.hotbar = document.getElementById("hotbar");
    this.invGrid = document.getElementById("inv-grid");
    this.invHotbar = document.getElementById("inv-hotbar");
    this.craftList = document.getElementById("craft-list");
    this.dial = document.getElementById("dial");
    this.dialIndicator = document.getElementById("dial-indicator");
    this.heldLabel = document.getElementById("held-label");
    this.vignette = document.getElementById("vignette");
    this.toastContainer = document.getElementById("toast-container");
    this.panelInventory = document.getElementById("panel-inventory");
    this.seedInput = document.getElementById("seed-input");
    this.versionFooter = document.getElementById("version-footer");

    this.buildHearts();
    this.buildHotbar();
    this.buildInventory();
    this.buildCrafting();
    this.buildScreens();

    this.setupButton(document.getElementById("btn-play"), () => {
      if (typeof this.handlers.onPlay === "function") {
        this.handlers.onPlay(this.seedInput.value.trim());
      }
    });
    this.setupButton(document.getElementById("btn-howto"), () => {
      if (typeof this.handlers.onHowTo === "function") {
        this.handlers.onHowTo();
      }
    });
    this.setupButton(document.getElementById("btn-pause-howto"), () => {
      if (typeof this.handlers.onHowTo === "function") {
        this.handlers.onHowTo();
      }
    });
    this.setupButton(document.getElementById("btn-howto-back"), () => {
      if (typeof this.handlers.onHowToBack === "function") {
        this.handlers.onHowToBack();
      }
    });
    this.setupButton(document.getElementById("btn-resume"), () => {
      if (typeof this.handlers.onResume === "function") {
        this.handlers.onResume();
      }
    });
    this.setupButton(document.getElementById("btn-exit-menu"), () => {
      if (typeof this.handlers.onExitToMenu === "function") {
        this.handlers.onExitToMenu();
      }
    });
    this.setupButton(document.getElementById("btn-respawn"), () => {
      if (typeof this.handlers.onRespawn === "function") {
        this.handlers.onRespawn();
      }
    });
    this.setupButton(document.getElementById("btn-death-menu"), () => {
      if (typeof this.handlers.onExitToMenu === "function") {
        this.handlers.onExitToMenu();
      }
    });
    this.setupButton(document.getElementById("btn-inv-close"), () => {
      this.toggleInventory();
    });

    const craftBtns = this.craftList.querySelectorAll("button.craft-btn");
    craftBtns.forEach((btn) => {
      this.setupButton(btn, () => {
        if (typeof this.handlers.onCraft === "function") {
          this.handlers.onCraft(Number(btn.dataset.recipe));
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if ((e.key === "m" || e.key === "M") && !this.isTyping(e.target)) {
        if (typeof this.handlers.onMuteToggle === "function") {
          this.handlers.onMuteToggle();
        }
      }
    });
  }

  setupButton(el, handler) {
    if (el) {
      el.addEventListener("click", handler);
    }
  }

  isTyping(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  }

  buildHearts() {
    this.hearts.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement("span");
      heart.className = "heart";
      this.hearts.appendChild(heart);
    }
    this.heartEls = Array.from(this.hearts.children);
  }

  buildHotbar() {
    this.hotbar.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement("div");
      slot.className = "hb-slot";
      const icon = document.createElement("img");
      icon.className = "hb-icon";
      const count = document.createElement("span");
      count.className = "hb-count";
      const dur = document.createElement("div");
      dur.className = "hb-dur";
      const durFill = document.createElement("div");
      durFill.className = "hb-dur-fill";
      dur.appendChild(durFill);
      slot.appendChild(icon);
      slot.appendChild(count);
      slot.appendChild(dur);
      this.hotbar.appendChild(slot);
    }
    this.hbSlots = Array.from(this.hotbar.children);
    this.hbIcons = this.hbSlots.map((s) => s.querySelector("img.hb-icon"));
    this.hbCounts = this.hbSlots.map((s) => s.querySelector("span.hb-count"));
    this.hbDurs = this.hbSlots.map((s) => s.querySelector("div.hb-dur > div.hb-dur-fill"));
  }

  buildInventory() {
    this.invGrid.innerHTML = "";
    for (let i = 0; i < 27; i++) {
      const slot = document.createElement("div");
      slot.className = "inv-slot";
      const icon = document.createElement("img");
      icon.className = "inv-icon";
      const count = document.createElement("span");
      count.className = "inv-count";
      slot.appendChild(icon);
      slot.appendChild(count);
      this.invGrid.appendChild(slot);
    }
    this.invGridSlots = Array.from(this.invGrid.children);
    this.invGridIcons = this.invGridSlots.map((s) => s.querySelector("img.inv-icon"));
    this.invGridCounts = this.invGridSlots.map((s) => s.querySelector("span.inv-count"));

    this.invHotbar.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement("div");
      slot.className = "inv-slot";
      const icon = document.createElement("img");
      icon.className = "inv-icon";
      const count = document.createElement("span");
      count.className = "inv-count";
      slot.appendChild(icon);
      slot.appendChild(count);
      this.invHotbar.appendChild(slot);
    }
    this.invHotbarSlots = Array.from(this.invHotbar.children);
    this.invHotbarIcons = this.invHotbarSlots.map((s) => s.querySelector("img.inv-icon"));
    this.invHotbarCounts = this.invHotbarSlots.map((s) => s.querySelector("span.inv-count"));
  }

  buildCrafting() {
    this.craftList.innerHTML = "";
    for (let i = 0; i < RECIPES.length; i++) {
      const row = document.createElement("div");
      row.className = "craft-row";
      row.dataset.recipe = i;

      const icon = document.createElement("img");
      icon.className = "craft-icon";
      row.appendChild(icon);

      const name = document.createElement("span");
      name.className = "craft-name";
      row.appendChild(name);

      const needs = document.createElement("span");
      needs.className = "craft-needs";
      row.appendChild(needs);

      const btn = document.createElement("button");
      btn.className = "craft-btn";
      btn.textContent = "Craft";
      btn.dataset.recipe = i;
      row.appendChild(btn);

      const recipe = RECIPES[i];
      icon.src = this.cachedIcon(recipe.out.id);
      name.textContent = this.itemName(recipe.out.id) + (recipe.out.count > 1 ? " ×" + recipe.out.count : "");
      needs.textContent = recipe.in
        .map((ing) => ing.count + "× " + this.itemName(ing.id))
        .join(" + ");

      this.craftList.appendChild(row);
    }
    this.craftRows = Array.from(this.craftList.children);
    this.craftIcons = this.craftRows.map((r) => r.querySelector("img.craft-icon"));
    this.craftNames = this.craftRows.map((r) => r.querySelector("span.craft-name"));
    this.craftNeeds = this.craftRows.map((r) => r.querySelector("span.craft-needs"));
    this.craftBtns = this.craftRows.map((r) => r.querySelector("button.craft-btn"));
  }

  cachedIcon(id) {
    if (!this.iconCache[id]) {
      this.iconCache[id] = itemIconURL(id);
    }
    return this.iconCache[id];
  }

  itemName(id) {
    if (id < 100 && BLOCKS[id]) {
      return BLOCKS[id].name;
    }
    if (ITEMS[id]) {
      return ITEMS[id].name;
    }
    return "";
  }

  buildScreens() {
    this.screenEls = [
      "screen-main",
      "screen-howto",
      "screen-pause",
      "screen-dead",
      "screen-win",
    ].map((id) => document.getElementById(id));
  }

  showScreen(name) {
    this.screenEls.forEach((el) => el.classList.remove("active"));
    if (name === "main") {
      document.getElementById("screen-main").classList.add("active");
    } else if (name === "howto") {
      document.getElementById("screen-howto").classList.add("active");
    } else if (name === "pause") {
      document.getElementById("screen-pause").classList.add("active");
    } else if (name === "dead") {
      document.getElementById("screen-dead").classList.add("active");
    } else if (name === "win") {
      document.getElementById("screen-win").classList.add("active");
    }
  }

  setHUDVisible(bool) {
    this.hud.hidden = !bool;
  }

  setHP(hp) {
    hp = Math.max(0, Math.min(20, hp));
    for (let i = 0; i < 10; i++) {
      const heart = this.heartEls[i];
      heart.className = "heart";
      const remaining = hp - 2 * i;
      if (remaining >= 2) {
        heart.classList.add("heart-full");
      } else if (remaining === 1) {
        heart.classList.add("heart-half");
      } else {
        heart.classList.add("heart-empty");
      }
    }
  }

  renderHotbar(inv) {
    this.currentInv = inv;
    const selected = inv.selected || 0;
    for (let i = 0; i < 9; i++) {
      const slotEl = this.hbSlots[i];
      const slot = inv.slots[i];
      slotEl.classList.toggle("selected", i === selected);

      const iconEl = this.hbIcons[i];
      const countEl = this.hbCounts[i];
      const durEl = this.hbDurs[i];

      if (slot) {
        iconEl.src = this.cachedIcon(slot.id);
        if (slot.count > 1) {
          countEl.textContent = String(slot.count);
          countEl.style.display = "";
        } else {
          countEl.style.display = "none";
        }
        const tool = ITEMS[slot.id] && ITEMS[slot.id].tool;
        if (slot.dur != null && tool && tool.dur) {
          durEl.style.width = Math.round((slot.dur / tool.dur) * 100) + "%";
          durEl.style.display = "";
        } else {
          durEl.style.display = "none";
        }
      } else {
        iconEl.removeAttribute("src");
        countEl.style.display = "none";
        durEl.style.display = "none";
      }
    }

    const held = inv.slots[selected];
    this.heldLabel.textContent = held ? this.itemName(held.id) : "";
  }

  renderInventory(inv) {
    this.currentInv = inv;
    const selected = inv.selected || 0;

    for (let i = 0; i < 27; i++) {
      this.fillInvSlot(this.invGridIcons[i], this.invGridCounts[i], inv.slots[9 + i]);
    }

    for (let i = 0; i < 9; i++) {
      this.invHotbarSlots[i].classList.toggle("selected", i === selected);
      this.fillInvSlot(this.invHotbarIcons[i], this.invHotbarCounts[i], inv.slots[i]);
    }

    for (let i = 0; i < RECIPES.length; i++) {
      const craftable = canCraft(inv.slots, i);
      this.craftRows[i].classList.toggle("disabled", !craftable);
      this.craftBtns[i].disabled = !craftable;
    }
  }

  fillInvSlot(iconEl, countEl, slot) {
    if (slot) {
      iconEl.src = this.cachedIcon(slot.id);
      if (slot.count > 1) {
        countEl.textContent = String(slot.count);
        countEl.style.display = "";
      } else {
        countEl.style.display = "none";
      }
    } else {
      iconEl.removeAttribute("src");
      countEl.style.display = "none";
    }
  }

  toggleInventory() {
    this.panelInventory.hidden = !this.panelInventory.hidden;
    if (!this.panelInventory.hidden && this.currentInv) {
      this.renderInventory(this.currentInv);
    }
    return !this.panelInventory.hidden;
  }

  toast(msg, ms = 2500) {
    if (this.toastContainer.children.length >= 5) {
      const oldest = this.toastContainer.firstElementChild;
      if (oldest) {
        clearTimeout(this.pendingTimers[0]);
        this.pendingTimers.shift();
        oldest.remove();
      }
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    this.toastContainer.appendChild(toast);

    const timeoutId = setTimeout(() => {
      toast.classList.add("toast-out");
      const removeId = setTimeout(() => {
        toast.remove();
        const idx = this.pendingTimers.indexOf(timeoutId);
        if (idx !== -1) {
          this.pendingTimers.splice(idx, 1);
        }
        const removeIdx = this.pendingTimers.indexOf(removeId);
        if (removeIdx !== -1) {
          this.pendingTimers.splice(removeIdx, 1);
        }
      }, 250);
      this.pendingTimers.push(removeId);
    }, ms);

    this.pendingTimers.push(timeoutId);
  }

  setDial(phase01, isNight) {
    this.dialIndicator.style.transform = "rotate(" + phase01 * 360 + "deg)";
    if (isNight) {
      this.dial.classList.add("night");
    } else {
      this.dial.classList.remove("night");
    }
  }

  damageFlash() {
    if (this.vignette.classList.contains("flash")) {
      this.vignette.classList.remove("flash");
      void this.vignette.offsetWidth;
    }
    this.vignette.classList.add("flash");

    const timeoutId = setTimeout(() => {
      this.vignette.classList.remove("flash");
      const idx = this.pendingTimers.indexOf(timeoutId);
      if (idx !== -1) {
        this.pendingTimers.splice(idx, 1);
      }
    }, 450);

    this.pendingTimers.push(timeoutId);
  }

  setVersion(v) {
    this.versionFooter.textContent = "v" + v;
  }
}
