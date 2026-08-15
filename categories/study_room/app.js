(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };

  var STORAGE_KEY = "zenith-study-room-v1";
  var QUOTES = [
    "把注意力放在眼前这一件事上。",
    "一次只做一件事，做完再抬头。",
    "今天学到的每一分钟都会留下痕迹。",
    "慢慢来，比较快。",
    "保持节奏，而不是追赶。",
    "房间安静下来，思路才会变清楚。",
  ];
  var MODE_LABELS = {
    focus: "专注",
    break: "休息",
    long: "长休息",
  };
  var SCENES = {
    p1: { type: "image", src: "assets/p1.webp", label: "P1 图片" },
    p2: { type: "image", src: "assets/p2.webp", label: "P2 图片" },
    m1: { type: "video", src: "assets/m1.mp4", label: "M1 动态" },
    m2: { type: "video", src: "assets/m2.mp4", label: "M2 动态" },
  };

  var DEFAULTS = {
    settings: {
      focusMin: 25,
      breakMin: 5,
      rounds: 4,
      longBreakMin: 15,
      scene: "p1",
      sound: "rain",
      volume: 55,
      autoBreak: true,
    },
    todos: [],
    stats: {
      totalSeconds: 0,
      sessions: 0,
      longestSeconds: 0,
      history: {},
    },
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var parsed = JSON.parse(raw);
      var base = JSON.parse(JSON.stringify(DEFAULTS));
      base.settings = Object.assign({}, base.settings, parsed.settings || {});
      base.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
      base.stats = Object.assign({}, base.stats, parsed.stats || {});
      return base;
    } catch (error) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  var state = loadState();
  var timer = {
    running: false,
    mode: "focus",
    remaining: state.settings.focusMin * 60,
    total: state.settings.focusMin * 60,
    round: 1,
    endsAt: null,
    sessionElapsed: 0,
    lastTickAt: 0,
    interval: null,
  };

  var audioCtx = null;
  var master = null;
  var activeSound = "none";
  var activeNodes = [];
  var activeTimers = [];
  var soundDockTimer = null;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Storage can be unavailable; the in-page state still works.
    }
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function todayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fmtTime(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }

  function fmtShort(seconds) {
    var s = Math.max(0, Math.round(seconds));
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m";
  }

  function fmtHours(seconds) {
    var s = Math.max(0, Math.round(seconds));
    if (s < 3600) return fmtShort(s);
    return (s / 3600).toFixed(1) + "h";
  }

  function showToast(message, ms) {
    var stack = $("toastStack");
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add("removing");
      setTimeout(function () {
        el.remove();
      }, 180);
    }, ms || 2400);
  }

  function modeSeconds(mode) {
    if (mode === "break") return state.settings.breakMin * 60;
    if (mode === "long") return state.settings.longBreakMin * 60;
    return state.settings.focusMin * 60;
  }

  function applyScene() {
    var scene = state.settings.scene;
    if (!SCENES[scene]) scene = "p1";
    state.settings.scene = scene;
    document.documentElement.dataset.scene = scene;

    var cfg = SCENES[scene];
    var bg = $("roomBg");
    var video = $("roomVideo");
    var sceneSelect = $("setScene");
    if (sceneSelect) sceneSelect.value = scene;

    if (cfg.type === "video") {
      document.body.dataset.media = "video";
      video.muted = true;
      video.loop = true;
      video.src = cfg.src;
      video.load();
      video.play().catch(function () {
        // Autoplay may be blocked until the user interacts.
      });
    } else {
      document.body.dataset.media = "image";
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      if (bg) bg.style.backgroundImage = 'url("' + cfg.src + '")';
    }
  }

  function cycleScene() {
    var keys = Object.keys(SCENES);
    var index = keys.indexOf(state.settings.scene);
    var next = keys[(index + 1) % keys.length];
    state.settings.scene = next;
    applyScene();
    save();
    showToast(SCENES[next].label + " 已切换", 1200);
  }

  function renderTimerUI() {
    timer.total = modeSeconds(timer.mode);
    $("timeText").textContent = fmtTime(timer.remaining);
    $("modeBadge").textContent = MODE_LABELS[timer.mode] || "专注";

    var cycle = timer.mode === "focus"
      ? ((timer.round - 1) % state.settings.rounds) + 1
      : timer.round;
    $("roundText").textContent = timer.mode === "focus"
      ? "第 " + cycle + " / " + state.settings.rounds + " 轮"
      : (timer.mode === "long" ? "长休息" : "休息中");

    var progress = timer.total > 0
      ? Math.max(0, Math.min(1, 1 - timer.remaining / timer.total))
      : 0;
    $("timerRing").style.setProperty("--progress", progress.toFixed(4));
    $("sessionBar").style.width = (progress * 100).toFixed(2) + "%";

    var primary = $("primaryTimer");
    primary.innerHTML =
      "<span>" + (timer.running ? "暂停" : "开始") + "</span>" +
      '<i data-lucide="' + (timer.running ? "pause" : "play") + '"></i>';
    refreshIcons();
  }

  function clearTimerInterval() {
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }
  }

  function startTimer() {
    if (timer.running) return;
    if (timer.remaining <= 0) timer.remaining = modeSeconds(timer.mode);
    ensureAudio();
    timer.endsAt = Date.now() + timer.remaining * 1000;
    timer.lastTickAt = Date.now();
    timer.running = true;
    timer.interval = setInterval(tick, 250);
    renderTimerUI();
  }

  function pauseTimer() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    timer.endsAt = null;
    timer.lastTickAt = 0;
    timer.running = false;
    clearTimerInterval();
    renderTimerUI();
  }

  function tick() {
    var now = Date.now();
    if (timer.lastTickAt && timer.mode === "focus") {
      var dt = (now - timer.lastTickAt) / 1000;
      if (dt > 0 && dt < 10) timer.sessionElapsed += dt;
    }
    timer.lastTickAt = now;
    timer.remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
    renderTimerUI();
    if (timer.remaining <= 0) completeTimer();
  }

  function completeTimer() {
    clearTimerInterval();
    timer.running = false;
    timer.endsAt = null;
    timer.lastTickAt = 0;

    if (timer.mode === "focus") {
      var completed = timer.round;
      var nextMode = completed % state.settings.rounds === 0 ? "long" : "break";
      var seconds = Math.max(1, Math.round(timer.sessionElapsed));
      state.stats.sessions += 1;
      state.stats.totalSeconds += seconds;
      state.stats.longestSeconds = Math.max(state.stats.longestSeconds, seconds);
      var key = todayKey();
      state.stats.history[key] = (state.stats.history[key] || 0) + seconds;
      timer.round += 1;
      timer.sessionElapsed = 0;
      save();
      renderStats();
      playBell();
      showToast("专注完成，休息一下");
      switchMode(nextMode, false);
      if (state.settings.autoBreak) startTimer();
    } else {
      timer.sessionElapsed = 0;
      switchMode("focus", false);
      if (state.settings.autoBreak) startTimer();
    }
  }

  function resetTimer() {
    pauseTimer();
    timer.mode = timer.mode;
    timer.remaining = modeSeconds(timer.mode);
    timer.total = modeSeconds(timer.mode);
    timer.sessionElapsed = 0;
    renderTimerUI();
  }

  function switchMode(mode, keepRemaining) {
    pauseTimer();
    timer.mode = mode;
    timer.remaining = keepRemaining ? timer.remaining : modeSeconds(mode);
    timer.total = modeSeconds(mode);
    timer.sessionElapsed = 0;
    document.querySelectorAll(".mode-switch button").forEach(function (btn) {
      var on = btn.dataset.mode === (mode === "long" ? "break" : mode);
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderTimerUI();
  }

  function renderTasks() {
    var list = $("taskList");
    if (!state.todos.length) {
      list.innerHTML = '<li class="empty-tasks">写下今天的第一个任务</li>';
    } else {
      list.innerHTML = state.todos.map(function (task) {
        return (
          '<li class="task-row' + (task.done ? " done" : "") + (task.pinned ? " pinned" : "") + '" data-id="' + task.id + '">' +
            '<button class="task-check" type="button" data-action="toggle" title="完成" aria-label="完成">' +
              '<i data-lucide="check"></i>' +
            "</button>" +
            '<span class="task-text">' + escapeHtml(task.text) + "</span>" +
            '<button class="icon-btn' + (task.pinned ? " pin-active" : "") + '" type="button" data-action="pin" title="固定" aria-label="固定">' +
              '<i data-lucide="pin"></i>' +
            "</button>" +
            '<button class="icon-btn" type="button" data-action="delete" title="删除" aria-label="删除">' +
              '<i data-lucide="trash-2"></i>' +
            "</button>" +
          "</li>"
        );
      }).join("");
    }

    var open = state.todos.filter(function (task) {
      return !task.done;
    }).length;
    $("taskCount").textContent = open;
    var pinned = state.todos.find(function (task) {
      return task.pinned;
    });
    var pinnedText = pinned ? pinned.text : "还没有固定任务";
    $("pinnedTask").textContent = pinnedText;
    $("statusTask").textContent = pinnedText;
    refreshIcons();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addTask(text) {
    state.todos.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text,
      done: false,
      pinned: false,
    });
    save();
    renderTasks();
  }

  function toggleTask(id) {
    var task = state.todos.find(function (item) {
      return item.id === id;
    });
    if (!task) return;
    task.done = !task.done;
    save();
    renderTasks();
  }

  function deleteTask(id) {
    state.todos = state.todos.filter(function (item) {
      return item.id !== id;
    });
    save();
    renderTasks();
  }

  function pinTask(id) {
    var changed = false;
    state.todos.forEach(function (task) {
      if (task.id === id) {
        task.pinned = !task.pinned;
        changed = true;
      } else if (task.pinned) {
        task.pinned = false;
      }
    });
    if (changed) {
      save();
      renderTasks();
      showToast("当前目标已更新", 1500);
    }
  }

  function renderStats() {
    var todaySec = state.stats.history[todayKey()] || 0;
    $("statToday").textContent = fmtShort(todaySec);
    $("statTotal").textContent = fmtHours(state.stats.totalSeconds);
    $("statSessions").textContent = state.stats.sessions;
    $("statLongest").textContent = fmtShort(state.stats.longestSeconds);
    $("todayStatus").textContent = "今日 " + fmtShort(todaySec);
    renderWeekHeat();
  }

  function renderWeekHeat() {
    var labels = ["一", "二", "三", "四", "五", "六", "日"];
    var cells = [];
    for (var i = 6; i >= 0; i--) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      var key = todayKey(date);
      var sec = state.stats.history[key] || 0;
      var level = sec >= 3600 ? "l4" : sec >= 1800 ? "l3" : sec >= 900 ? "l2" : sec > 0 ? "l1" : "";
      cells.push(
        '<div class="heat-cell ' + level + '" data-label="' + labels[(date.getDay() + 6) % 7] + '" title="' + fmtShort(sec) + '"></div>'
      );
    }
    $("weekHeat").innerHTML = cells.join("");
  }

  function renderRoomStatus() {
    $("roomStatus").textContent = "本地专注";
    $("avatarStack").innerHTML = "<span>R</span>";
  }

  function updateClock() {
    $("clockText").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    master = audioCtx.createGain();
    master.gain.value = state.settings.volume / 100;
    master.connect(audioCtx.destination);
    return audioCtx;
  }

  function stopSound() {
    activeTimers.forEach(function (id) {
      clearInterval(id);
    });
    activeTimers = [];
    activeNodes.forEach(function (node) {
      try {
        node.stop();
      } catch (error) {
        // Some nodes do not expose stop.
      }
      try {
        node.disconnect();
      } catch (error) {
        // Already disconnected.
      }
    });
    activeNodes = [];
    activeSound = "none";
    $("soundBtn").classList.remove("active");
    $("soundBtn").setAttribute("aria-pressed", "false");
    updateSoundButtons();
  }

  function makeNoiseBuffer(ctx, seconds) {
    var buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function makeRain(ctx) {
    var source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 2);
    source.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    var gain = ctx.createGain();
    gain.gain.value = 0.24;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    activeNodes.push(source, filter, gain);
  }

  function makeCafe(ctx) {
    var source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 2);
    source.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    var gain = ctx.createGain();
    gain.gain.value = 0.16;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    activeNodes.push(source, filter, gain);

    var timer = setInterval(function () {
      if (!audioCtx) return;
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 1600 + Math.random() * 1100;
      var clink = audioCtx.createGain();
      clink.gain.setValueAtTime(0.0001, now);
      clink.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
      clink.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(clink);
      clink.connect(master);
      osc.start(now);
      osc.stop(now + 0.12);
      activeNodes.push(osc, clink);
    }, 1100 + Math.random() * 900);
    activeTimers.push(timer);
  }

  function makeLofi(ctx) {
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1500;
    filter.Q.value = 0.4;
    var gain = ctx.createGain();
    gain.gain.value = 0.12;
    filter.connect(gain);
    gain.connect(master);
    activeNodes.push(filter, gain);

    var chords = [
      [130.81, 164.81, 196.0, 246.94],
      [110.0, 164.81, 196.0, 220.0],
      [146.83, 174.61, 220.0, 261.63],
      [98.0, 146.83, 196.0, 220.0],
    ];
    var oscs = chords[0].map(function (frequency) {
      var osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      osc.connect(filter);
      osc.start();
      activeNodes.push(osc);
      return osc;
    });

    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 420;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    activeNodes.push(lfo, lfoGain);

    var chordIndex = 0;
    var timer = setInterval(function () {
      chordIndex = (chordIndex + 1) % chords.length;
      oscs.forEach(function (osc, index) {
        osc.frequency.setValueAtTime(chords[chordIndex][index], ctx.currentTime);
      });
    }, 6000);
    activeTimers.push(timer);
  }

  function startSound(type) {
    if (type === "none") {
      stopSound();
      state.settings.sound = "none";
      save();
      return;
    }
    var ctx = ensureAudio();
    if (!ctx) return;
    stopSound();
    activeSound = type;
    if (type === "rain") makeRain(ctx);
    if (type === "cafe") makeCafe(ctx);
    if (type === "lofi") makeLofi(ctx);
    state.settings.sound = type;
    save();
    $("soundBtn").classList.add("active");
    $("soundBtn").setAttribute("aria-pressed", "true");
    updateSoundButtons();
  }

  function updateSoundButtons() {
    document.querySelectorAll(".sound-option").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.sound === activeSound);
    });
  }

  function playBell() {
    var ctx = ensureAudio();
    if (!ctx) return;
    var now = ctx.currentTime;
    [880, 1320].forEach(function (frequency, index) {
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.7);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.8);
    });
  }

  function toggleSoundDock(open) {
    var dock = $("soundDock");
    if (soundDockTimer) {
      clearTimeout(soundDockTimer);
      soundDockTimer = null;
    }
    var isOpen = !dock.hidden && dock.classList.contains("show");
    var shouldOpen = open !== undefined ? open : !isOpen;
    if (shouldOpen) {
      dock.hidden = false;
      requestAnimationFrame(function () {
        dock.classList.add("show");
      });
      if (activeSound === "none" && state.settings.sound !== "none") startSound(state.settings.sound);
    } else {
      dock.classList.remove("show");
      soundDockTimer = setTimeout(function () {
        dock.hidden = true;
        soundDockTimer = null;
      }, 180);
    }
  }

  function openSettings() {
    $("setFocus").value = state.settings.focusMin;
    $("setBreak").value = state.settings.breakMin;
    $("setRounds").value = state.settings.rounds;
    $("setScene").value = state.settings.scene;
    $("setAuto").checked = !!state.settings.autoBreak;
    $("settingsDialog").hidden = false;
  }

  function closeSettings() {
    $("settingsDialog").hidden = true;
  }

  function saveSettings() {
    var focus = clampInt($("setFocus").value, 1, 120, 25);
    var breakMin = clampInt($("setBreak").value, 1, 60, 5);
    var rounds = clampInt($("setRounds").value, 1, 8, 4);
    state.settings.focusMin = focus;
    state.settings.breakMin = breakMin;
    state.settings.rounds = rounds;
    state.settings.scene = $("setScene").value;
    state.settings.autoBreak = $("setAuto").checked;
    applyScene();
    save();
    if (!timer.running) {
      timer.remaining = modeSeconds(timer.mode);
      timer.total = modeSeconds(timer.mode);
    }
    renderTimerUI();
    closeSettings();
    showToast("设置已保存", 1500);
  }

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  function updateFullscreenIcon() {
    var icon = document.fullscreenElement ? "minimize-2" : "maximize-2";
    $("fullscreenBtn").innerHTML = '<i data-lucide="' + icon + '"></i>';
    refreshIcons();
  }

  function setFocusMode(on) {
    document.body.classList.toggle("focus-mode", on);
    $("focusModeBtn").classList.toggle("active", on);
    $("focusModeBtn").setAttribute("aria-pressed", on ? "true" : "false");
    var exit = $("focusExitBtn");
    if (exit) exit.hidden = !on;
    if (on) showToast("沉浸模式已开启", 1400);
  }

  function bindEvents() {
    $("primaryTimer").addEventListener("click", function () {
      if (timer.running) pauseTimer();
      else startTimer();
    });

    $("resetTimer").addEventListener("click", resetTimer);
    $("skipTimer").addEventListener("click", function () {
      var next = timer.mode === "focus" ? "break" : "focus";
      switchMode(next, false);
      showToast("已切换计时", 1200);
    });

    document.querySelectorAll(".mode-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchMode(btn.dataset.mode, false);
      });
    });

    $("taskForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = $("taskInput");
      var value = input.value.trim();
      if (!value) return;
      addTask(value);
      input.value = "";
      input.focus();
    });

    $("taskList").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-action]");
      if (!button) return;
      var id = button.closest(".task-row").dataset.id;
      var action = button.dataset.action;
      if (action === "toggle") toggleTask(id);
      if (action === "delete") deleteTask(id);
      if (action === "pin") pinTask(id);
    });

    $("focusModeBtn").addEventListener("click", function () {
      setFocusMode(!document.body.classList.contains("focus-mode"));
    });
    $("timerRing").addEventListener("dblclick", function () {
      setFocusMode(false);
    });
    $("focusExitBtn").addEventListener("click", function () {
      setFocusMode(false);
    });

    $("soundBtn").addEventListener("click", function () {
      toggleSoundDock();
    });
    $("sceneBtn").addEventListener("click", cycleScene);
    $("soundDockClose").addEventListener("click", function () {
      toggleSoundDock(false);
    });
    $("soundGrid").addEventListener("click", function (event) {
      var button = event.target.closest("[data-sound]");
      if (!button) return;
      startSound(button.dataset.sound);
      showToast(button.textContent.trim() + " 已开启", 1200);
    });
    $("soundVolume").addEventListener("input", function () {
      var value = parseInt(this.value, 10) || 0;
      state.settings.volume = value;
      if (master && audioCtx) master.gain.setValueAtTime(value / 100, audioCtx.currentTime);
      save();
    });

    $("settingsBtn").addEventListener("click", openSettings);
    $("settingsClose").addEventListener("click", closeSettings);
    $("settingsBackdrop").addEventListener("click", closeSettings);
    $("settingsSave").addEventListener("click", saveSettings);

    $("fullscreenBtn").addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenIcon);

    $("statsReset").addEventListener("click", function () {
      if (!window.confirm("确认清空全部学习数据？")) return;
      state.stats = JSON.parse(JSON.stringify(DEFAULTS.stats));
      save();
      renderStats();
      showToast("学习数据已清空", 1500);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!$("settingsDialog").hidden) closeSettings();
      if ($("soundDock").classList.contains("show")) toggleSoundDock(false);
      if (document.body.classList.contains("focus-mode")) setFocusMode(false);
    });
  }

  function init() {
    applyScene();
    state.settings.sound = state.settings.sound || "rain";
    $("soundVolume").value = state.settings.volume;
    renderTimerUI();
    renderTasks();
    renderStats();
    renderRoomStatus();
    updateClock();
    bindEvents();
    refreshIcons();
    setInterval(updateClock, 1000);
  }

  init();
})();
