const SENS = 0.0022;

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.mouseLeft = false;
    this.mouseRight = false;
    this._callbacks = [];
    this._slot = 0;
    this._wasLocked = false;

    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    document.addEventListener("pointerlockchange", this._onPointerLockChange);
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mousedown", this._onMouseDown);
    document.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("wheel", this._onWheel, { passive: false });
    window.addEventListener("blur", this._onBlur);
    canvas.addEventListener("contextmenu", this._onContextMenu);
  }

  on(cb) {
    this._callbacks.push(cb);
  }

  lock() {
    this.canvas.requestPointerLock();
  }

  unlock() {
    if (!this.isLocked()) return;
    this._selfUnlock = true;
    document.exitPointerLock();
  }

  isLocked() {
    return document.pointerLockElement === this.canvas;
  }

  _emit(e) {
    for (const cb of this._callbacks) cb(e);
  }

  _onPointerLockChange() {
    const nowLocked = this.isLocked();
    if (this._wasLocked && !nowLocked) {
      this.keys.clear();
      this.mouseLeft = false;
      this.mouseRight = false;
      if (this._selfUnlock) {
        this._selfUnlock = false;
      } else {
        this._emit({ type: "pause" });
      }
    }
    this._wasLocked = nowLocked;
  }

  _onMouseMove(e) {
    if (!this.isLocked()) return;
    this.yaw -= e.movementX * SENS;
    this.pitch -= e.movementY * SENS;
    const clamp = (Math.PI * 89) / 180;
    this.pitch = Math.max(-clamp, Math.min(clamp, this.pitch));
  }

  _onMouseDown(e) {
    if (!this.isLocked()) return;
    if (e.button === 0) {
      this.mouseLeft = true;
      this._emit({ type: "attack" });
    } else if (e.button === 2) {
      this.mouseRight = true;
      this._emit({ type: "use" });
      e.preventDefault();
    }
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouseLeft = false;
    else if (e.button === 2) this.mouseRight = false;
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "e") {
      this._emit({ type: "inventory" });
      return;
    }
    if (!this.isLocked()) return;
    if (k === "w" || k === "a" || k === "s" || k === "d") {
      this.keys.add(k);
    } else if (k === " ") {
      this.keys.add("space");
      e.preventDefault();
    } else if (k === "shift") {
      this.keys.add("shift");
    } else if (k >= "1" && k <= "9") {
      this._slot = Number(k) - 1;
      this._emit({ type: "select", i: this._slot });
    }
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k === " " ? "space" : k);
  }

  _onWheel(e) {
    if (!this.isLocked()) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    this._slot = (this._slot + dir + 9) % 9;
    this._emit({ type: "select", i: this._slot });
  }

  _onBlur() {
    this.keys.clear();
    this.mouseLeft = false;
    this.mouseRight = false;
  }

  dispose() {
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("blur", this._onBlur);
    this.canvas.removeEventListener("contextmenu", this._onContextMenu);
    this._callbacks = [];
  }
}
