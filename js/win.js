import { PAGES_URL } from "./config.js";
import { Stats } from "./stats.js";

let currentWinHandle = null;

function runWinSequence({ statsReport, sfx, handlers }) {
  if (currentWinHandle) {
    currentWinHandle.stop();
  }

  const winHandle = new WinHandle({ statsReport, sfx, handlers });
  currentWinHandle = winHandle;
  return winHandle;
}

class WinHandle {
  constructor({ statsReport, sfx, handlers }) {
    this.stopped = false;
    this.statsReport = statsReport;
    this.sfx = sfx;
    this.handlers = handlers;

    const screens = document.querySelectorAll(".screen");
    screens.forEach((screen) => screen.classList.remove("active"));
    document.getElementById("screen-win").classList.add("active");

    document.getElementById("win-congrats").textContent = "";
    document.getElementById("win-stats").textContent = "";
    document.getElementById("btn-share").setAttribute("disabled", "");
    document.getElementById("btn-continue").setAttribute("disabled", "");
    document.getElementById("btn-exit-win").setAttribute("disabled", "");

    if (this.sfx && typeof this.sfx.play === "function") {
      this.sfx.play("win");
    }

    this.typewriterTimers = [];
    this.confettiRAF = null;
    this.resizeListener = null;
    this.buttonListeners = [];

    this.initTypewriter();
  }

  initTypewriter() {
    const congratsContainer = document.getElementById("win-congrats");
    const lines = [
      "By the gods… it stands.",
      "Six hundred and eighty blocks.",
      "Every layer perfectly stepped.",
      "The desert bows before you.",
      "Pharaohs would weep with envy.",
      "THE MONUMENT IS COMPLETE."
    ];

    let lineIndex = 0;
    let charIndex = 0;
    let lineEl = null;

    const step = () => {
      if (this.stopped) return;
      if (lineIndex >= lines.length) {
        this.finishTypewriter();
        return;
      }
      if (!lineEl) {
        lineEl = document.createElement("p");
        lineEl.className = "win-line";
        congratsContainer.appendChild(lineEl);
        charIndex = 0;
      }
      const line = lines[lineIndex];
      if (charIndex < line.length) {
        lineEl.textContent += line[charIndex];
        charIndex++;
        this.typewriterTimers.push(setTimeout(step, 30));
      } else {
        lineIndex++;
        lineEl = null;
        this.typewriterTimers.push(setTimeout(step, 380));
      }
    };

    this.typewriterTimers.push(setTimeout(step, 30));

    this.setupButtons();
  }

  finishTypewriter() {
    if (this.stopped) return;

    const statsContainer = document.getElementById("win-stats");
    const table = document.createElement("table");
    table.className = "stats-table";

    const statsData = [
      ["Time", Stats.fmtTime(this.statsReport.seconds || 0)],
      ["Sandstone placed", this.statsReport.sandstonePlaced || 0],
      ["Blocks mined", this.statsReport.mined || 0],
      ["Mummies defeated", this.statsReport.mummyKills || 0],
      ["Deaths", this.statsReport.deaths || 0]
    ];

    statsData.forEach(([label, value]) => {
      const tr = document.createElement("tr");
      const tdLabel = document.createElement("td");
      tdLabel.textContent = label;
      const tdValue = document.createElement("td");
      tdValue.textContent = value;
      tr.appendChild(tdLabel);
      tr.appendChild(tdValue);
      table.appendChild(tr);
    });

    statsContainer.appendChild(table);

    this.startConfetti();

    document.getElementById("btn-share").removeAttribute("disabled");
    document.getElementById("btn-continue").removeAttribute("disabled");
    document.getElementById("btn-exit-win").removeAttribute("disabled");
  }

  startConfetti() {
    const canvas = document.getElementById("confetti");
    const ctx = canvas.getContext("2d");

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const colors = ["#d4af37", "#e8d5a3", "#fff8e1", "#c9a227"];
    const particleCount = 200;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: -Math.random() * 400,
        size: 6 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 160,
        vy: 120 + Math.random() * 160,
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() - 0.5) * 6
      });
    }

    let lastTime = performance.now();
    let elapsed = 0;
    const duration = 12000;

    const resizeCanvas = () => {
      if (this.stopped) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    this.resizeListener = resizeCanvas;
    window.addEventListener("resize", this.resizeListener);

    const render = () => {
      if (this.stopped) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      if (elapsed >= duration) {
        ctx.clearRect(0, 0, width, height);
        if (this.resizeListener) {
          window.removeEventListener("resize", this.resizeListener);
          this.resizeListener = null;
        }
        return;
      }

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.vy = Math.min(p.vy + 500 * dt, 650);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vRotation * dt;

        if (p.y > height + 12) {
          p.y = -12;
          p.x = Math.random() * width;
          p.vy = 120 + Math.random() * 160;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      this.confettiRAF = requestAnimationFrame(render);
    };

    this.confettiRAF = requestAnimationFrame(render);
  }

  setupButtons() {
    const continueBtn = document.getElementById("btn-continue");
    const exitBtn = document.getElementById("btn-exit-win");
    const shareBtn = document.getElementById("btn-share");

    const onContinue = () => {
      this.stop();
      if (typeof this.handlers.onContinue === "function") {
        this.handlers.onContinue();
      }
    };

    const onExit = () => {
      this.stop();
      if (typeof this.handlers.onExit === "function") {
        this.handlers.onExit();
      }
    };

    const onShare = () => {
      const r = this.statsReport;
      const text = "I raised the great sandstone pyramid in Pyramid Builder — " +
        (r.sandstonePlaced || 0) + " blocks in " + Stats.fmtTime(r.seconds || 0) + ", " +
        (r.mummyKills || 0) + " mummies defeated, " + (r.deaths || 0) + " deaths.";

      (async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: "Pyramid Builder Milestone",
              text: text,
              url: PAGES_URL
            });
          } catch (err) {
            if (!err || err.name !== "AbortError") {
              await this.copyToClipboard(text);
            }
          }
        } else {
          await this.copyToClipboard(text);
        }
        if (typeof this.handlers.onShare === "function") {
          this.handlers.onShare();
        }
      })();
    };

    continueBtn.addEventListener("click", onContinue);
    exitBtn.addEventListener("click", onExit);
    shareBtn.addEventListener("click", onShare);

    this.buttonListeners.push(
      { el: continueBtn, type: "click", fn: onContinue },
      { el: exitBtn, type: "click", fn: onExit },
      { el: shareBtn, type: "click", fn: onShare }
    );
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text + " " + PAGES_URL);
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = "Copied to clipboard!";
      const container = document.getElementById("toast-container");
      container.appendChild(toast);
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 2500);
    } catch {
      return;
    }
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;

    this.typewriterTimers.forEach((id) => clearTimeout(id));
    this.typewriterTimers = [];

    if (this.confettiRAF) {
      cancelAnimationFrame(this.confettiRAF);
      this.confettiRAF = null;
    }

    const canvas = document.getElementById("confetti");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (this.resizeListener) {
      window.removeEventListener("resize", this.resizeListener);
      this.resizeListener = null;
    }

    this.buttonListeners.forEach(({ el, type, fn }) => {
      el.removeEventListener(type, fn);
    });
    this.buttonListeners = [];
  }
}

export { runWinSequence };
