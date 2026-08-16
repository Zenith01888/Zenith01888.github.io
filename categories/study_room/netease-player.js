(function () {
  "use strict";

  // 在这里替换成你自己的网易云歌单 ID。
  // 例如歌单链接 https://music.163.com/#/playlist?id=12275290957 中的 12275290957。
  var DEFAULT_PLAYLIST_ID = "12275290957";

  // 多个公共解析接口会按顺序自动尝试，一个失效就换下一个。
  var METING_APIS = [
    "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
    "https://meting-ve.2333332.xyz/api?server=:server&type=:type&id=:id&r=:r",
    "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r"
  ];
  var API_TIMEOUT = 12000;
  var PLAYER_READY_TIMEOUT = 20000;

  var STORAGE_KEY = "zenith-study-room-v2";
  var PANEL_OPEN_CLASS = "netease-panel-open";

  var button = null;
  var panel = null;
  var stage = null;
  var closeBtn = null;
  var player = null;
  var pendingLoad = 0;
  var readyTimer = null;

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
    return !!window.APlayer;
  }

  function ensureAPlayerStyles() {
    if (document.querySelector("link[data-aplayer-css]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css";
    link.setAttribute("data-aplayer-css", "1");
    document.head.appendChild(link);
  }

  function clearReadyTimer() {
    if (readyTimer) {
      clearInterval(readyTimer);
      readyTimer = null;
    }
  }

  function clearPlayer() {
    pendingLoad += 1;
    clearReadyTimer();
    if (player) {
      try {
        player.destroy();
      } catch (error) {
        // The player may already be destroyed.
      }
      player = null;
    }
    if (stage) stage.textContent = "";
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
    clearPlayer();
    var error = document.createElement("div");
    error.className = "netease-error";
    error.textContent = "歌单加载失败，请检查歌单 ID 或网络";
    stage.appendChild(error);
  }

  function buildApiUrl(template, playlistId) {
    return template
      .replace(":server", "netease")
      .replace(":type", "playlist")
      .replace(":id", encodeURIComponent(playlistId))
      .replace(":auth", "")
      .replace(":r", Math.random());
  }

  function fetchPlaylist(api, playlistId) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, API_TIMEOUT);
    return fetch(buildApiUrl(api, playlistId), { signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        if (!Array.isArray(data) || !data.length) throw new Error("empty playlist");
        return data;
      })
      .catch(function (error) {
        clearTimeout(timer);
        throw error;
      });
  }

  function renderPlayer(tracks) {
    if (!window.APlayer) {
      showError();
      return;
    }
    clearPlayer();
    var box = document.createElement("div");
    stage.appendChild(box);
    try {
      player = new APlayer({
        container: box,
        audio: tracks,
        autoplay: true,
        preload: "auto",
        theme: "#38d9c0",
        mutex: true,
        order: "list",
        listFolded: false,
        listMaxHeight: "220px",
        storageName: "zenith-netease-player",
        lrcType: 3
      });
    } catch (error) {
      showError();
    }
  }

  function showFallbackPlayer(playlistId) {
    clearPlayer();
    var fallback = document.createElement("div");
    fallback.className = "netease-fallback";
    var note = document.createElement("p");
    note.textContent = "歌单解析服务暂不可用，已切换为网易云官方播放器";
    var frame = document.createElement("iframe");
    frame.className = "netease-outchain";
    frame.src = "https://music.163.com/outchain/player?type=2&id=" + encodeURIComponent(playlistId) + "&auto=1&height=430";
    frame.title = "网易云音乐歌单播放器";
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("allow", "autoplay; fullscreen");
    fallback.appendChild(note);
    fallback.appendChild(frame);
    stage.appendChild(fallback);
  }

  function loadFromApis(playlistId, index, token) {
    if (token !== pendingLoad || !stage) return;
    if (index >= METING_APIS.length) {
      showFallbackPlayer(playlistId);
      return;
    }
    fetchPlaylist(METING_APIS[index], playlistId)
      .then(function (tracks) {
        if (token !== pendingLoad) return;
        renderPlayer(tracks);
      })
      .catch(function () {
        if (token !== pendingLoad) return;
        loadFromApis(playlistId, index + 1, token);
      });
  }

  function waitForPlayer(playlistId, callback) {
    if (isReady()) {
      callback();
      return;
    }
    clearReadyTimer();
    var waited = 0;
    readyTimer = setInterval(function () {
      waited += 200;
      if (isReady()) {
        clearReadyTimer();
        callback();
      } else if (waited >= PLAYER_READY_TIMEOUT) {
        clearReadyTimer();
        showFallbackPlayer(playlistId);
      }
    }, 200);
  }

  function load(id) {
    if (!stage) return;
    ensureAPlayerStyles();
    clearPlayer();
    var playlistId = normalizePlaylistId(id, readSavedPlaylistId());
    window.studyRoomNeteaseId = playlistId;
    showLoading();
    var token = pendingLoad;
    waitForPlayer(playlistId, function () {
      if (token !== pendingLoad) return;
      loadFromApis(playlistId, 0, token);
    });
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
    if (!stage.querySelector(".aplayer") && !stage.querySelector(".netease-fallback") && !stage.querySelector(".netease-loading")) {
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
    clearPlayer();
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

    window.meting_api = METING_APIS[0];
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