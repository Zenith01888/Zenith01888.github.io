(function () {
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const menuToggle = document.getElementById("menuToggle");
  const siteNav = document.getElementById("siteNav");
  const year = document.getElementById("year");

  const savedTheme = localStorage.getItem("zenith01888-theme");
  const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.dataset.theme = savedTheme || systemTheme;

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("zenith01888-theme", root.dataset.theme);
    });
  }

  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("nav-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "关闭菜单" : "打开菜单");
    });
  }

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const reveals = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          const skillRow = entry.target.closest(".skill-row");
          if (skillRow) {
            const level = skillRow.dataset.level || 0;
            const meter = skillRow.querySelector(".meter span");
            if (meter) {
              meter.style.width = `${level}%`;
            }
          }
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  reveals.forEach((element) => observer.observe(element));

  if (window.lucide) {
    window.lucide.createIcons();
  }
})();
