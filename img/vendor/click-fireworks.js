(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let canvas = null;
  let ctx = null;
  let particles = [];
  let rafId = 0;
  const maxParticles = 260;
  const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff9f1c", "#c084fc"];

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "click-fireworks";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize, { passive: true });
  }

  function launch(x, y) {
    const count = 44 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.2 + Math.random() * 4.8;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.012,
        size: 1.6 + Math.random() * 2.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.06 + Math.random() * 0.04
      });
    }

    if (particles.length > maxParticles) {
      particles.splice(0, particles.length - maxParticles);
    }
  }

  function frame() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles = particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      particle.life -= particle.decay;
      if (particle.life <= 0) return false;

      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    ctx.globalAlpha = 1;

    if (particles.length > 0) {
      rafId = window.requestAnimationFrame(frame);
    } else {
      rafId = 0;
    }
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      ensureCanvas();
      launch(event.clientX, event.clientY);
      if (!rafId) {
        rafId = window.requestAnimationFrame(frame);
      }
    },
    { passive: true }
  );
})();
