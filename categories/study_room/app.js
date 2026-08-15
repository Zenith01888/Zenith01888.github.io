(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };

  var STORAGE_KEY = "zenith-study-room-v2";
  var QUOTES = [
    "把注意力放在眼前这一件事上。",
    "一次只做一件事，做完再抬头。",
    "今天学到的每一分钟都会留下痕迹。",
    "慢慢来，比较快。",
    "保持节奏，而不是追赶。",
    "房间安静下来，思路才会变清楚。",
  ];
  var CHAT_REPLIES = [
    "收到，我把它记下来了。",
    "专注完这一轮再回来看看。",
    "房间里只有你的呼吸声和键盘声。",
    "好的，保持这个节奏。",
    "现在很适合把最难的一题写完。",
  ];
  var MODE_LABELS = {
    focus: "专注",
    break: "休息",
    long: "长休息",
    timer: "计时器",
  };

  var DEFAULTS = {
    settings: {
      focusMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      rounds: 4,
      timerType: "pomodoro",
      autoBreak: true,
      strictMode: false,
      showTips: true,
      neteaseId: "12275290957",
      volume: 55,
      sound: "none",
    },
    todos: [],
    stats: {
      totalSeconds: 0,
      sessions: 0,
      longestSeconds: 0,
      history: {},
    },
    chat: [],
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem("zenith-study-room-v1");
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var parsed = JSON.parse(raw);
      var base = JSON.parse(JSON.stringify(DEFAULTS));
      base.settings = Object.assign({}, base.settings, parsed.settings || {});
      base.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
      base.stats = Object.assign({}, base.stats, parsed.stats || {});
      base.chat = Array.isArray(parsed.chat) ? parsed.chat : [];
      return base;
    } catch (error) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  var state = loadState();
  var timer = {
    running: false,
    mode: state.settings.timerType === "timer" ? "timer" : "focus",
    remaining: state.settings.focusMin * 60,
    total: state.settings.focusMin * 60,
    round: 1,
    endsAt: null,
    lastTickAt: 0,
    sessionElapsed: 0,
    sessionRest: 0,
    interval: null,
  };

  var audioCtx = null;
  var master = null;
  var activeSound = "none";
  var ambientNodes = [];
  var ambientTimers = [];
  var quoteIndex = Math.floor(Math.random() * QUOTES.length);
  var chatReplyIndex = 0;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Storage can be unavailable; in-page state still works.
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
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

  function applyScene() {
    var bg = $("roomBg");
    if (bg) bg.style.backgroundImage = 'url("assets/p1.webp")';
  }

  function modeSeconds(mode) {
    if (mode === "break") return state.settings.breakMin * 60;
    if (mode === "long") return (state.settings.longBreakMin || 15) * 60;
    return state.settings.focusMin * 60;
  }

  function renderTimerUI() {
    if (state.settings.timerType === "timer" && timer.mode !== "timer") {
      timer.mode = "timer";
    }
    timer.total = modeSeconds(timer.mode);
    $("timeText").textContent = fmtTime(timer.remaining);
    $("navTime").textContent = fmtTime(timer.remaining);
    $("modeBadge").textContent = MODE_LABELS[timer.mode] || "专注";
    $("navMode").textContent = state.settings.timerType === "timer" ? "计时器" : "番茄钟";

    var cycle = timer.mode === "focus"
      ? ((timer.round - 1) % state.settings.rounds) + 1
      : timer.round;
    if (timer.mode === "focus") {
      $("roundText").textContent = "第 " + cycle + " / " + state.settings.rounds + " 轮";
      $("navStatus").textContent = timer.running ? "专注中" : "等待开始";
    } else if (timer.mode === "timer") {
      $("roundText").textContent = "倒计时";
      $("navStatus").textContent = timer.running ? "计时中" : "等待开始";
    } else {
      $("roundText").textContent = timer.mode === "long" ? "长休息" : "休息中";
      $("navStatus").textContent = "休息中";
    }

    var progress = timer.total > 0
      ? Math.max(0, Math.min(1, 1 - timer.remaining / timer.total))
      : 0;
    $("timerRing").style.setProperty("--progress", progress.toFixed(4));

    var primary = $("primaryTimer");
    primary.innerHTML = '<i data-lucide="' + (timer.running ? "pause" : "play") + '"></i>';
    refreshIcons();
  }

  function clearTimerInterval() {
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }
  }

  function switchMode(mode, keepRemaining) {
    pauseTimer();
    if (state.settings.timerType === "timer" && mode === "focus") mode = "timer";
    timer.mode = mode;
    timer.remaining = keepRemaining ? timer.remaining : modeSeconds(mode);
    timer.total = modeSeconds(mode);
    timer.sessionElapsed = 0;
    timer.sessionRest = 0;
    renderTimerUI();
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

  function resetTimer() {
    pauseTimer();
    timer.mode = state.settings.timerType === "timer" ? "timer" : "focus";
    timer.remaining = modeSeconds(timer.mode);
    timer.total = modeSeconds(timer.mode);
    timer.round = 1;
    timer.sessionElapsed = 0;
    timer.sessionRest = 0;
    renderTimerUI();
  }

  function tick() {
    var now = Date.now();
    if (timer.lastTickAt) {
      var dt = (now - timer.lastTickAt) / 1000;
      if (dt > 0 && dt < 10) {
        if (timer.mode === "focus") timer.sessionElapsed += dt;
        else if (timer.mode === "timer") timer.sessionElapsed += dt;
        else timer.sessionRest += dt;
      }
    }
    timer.lastTickAt = now;
    timer.remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
    renderTimerUI();
    if (timer.remaining <= 0) completeTimer();
  }

  function recordFocus(seconds) {
    state.stats.sessions += 1;
    state.stats.totalSeconds += seconds;
    state.stats.longestSeconds = Math.max(state.stats.longestSeconds, seconds);
    var key = todayKey();
    state.stats.history[key] = (state.stats.history[key] || 0) + seconds;
    save();
    renderStats();
  }

  function completeTimer() {
    clearTimerInterval();
    timer.running = false;
    timer.endsAt = null;
    timer.lastTickAt = 0;

    if (timer.mode === "focus") {
      var seconds = Math.max(1, Math.round(timer.sessionElapsed));
      recordFocus(seconds);
      var nextMode = timer.round % state.settings.rounds === 0 ? "long" : "break";
      timer.round += 1;
      timer.sessionElapsed = 0;
      playBell();
      showToast("专注完成，本次学习 " + fmtShort(seconds));
      switchMode(nextMode, false);
      if (state.settings.autoBreak) startTimer();
    } else if (timer.mode === "timer") {
      var timerSeconds = Math.max(1, Math.round(timer.sessionElapsed));
      recordFocus(timerSeconds);
      timer.sessionElapsed = 0;
      playBell();
      showToast("计时完成，本次专注 " + fmtShort(timerSeconds));
      resetTimer();
    } else {
      var restSeconds = Math.max(1, Math.round(timer.sessionRest));
      timer.sessionRest = 0;
      showToast("休息结束，已休息 " + fmtShort(restSeconds));
      switchMode("focus", false);
      if (state.settings.autoBreak) startTimer();
    }
  }

  function renderTasks() {
    var list = $("taskList");
    if (!state.todos.length) {
      list.innerHTML = '<li class="task-row"><span class="task-text">写下今天的第一个任务</span></li>';
    } else {
      list.innerHTML = state.todos.map(function (task) {
        return (
          '<li class="task-row' + (task.done ? " done" : "") + '" data-id="' + task.id + '">' +
            '<button class="task-check" type="button" data-action="toggle" title="完成" aria-label="完成">' +
              '<i data-lucide="check"></i>' +
            "</button>" +
            '<span class="task-text">' + escapeHtml(task.text) + "</span>" +
            '<button class="icon-btn' + (task.pinned ? " green" : "") + '" type="button" data-action="pin" title="固定" aria-label="固定">' +
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
    $("pinnedTask").textContent = pinned ? pinned.text : "还没有固定任务";
    refreshIcons();
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
        '<div class="heat-cell ' + level + '" title="' + labels[(date.getDay() + 6) % 7] + " " + fmtShort(sec) + '"></div>'
      );
    }
    $("weekHeat").innerHTML = cells.join("");
  }

  function renderHint() {
    var text = state.settings.showTips
      ? "「" + QUOTES[quoteIndex % QUOTES.length] + "」"
      : "云上自习室 · Local-first";
    $("hintText").textContent = text;
  }

  function nextHint() {
    quoteIndex = (quoteIndex + 1) % QUOTES.length;
    renderHint();
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

  function stopAmbient() {
    ambientTimers.forEach(function (id) {
      clearInterval(id);
    });
    ambientTimers = [];
    ambientNodes.forEach(function (node) {
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
    ambientNodes = [];
    activeSound = "none";
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
    gain.gain.value = 0.22;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    ambientNodes.push(source, filter, gain);
  }

  function makeCafe(ctx) {
    var source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 2);
    source.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    var gain = ctx.createGain();
    gain.gain.value = 0.14;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    ambientNodes.push(source, filter, gain);

    var timerId = setInterval(function () {
      if (!audioCtx) return;
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 1500 + Math.random() * 1200;
      var clink = audioCtx.createGain();
      clink.gain.setValueAtTime(0.0001, now);
      clink.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
      clink.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(clink);
      clink.connect(master);
      osc.start(now);
      osc.stop(now + 0.12);
      ambientNodes.push(osc, clink);
    }, 1200 + Math.random() * 900);
    ambientTimers.push(timerId);
  }

  function startAmbient(type) {
    if (type === "none") {
      stopAmbient();
      state.settings.sound = "none";
      save();
      return;
    }
    var ctx = ensureAudio();
    if (!ctx) return;
    stopAmbient();
    activeSound = type;
    if (type === "rain") makeRain(ctx);
    if (type === "cafe") makeCafe(ctx);
    state.settings.sound = type;
    save();
    updateSoundButtons();
  }

  function updateSoundButtons() {
    document.querySelectorAll(".sound-grid button").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.sound === activeSound);
    });
  }

  function playBell() {
    var ctx = ensureAudio();
    if (!ctx || !master) return;
    var now = ctx.currentTime;
    [880, 1320].forEach(function (frequency, index) {
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.14, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.7);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.8);
    });
  }

  function parseNeteaseId(value) {
    var text = String(value || "").trim();
    var urlMatch = text.match(/id=(\d+)/i);
    var directMatch = text.match(/^\d+$/);
    if (urlMatch) return urlMatch[1];
    if (directMatch) return directMatch[0];
    return state.settings.neteaseId || "12275290957";
  }

  function openNeteasePlayer() {
    var playlistId = parseNeteaseId($("setNetease").value);
    state.settings.neteaseId = playlistId;
    save();
    $("neteaseStatus").textContent = "已绑定歌单 " + playlistId;
    if (window.studyRoomNetEase) {
      window.studyRoomNetEase.load(playlistId);
      window.studyRoomNetEase.open();
      showToast("网易云歌单已打开", 1600);
    } else {
      showToast("播放器组件尚未加载完成", 2200);
    }
  }

  function renderChat() {
    if (!state.chat.length) {
      state.chat = [{ role: "mate", name: "Room Mate", text: "晚上好，先把今天的任务写下来吧。" }];
    }
    var log = $("chatLog");
    log.innerHTML = state.chat.map(function (message) {
      var name = message.role === "me" ? "你" : (message.name || "Room Mate");
      return (
        '<div class="chat-bubble' + (message.role === "me" ? " mine" : "") + '">' +
          '<span class="chat-name">' + escapeHtml(name) + "</span>" +
          escapeHtml(message.text) +
        "</div>"
      );
    }).join("");
    log.scrollTop = log.scrollHeight;
  }

  function sendChat(text) {
    state.chat.push({ role: "me", name: "你", text: text });
    save();
    renderChat();
    setTimeout(function () {
      state.chat.push({
        role: "mate",
        name: "Room Mate",
        text: CHAT_REPLIES[chatReplyIndex % CHAT_REPLIES.length],
      });
      chatReplyIndex += 1;
      save();
      renderChat();
    }, 700);
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "study-room-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("备份已导出", 1800);
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") throw new Error("bad backup");
        state.settings = Object.assign({}, DEFAULTS.settings, parsed.settings || {});
        state.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
        state.stats = Object.assign({}, DEFAULTS.stats, parsed.stats || {});
        state.chat = Array.isArray(parsed.chat) ? parsed.chat : [];
        save();
        refreshAll();
        showToast("备份已导入", 1800);
      } catch (error) {
        showToast("备份文件格式不正确", 2600);
      }
    };
    reader.readAsText(file);
  }

  function refreshAll() {
    document.body.classList.toggle("timer-type-simple", state.settings.timerType === "timer");
    $("setFocus").value = state.settings.focusMin;
    $("setBreak").value = state.settings.breakMin;
    $("setRounds").value = state.settings.rounds;
    $("setNetease").value = state.settings.neteaseId || "12275290957";
    $("setAuto").checked = !!state.settings.autoBreak;
    $("setStrict").checked = !!state.settings.strictMode;
    $("setTips").checked = !!state.settings.showTips;
    $("soundVolume").value = state.settings.volume;
    resetTimer();
    renderTasks();
    renderStats();
    renderHint();
    renderChat();
    updateSoundButtons();
    refreshIcons();
  }

  function saveSettings() {
    state.settings.focusMin = clampInt($("setFocus").value, 1, 120, 25);
    state.settings.breakMin = clampInt($("setBreak").value, 1, 60, 5);
    state.settings.rounds = clampInt($("setRounds").value, 1, 8, 4);
    state.settings.autoBreak = $("setAuto").checked;
    state.settings.strictMode = $("setStrict").checked;
    state.settings.showTips = $("setTips").checked;
    save();
    if (!timer.running) {
      timer.remaining = modeSeconds(timer.mode);
      timer.total = modeSeconds(timer.mode);
    }
    renderTimerUI();
    renderHint();
  }

  function switchView(name) {
    document.querySelectorAll(".view").forEach(function (view) {
      view.classList.toggle("is-active", view.dataset.view === name);
    });
    document.querySelectorAll(".side-menu button").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    if (name === "tasks") renderTasks();
    if (name === "calendar") renderStats();
    if (name === "music") updateSoundButtons();
    if (name === "chat") renderChat();
  }

  function toggleConsole() {
    var closed = document.body.classList.toggle("console-closed");
    var bar = $("topbar");
    if (bar) bar.setAttribute("aria-expanded", closed ? "false" : "true");
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

  function bindEvents() {
    $("primaryTimer").addEventListener("click", function () {
      if (timer.running) pauseTimer();
      else startTimer();
    });
    $("resetTimer").addEventListener("click", resetTimer);
    $("skipTimer").addEventListener("click", function () {
      if (state.settings.timerType === "timer") {
        resetTimer();
        return;
      }
      var next = timer.mode === "focus"
        ? (timer.round % state.settings.rounds === 0 ? "long" : "break")
        : "focus";
      switchMode(next, false);
      showToast("已切换计时", 1200);
    });

    document.querySelectorAll(".segmented button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.settings.timerType = btn.dataset.timerType;
        document.body.classList.toggle("timer-type-simple", state.settings.timerType === "timer");
        document.querySelectorAll(".segmented button").forEach(function (item) {
          var on = item === btn;
          item.classList.toggle("active", on);
          item.setAttribute("aria-selected", on ? "true" : "false");
        });
        save();
        resetTimer();
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

    document.querySelectorAll(".side-menu button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.dataset.view);
      });
    });

    $("soundGrid").addEventListener("click", function (event) {
      var button = event.target.closest("[data-sound]");
      if (!button) return;
      startAmbient(button.dataset.sound);
      showToast(button.textContent.trim() + " 已开启", 1200);
    });

    $("soundVolume").addEventListener("input", function () {
      var value = parseInt(this.value, 10) || 0;
      state.settings.volume = value;
      if (master && audioCtx) master.gain.setValueAtTime(value / 100, audioCtx.currentTime);
      save();
    });

    $("openNeteaseBtn").addEventListener("click", openNeteasePlayer);

    $("chatForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = $("chatInput");
      var value = input.value.trim();
      if (!value) return;
      sendChat(value);
      input.value = "";
    });

    $("topbar").addEventListener("click", function (event) {
      if (event.target.closest("button")) return;
      toggleConsole();
    });

    $("fullscreenBtn").addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenIcon);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state.settings.strictMode && timer.running) {
        pauseTimer();
        showToast("窗口已隐藏，专注计时已暂停", 2200);
      }
    });

    ["setFocus", "setBreak", "setRounds"].forEach(function (id) {
      $(id).addEventListener("change", saveSettings);
    });
    ["setAuto", "setStrict", "setTips"].forEach(function (id) {
      $(id).addEventListener("change", saveSettings);
    });

    $("exportDataBtn").addEventListener("click", exportData);
    $("importDataInput").addEventListener("change", function () {
      importData(this.files && this.files[0]);
      this.value = "";
    });
    $("resetDataBtn").addEventListener("click", function () {
      if (!window.confirm("确认清空待办、学习数据与聊天记录？")) return;
      state.todos = [];
      state.stats = JSON.parse(JSON.stringify(DEFAULTS.stats));
      state.chat = [];
      save();
      refreshAll();
      showToast("本地数据已清空", 1600);
    });
  }

  function init() {
    save();
    applyScene();
    document.body.classList.toggle("timer-type-simple", state.settings.timerType === "timer");
    $("setFocus").value = state.settings.focusMin;
    $("setBreak").value = state.settings.breakMin;
    $("setRounds").value = state.settings.rounds;
    $("setNetease").value = state.settings.neteaseId || "12275290957";
    $("setAuto").checked = !!state.settings.autoBreak;
    $("setStrict").checked = !!state.settings.strictMode;
    $("setTips").checked = !!state.settings.showTips;
    $("soundVolume").value = state.settings.volume;
    activeSound = "none";
    renderTimerUI();
    renderTasks();
    renderStats();
    renderHint();
    renderChat();
    updateSoundButtons();
    bindEvents();
    refreshIcons();
    setInterval(nextHint, 30000);
  }

  init();
})();