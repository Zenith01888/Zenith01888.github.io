(function () {
  const nav = document.getElementById("siteNav");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const toolsMenuToggle = document.getElementById("toolsMenuToggle");
  const toolsDropdown = document.getElementById("toolsDropdown");
  const year = document.getElementById("year");

  const onScroll = () => {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const closeToolsMenu = () => {
    if (!toolsDropdown) return;
    toolsDropdown.classList.remove("open");
    toolsMenuToggle.setAttribute("aria-expanded", "false");
  };

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "关闭菜单" : "打开菜单");
      closeToolsMenu();
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "打开菜单");
        closeToolsMenu();
      });
    });
  }

  if (toolsMenuToggle && toolsDropdown) {
    toolsMenuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = toolsDropdown.classList.toggle("open");
      toolsMenuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (event) => {
      if (!toolsDropdown.contains(event.target)) {
        closeToolsMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeToolsMenu();
      }
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
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  reveals.forEach((element) => observer.observe(element));

  if (window.lucide) {
    window.lucide.createIcons();
  }
})();
