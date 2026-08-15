(function () {
  "use strict";

  // 在这里替换成你自己的网易云歌单 ID。
  // 例如歌单链接 https://music.163.com/#/playlist?id=12275290957 中的 12275290957。
  var DEFAULT_PLAYLIST_ID = "12275290957";

  var STORAGE_KEY = "zenith-study-room-v2";
  var PANEL_OPEN_CLASS = "netease-panel-open";

  var button = null;
  var panel = null;
  var stage = null;
  var closeBtn = null;
  var metingNode = null;
  var loadTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function normalizePlaylistId(value, fallback) {
    var text = String(value || "").trim();
    var urlMatch = text.match(/id=(\d+)/i);
    var directMatch = text.match(/^\d+$/);
    if (urlMatch) return urlMatch[1];
    if (directMatch) return directMatch[0];
    return fallback || DEFAULT_PLAYLIST_ID;
  }

  function readSavedPlaylistId() {
    var input = $("setNetease");
    if (input && String(input.value || "").trim()) {
      return normalizePlaylistId(input.value, DEFAULT_PLAYLIST_ID);
    }
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem("zenith-study-room-v1") || "null");
      if (data && data.settings && data.settings.neteaseId) {
        return normalizePlaylistId(data.settings.neteaseId, DEFAULT_PLAYLIST_ID);
      }
    } catch (error) {
      // Ignore malformed local storage.
    }
    return DEFAULT_PLAYLIST_ID;
  }

  function isReady() {
    return !!(window.APlayer && (window.MetingJSElement || (window.customElements && window.customElements.get("meting-js"))));
  }

  function ensureAPlayerStyles() {
    if (document.querySelector("link[data-aplayer-css]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css";
    link.setAttribute("data-aplayer-css", "1");
    document.head.appendChild(link);
  }

  function showLoading() {
    var loading = document.createElement("div");
    loading.className = "netease-loading";
    var spinner = document.createElement("span");
    spinner.className = "netease-spinner";
    var text = document.createElement("span");
    text.textContent = "正在加载网易云歌单";
    loading.appendChild(spinner);
    loading.appendChild(text);
    stage.textContent = "";
    stage.appendChild(loading);
  }

  function showError() {
    if (metingNode) {
      try {
        metingNode.remove();
      } catch (error) {
        // The element may already be detached.
      }
      metingNode = null;
    }
    stage.textContent = "";
    var error = document.createElement("div");
    error.className = "netease-error";
    error.textContent = "歌单加载失败，请检查歌单 ID 或网络";
    stage.appendChild(error);
  }

  function clearLoadTimer() {
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
  }

  function watchPlayerLoad() {
    clearLoadTimer();
    var observer = new MutationObserver(function () {
      if (stage.querySelector(".aplayer")) {
        observer.disconnect();
        clearLoadTimer();
        var loading = stage.querySelector(".netease-loading");
        if (loading) loading.remove();
      }
    });
    observer.observe(stage, { childList: true, subtree: true });
    loadTimer = setTimeout(function () {
      observer.disconnect();
      if (!stage.querySelector(".aplayer") && stage.querySelector("meting-js")) {
        showError();
      }
    }, 15000);
  }

  function load(id) {
    if (!stage) return;
    ensureAPlayerStyles();
    if (!isReady()) {
      showError();
      return;
    }
    var playlistId = normalizePlaylistId(id, readSavedPlaylistId());
    window.studyRoomNeteaseId = playlistId;
    clearLoadTimer();
    if (metingNode) {
      try {
        metingNode.remove();
      } catch (error) {
        // The element may already be detached.
      }
      metingNode = null;
    }
    showLoading();

    // MetingJS 负责解析歌单，APlayer 负责渲染播放器。
    metingNode = document.createElement("meting-js");
    metingNode.setAttribute("server", "netease");
    metingNode.setAttribute("type", "playlist");
    metingNode.setAttribute("id", playlistId);
    metingNode.setAttribute("autoplay", "true");
    metingNode.setAttribute("preload", "auto");
    metingNode.setAttribute("theme", "#38d9c0");
    metingNode.setAttribute("mutex", "true");
    metingNode.setAttribute("order", "list");
    metingNode.setAttribute("list-folded", "false");
    metingNode.setAttribute("list-max-height", "220px");
    metingNode.setAttribute("storage-name", "zenith-netease-player");
    stage.appendChild(metingNode);
    watchPlayerLoad();
  }

  function isOpen() {
    return panel && panel.classList.contains("open");
  }

  function open() {
    if (!panel) return;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add(PANEL_OPEN_CLASS);
    if (button) {
      button.setAttribute("aria-expanded", "true");
      button.classList.add("active");
    }
    if (!stage.querySelector(".aplayer") && !stage.querySelector("meting-js")) {
      load(readSavedPlaylistId());
    }
  }

  function close() {
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove(PANEL_OPEN_CLASS);
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.classList.remove("active");
    }
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  function stop() {
    clearLoadTimer();
    if (metingNode) {
      try {
        metingNode.remove();
      } catch (error) {
        // The element may already be detached.
      }
      metingNode = null;
    }
    if (stage) stage.textContent = "";
    close();
  }

  function handleKeydown(event) {
    var key = String(event.key || "").toLowerCase();
    if (key !== "m") return;
    var target = event.target;
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || (target && target.isContentEditable)) return;
    event.preventDefault();
    toggle();
  }

  function init() {
    button = $("neteaseFloatBtn");
    panel = $("neteasePanel");
    stage = $("neteaseStage");
    closeBtn = $("neteasePanelClose");
    if (button) button.addEventListener("click", toggle);
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", handleKeydown);

    // 公共 Meting API 偶发不稳定，可换成你自建的 Meting API 地址。
    window.meting_api = "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r";
  }

  init();

  window.studyRoomNetEase = {
    load: load,
    open: open,
    close: close,
    toggle: toggle,
    stop: stop
  };
})();