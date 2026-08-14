(function () {
  "use strict";

  const LANG_KEY = "zenith-lang";
  const THEME_KEY = "zenith-theme";
  const BW_KEY = "zenith-bw";

  const I18N = {
    zh: {
      "title": "Zenith01888 的个人主页",
      "meta.description": "Zenith 的个人主页：项目、学习记录与正在做的事。",
      "skip": "跳到主要内容",
      "nav.aria": "主导航",
      "nav.tools": "工具",
      "nav.tools.pdfmerge": "Pdfmerge",
      "nav.tools.pwm": "PWM 监控",
      "nav.tools.oscilloscope": "示波器上位机",
      "nav.projects": "项目",
      "nav.about": "关于",
      "nav.contact": "联系",
      "nav.toggle.open": "打开菜单",
      "nav.toggle.close": "关闭菜单",
      "lang.toggle": "EN",
      "lang.aria": "切换到英文",
      "theme.dark": "切换到深色模式",
      "theme.light": "切换到浅色模式",
      "bw.aria": "切换黑白显示",
      "hero.subtitle": "记录项目、学习与正在做的事",
      "hero.scroll": "向下滚动",
      "recent.aria": "最近项目",
      "tags.aria": "项目标签",
      "recent.title": "最近项目",
      "recent.viewAll": "查看全部",
      "pagination.aria": "项目分页",
      "pagination.prev": "上一页",
      "pagination.next": "下一页",
      "pagination.page": "第",
      "project.pdfmerge.aria": "打开 Pdfmerge 工具",
      "project.pdfmerge.cover": "Pdfmerge 项目封面",
      "project.pdfmerge.title": "Pdfmerge",
      "project.pdfmerge.date": "更新于 2026-08-14",
      "project.pdfmerge.meta": "工具 · 开源",
      "project.pdfmerge.desc": "一个完全在浏览器本地运行的 PDF 合并工具：拖入多个 PDF，调整合并顺序，点击合并后直接下载，文件不会上传到任何服务器。",
      "project.use": "在线使用",
      "project.view": "项目页面",
      "project.viewRepo": "查看仓库",
      "project.pwm.aria": "打开 PWM Monitor 工具",
      "project.pwm.cover": "PWM Monitor 项目封面",
      "project.pwm.title": "PWM Monitor",
      "project.pwm.date": "更新于 2026-08-14",
      "project.pwm.meta": "工具 · Web Serial",
      "project.pwm.desc": "通过 Web Serial 连接开发板，实时捕获并监控多路 PWM 频率与占空比，支持通道开关、统计和导出 Excel。",
      "project.oscilloscope.aria": "打开示波器上位机工具",
      "project.oscilloscope.cover": "示波器上位机项目封面",
      "project.oscilloscope.title": "示波器上位机",
      "project.oscilloscope.date": "更新于 2026-08-14",
      "project.oscilloscope.meta": "工具 · Python",
      "project.oscilloscope.desc": "基于 Python、Flask 和 PyVISA 的示波器 Web 上位机，支持 YOKOGAWA DLM2024 / RIGOL / Keysight，实时采集 4 通道测量数据并导出 Excel。",
      "project.portfolio.aria": "个人主页项目",
      "project.portfolio.cover": "个人主页项目封面",
      "project.portfolio.title": "个人主页",
      "project.portfolio.date": "更新于 2026-08-14",
      "project.portfolio.meta": "站点 · GitHub Pages",
      "project.portfolio.desc": "使用原生 HTML、CSS 和 JavaScript 构建的零依赖个人主页，参考博客式布局设计，可直接部署到 GitHub Pages。",
      "project.visit": "访问站点",
      "project.lab.aria": "小工具实验室项目",
      "project.lab.cover": "小工具实验室项目封面",
      "project.lab.title": "小工具实验室",
      "project.lab.date": "规划中",
      "project.lab.meta": "实验室 · 开源",
      "project.lab.desc": "持续把日常问题做成小而可靠的工具，记录灵感、实验和可以复用的代码片段。",
      "project.follow": "关注动态",
      "aside.projects": "项目",
      "aside.sites": "站点",
      "aside.ideas": "灵感",
      "aside.avatar.alt": "Zenith01888 头像",
      "aside.description": "全栈开发者 · 效率工具爱好者",
      "aside.github": "GitHub",
      "aside.email": "邮箱",
      "aside.about": "关于我",
      "aside.recentProjects": "最新项目",
      "aside.recent.pdfmerge": "Pdfmerge",
      "aside.recent.pdfmerge.date": "2026-08-14",
      "aside.recent.pwm": "PWM Monitor",
      "aside.recent.pwm.date": "2026-08-14",
      "aside.recent.oscilloscope": "示波器上位机",
      "aside.recent.oscilloscope.date": "2026-08-14",
      "aside.recent.portfolio": "个人主页",
      "aside.recent.portfolio.date": "2026-08-14",
      "aside.recent.lab": "小工具实验室",
      "aside.recent.lab.date": "规划中",
      "aside.categories": "分类",
      "category.pdf": "PDF 工具",
      "category.serial": "Web Serial",
      "category.oscilloscope": "示波器",
      "category.pages": "GitHub Pages",
      "aside.tagCloud": "标签云",
      "aside.siteInfo": "站点信息",
      "info.projects": "项目",
      "info.categories": "分类",
      "info.tags": "标签",
      "info.built": "建站",
      "about.title": "关于我",
      "about.p1": "我是一名关注 Web 开发与效率工具的开发者，喜欢把日常问题变成小而可靠的产品。日常工作中，我关注前端工程、自动化脚本和产品体验，享受从想法到上线被真实使用的过程。",
      "about.p2": "这个页面记录我的项目、兴趣和正在做的事。所有内容都保持小而清晰，正如我做工具时的原则。",
      "fact.direction": "方向",
      "fact.direction.value": "全栈开发与效率工具",
      "fact.status": "状态",
      "fact.status.value": "持续开源与分享",
      "fact.base": "常驻",
      "fact.base.value": "浙江 / 远程",
      "fact.focus": "关注",
      "fact.focus.value": "可用性 · 自动化 · 小工具",
      "contact.title": "联系我",
      "footer.copyright": "©",
      "footer.suffix": "用代码把复杂问题变简单",
      "footer.email": "邮箱",
      "widgets.rightside": "右侧工具",
      "widgets.config": "打开右侧工具",
      "widgets.config.close": "收起右侧工具",
      "widgets.goUp": "回到顶部"
    },
    en: {
      "title": "Zenith01888's Personal Site",
      "meta.description": "Zenith's personal homepage: projects, learning notes, and what I'm working on.",
      "skip": "Skip to main content",
      "nav.aria": "Main navigation",
      "nav.tools": "Tools",
      "nav.tools.pdfmerge": "Pdfmerge",
      "nav.tools.pwm": "PWM Monitor",
      "nav.tools.oscilloscope": "Oscilloscope",
      "nav.projects": "Projects",
      "nav.about": "About",
      "nav.contact": "Contact",
      "nav.toggle.open": "Open menu",
      "nav.toggle.close": "Close menu",
      "lang.toggle": "中文",
      "lang.aria": "Switch to Chinese",
      "theme.dark": "Switch to dark mode",
      "theme.light": "Switch to light mode",
      "bw.aria": "Toggle black & white display",
      "hero.subtitle": "Projects, learning notes, and things in progress",
      "hero.scroll": "Scroll down",
      "recent.aria": "Recent projects",
      "tags.aria": "Project tags",
      "recent.title": "Recent Projects",
      "recent.viewAll": "View all",
      "pagination.aria": "Project pagination",
      "pagination.prev": "Previous",
      "pagination.next": "Next",
      "pagination.page": "Page",
      "project.pdfmerge.aria": "Open Pdfmerge tool",
      "project.pdfmerge.cover": "Pdfmerge project cover",
      "project.pdfmerge.title": "Pdfmerge",
      "project.pdfmerge.date": "Updated 2026-08-14",
      "project.pdfmerge.meta": "Tools · Open Source",
      "project.pdfmerge.desc": "A PDF merge tool that runs entirely in your browser: drag in PDFs, reorder them, merge, and download. Files never leave your device.",
      "project.use": "Use online",
      "project.view": "Project page",
      "project.viewRepo": "View repo",
      "project.pwm.aria": "Open PWM Monitor tool",
      "project.pwm.cover": "PWM Monitor project cover",
      "project.pwm.title": "PWM Monitor",
      "project.pwm.date": "Updated 2026-08-14",
      "project.pwm.meta": "Tools · Web Serial",
      "project.pwm.desc": "Connect a dev board over Web Serial to capture and monitor PWM frequency and duty cycle in real time, with channel toggles, statistics, and Excel export.",
      "project.oscilloscope.aria": "Open oscilloscope tool",
      "project.oscilloscope.cover": "Oscilloscope console project cover",
      "project.oscilloscope.title": "Oscilloscope Console",
      "project.oscilloscope.date": "Updated 2026-08-14",
      "project.oscilloscope.meta": "Tools · Python",
      "project.oscilloscope.desc": "An oscilloscope web console built with Python, Flask, and PyVISA, supporting YOKOGAWA DLM2024 / RIGOL / Keysight with real-time 4-channel measurements and Excel export.",
      "project.portfolio.aria": "Personal site project",
      "project.portfolio.cover": "Personal site project cover",
      "project.portfolio.title": "Personal Site",
      "project.portfolio.date": "Updated 2026-08-14",
      "project.portfolio.meta": "Site · GitHub Pages",
      "project.portfolio.desc": "A zero-dependency personal homepage built with vanilla HTML, CSS, and JavaScript in a blog-style layout, ready to deploy to GitHub Pages.",
      "project.visit": "Visit site",
      "project.lab.aria": "Mini tool lab project",
      "project.lab.cover": "Mini tool lab project cover",
      "project.lab.title": "Mini Tool Lab",
      "project.lab.date": "Planned",
      "project.lab.meta": "Lab · Open Source",
      "project.lab.desc": "A collection of small, reliable tools built from everyday problems, capturing ideas, experiments, and reusable code snippets.",
      "project.follow": "Follow",
      "aside.projects": "Projects",
      "aside.sites": "Sites",
      "aside.ideas": "Ideas",
      "aside.avatar.alt": "Zenith01888 avatar",
      "aside.description": "Full-stack developer · Efficiency tools fan",
      "aside.github": "GitHub",
      "aside.email": "Email",
      "aside.about": "About me",
      "aside.recentProjects": "Recent Projects",
      "aside.recent.pdfmerge": "Pdfmerge",
      "aside.recent.pdfmerge.date": "2026-08-14",
      "aside.recent.pwm": "PWM Monitor",
      "aside.recent.pwm.date": "2026-08-14",
      "aside.recent.oscilloscope": "Oscilloscope Console",
      "aside.recent.oscilloscope.date": "2026-08-14",
      "aside.recent.portfolio": "Personal Site",
      "aside.recent.portfolio.date": "2026-08-14",
      "aside.recent.lab": "Mini Tool Lab",
      "aside.recent.lab.date": "Planned",
      "aside.categories": "Categories",
      "category.pdf": "PDF Tools",
      "category.serial": "Web Serial",
      "category.oscilloscope": "Oscilloscope",
      "category.pages": "GitHub Pages",
      "aside.tagCloud": "Tag Cloud",
      "aside.siteInfo": "Site Info",
      "info.projects": "Projects",
      "info.categories": "Categories",
      "info.tags": "Tags",
      "info.built": "Built",
      "about.title": "About me",
      "about.p1": "I'm a developer focused on web engineering and practical tools, and I enjoy turning everyday problems into small, dependable products.",
      "about.p2": "This page records my projects, interests, and what I'm working on. Everything stays small and clear, just like the tools I build.",
      "fact.direction": "Direction",
      "fact.direction.value": "Full-stack & efficiency tools",
      "fact.status": "Status",
      "fact.status.value": "Open source, keep sharing",
      "fact.base": "Based in",
      "fact.base.value": "Zhejiang / Remote",
      "fact.focus": "Focus",
      "fact.focus.value": "Usability · Automation · Mini tools",
      "contact.title": "Contact",
      "footer.copyright": "©",
      "footer.suffix": "Turning complex problems into simple tools",
      "footer.email": "Email",
      "widgets.rightside": "Side tools",
      "widgets.config": "Open side tools",
      "widgets.config.close": "Close side tools",
      "widgets.goUp": "Back to top"
    }
  };

  const nav = document.getElementById("siteNav");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const toolsMenuToggle = document.getElementById("toolsMenuToggle");
  const toolsDropdown = document.getElementById("toolsDropdown");
  const year = document.getElementById("year");
  const langToggle = document.getElementById("langToggle");
  const themeToggle = document.getElementById("themeToggle");
  const bwToggle = document.getElementById("bwToggle");
  const themeColor = document.getElementById("themeColor");
  const pagination = document.getElementById("pagination");
  const rightside = document.getElementById("rightside");
  const rightsideConfig = document.getElementById("rightsideConfig");
  const rightsideConfigHide = document.getElementById("rightside-config-hide");
  const goUp = document.getElementById("goUp");
  const scrollPercent = document.getElementById("scrollPercent");
  const projectItems = Array.from(document.querySelectorAll("#recent-posts > .recent-post-item"));
  const pageSize = 3;
  let currentPage = 1;

  const getStored = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const setStored = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // localStorage can be unavailable in privacy mode; the in-page state still works.
    }
  };

  let currentLang = getStored(LANG_KEY) || "zh";
  if (currentLang !== "zh" && currentLang !== "en") currentLang = "zh";

  const closeSideTools = () => {
    if (!rightsideConfigHide) return;
    rightsideConfigHide.classList.remove("show");
    rightsideConfigHide.setAttribute("aria-hidden", "true");
    if (rightsideConfig) rightsideConfig.classList.remove("active");
    updateWidgetLabels();
  };

  const updateWidgetLabels = () => {
    const dict = I18N[currentLang];
    const theme = document.documentElement.dataset.theme || "light";

    if (themeToggle) {
      const key = theme === "dark" ? "theme.light" : "theme.dark";
      themeToggle.setAttribute("aria-label", dict[key]);
      themeToggle.setAttribute("title", dict[key]);
      themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }

    if (bwToggle) {
      const on = document.body.classList.contains("bw-mode");
      bwToggle.setAttribute("aria-label", dict["bw.aria"]);
      bwToggle.setAttribute("title", dict["bw.aria"]);
      bwToggle.setAttribute("aria-pressed", on ? "true" : "false");
    }

    if (langToggle) {
      langToggle.setAttribute("aria-label", dict["lang.aria"]);
      langToggle.setAttribute("title", dict["lang.aria"]);
    }

    if (navToggle) {
      const isOpen = navLinks && navLinks.classList.contains("open");
      navToggle.setAttribute("aria-label", isOpen ? dict["nav.toggle.close"] : dict["nav.toggle.open"]);
    }

    if (rightsideConfig) {
      const isOpen = rightsideConfigHide && rightsideConfigHide.classList.contains("show");
      const key = isOpen ? "widgets.config.close" : "widgets.config";
      rightsideConfig.setAttribute("aria-label", dict[key]);
      rightsideConfig.setAttribute("title", dict[key]);
    }
  };

  const applyLanguage = (lang, persist = true) => {
    currentLang = lang;
    const dict = I18N[currentLang];
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.lang = currentLang;
    document.title = dict.title;

    if (persist) setStored(LANG_KEY, currentLang);

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (dict[key] != null) element.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
      element.dataset.i18nAttr.split(",").forEach((pair) => {
        const separator = pair.indexOf(":");
        if (separator < 0) return;
        const attr = pair.slice(0, separator).trim();
        const key = pair.slice(separator + 1).trim();
        if (dict[key] != null) element.setAttribute(attr, dict[key]);
      });
    });

    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", dict["meta.description"]);

    updateWidgetLabels();
    renderPagination();
  };

  const applyTheme = (theme, persist = true) => {
    document.documentElement.dataset.theme = theme;
    if (persist) setStored(THEME_KEY, theme);
    if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#10151c" : "#ffffff");
    updateWidgetLabels();
  };

  const applyBw = (on, persist = true) => {
    document.body.classList.toggle("bw-mode", on);
    if (persist) setStored(BW_KEY, on ? "on" : "off");
    updateWidgetLabels();
  };

  function showPage(page) {
    const totalPages = Math.max(1, Math.ceil(projectItems.length / pageSize));
    currentPage = Math.min(totalPages, Math.max(1, page));

    projectItems.forEach((item, index) => {
      const visible = index >= (currentPage - 1) * pageSize && index < currentPage * pageSize;
      item.classList.toggle("hidden", !visible);
      if (visible) item.classList.add("visible");
    });

    renderPagination();
  }

  function renderPagination() {
    if (!pagination) return;

    const totalPages = Math.max(1, Math.ceil(projectItems.length / pageSize));
    const dict = I18N[currentLang];
    pagination.innerHTML = "";

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "pagination-btn";
    prevButton.setAttribute("aria-label", dict["pagination.prev"]);
    prevButton.innerHTML = '<i data-lucide="chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener("click", () => showPage(currentPage - 1));
    pagination.appendChild(prevButton);

    for (let page = 1; page <= totalPages; page += 1) {
      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.className = "page-number";
      pageButton.textContent = String(page);
      pageButton.setAttribute("aria-label", `${dict["pagination.page"]} ${page}`);
      if (page === currentPage) {
        pageButton.classList.add("current");
        pageButton.setAttribute("aria-current", "page");
      }
      pageButton.addEventListener("click", () => showPage(page));
      pagination.appendChild(pageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "pagination-btn";
    nextButton.setAttribute("aria-label", dict["pagination.next"]);
    nextButton.innerHTML = '<i data-lucide="chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener("click", () => showPage(currentPage + 1));
    pagination.appendChild(nextButton);

    if (window.lucide) window.lucide.createIcons();
  }

  let initialTheme = getStored(THEME_KEY);
  if (!initialTheme) {
    initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  applyTheme(initialTheme, false);
  applyLanguage(currentLang, false);
  applyBw(getStored(BW_KEY) === "on", false);

  const onScroll = () => {
    nav.classList.toggle("scrolled", window.scrollY > 40);
    if (rightside) rightside.classList.toggle("show", window.scrollY > 56);
    if (scrollPercent) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollPercent.textContent = max > 0 ? String(Math.round((window.scrollY / max) * 100)) : "0";
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const closeToolsMenu = () => {
    if (!toolsDropdown) return;
    toolsDropdown.classList.remove("open");
    if (toolsMenuToggle) toolsMenuToggle.setAttribute("aria-expanded", "false");
  };

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      updateWidgetLabels();
      closeToolsMenu();
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        updateWidgetLabels();
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
        closeSideTools();
      }
    });
  }

  if (rightsideConfig && rightsideConfigHide) {
    rightsideConfig.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = rightsideConfigHide.classList.toggle("show");
      rightsideConfigHide.setAttribute("aria-hidden", String(!isOpen));
      rightsideConfig.classList.toggle("active", isOpen);
      updateWidgetLabels();
    });

    document.addEventListener("click", (event) => {
      if (rightside && !rightside.contains(event.target)) {
        closeSideTools();
      }
    });
  }

  if (goUp) {
    goUp.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (langToggle) {
    langToggle.addEventListener("click", () => {
      applyLanguage(currentLang === "zh" ? "en" : "zh");
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  if (bwToggle) {
    bwToggle.addEventListener("click", () => {
      applyBw(!document.body.classList.contains("bw-mode"));
    });
  }

  showPage(currentPage);

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
