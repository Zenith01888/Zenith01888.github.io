/**
 * 示波器 Web 上位机 - 前端逻辑
 * 通道控制 / 波形与趋势 / 采集设置 / 实时统计 / 历史数据
 */

/* ============================================================
   Constants
   ============================================================ */
var CH_COLORS = { 1: "#2f7dff", 2: "#1fb873", 3: "#e3a300", 4: "#ff7a1a" };
var CHANNELS = [1, 2, 3, 4];
var $ = function(id) { return document.getElementById(id); };

var VENDOR_LABELS = { yokogawa: "YOKOGAWA", rigol: "RIGOL", keysight: "Keysight", unknown: "未知" };
var MEASURE_ROWS = [
    { label: "RMS",      key: "rms",         unit: "V", fmt: 4 },
    { label: "Max",      key: "vmax",        unit: "V", fmt: 4 },
    { label: "Min",      key: "vmin",        unit: "V", fmt: 4 },
    { label: "P-P",      key: "vpp",         unit: "V", fmt: 4 },
    { label: "Avg",      key: "voltage",     unit: "V", fmt: 4 },
    { label: "电流",      key: "current",     unit: "A", fmt: 4 },
    { label: "频率",      key: "frequency",   unit: "Hz", fmt: 2 },
    { label: "占空比",    key: "duty_cycle",  unit: "%", fmt: 2 },
    { label: "脉宽",      key: "pulse_width", unit: "s", fmt: 9 },
    { label: "上升",      key: "rise_time",   unit: "s", fmt: 9 },
    { label: "下降",      key: "fall_time",   unit: "s", fmt: 9 },
    { label: "过冲",      key: "overshoot",   unit: "%", fmt: 2 },
];
var SCALE_OPTIONS = [
    [0.002, "2 mV"], [0.005, "5 mV"], [0.01, "10 mV"], [0.02, "20 mV"],
    [0.05, "50 mV"], [0.1, "100 mV"], [0.2, "200 mV"], [0.5, "500 mV"],
    [1, "1 V"], [2, "2 V"], [5, "5 V"], [10, "10 V"],
];
var PROBE_MODELS = [
    { name: "无 (1 V/V)", sens: 1, range: 30 },
    { name: "TCP0030A (120MHz)", sens: 0.1, range: 30 },
    { name: "TCP0030A (5A)", sens: 1, range: 5 },
    { name: "TCP2020 (50MHz)", sens: 0.1, range: 20 },
    { name: "TCP312A (100MHz)", sens: 0.1, range: 30 },
    { name: "TCP305A (50MHz)", sens: 0.04, range: 50 },
    { name: "TCP404XL (2MHz)", sens: 0.01, range: 500 },
    { name: "A622 (100kHz)", sens: 0.1, range: 100 },
    { name: "通用 0.1 V/A", sens: 0.1, range: 30 },
    { name: "通用 0.01 V/A", sens: 0.01, range: 500 },
    { name: "通用 1 V/A", sens: 1, range: 5 },
];

var ICONS = {
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    "arrow-up-down": '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    "sliders-horizontal": '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pause: '<rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/>',
    play: '<path d="m6 3 14 9-14 9V3z"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
};

function icon(name) {
    var body = ICONS[name] || "";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
}

function applyIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(function(el) {
        el.innerHTML = icon(el.getAttribute("data-icon"));
    });
}

/* ============================================================
   State
   ============================================================ */
var channelNames = { 1: "通道 1", 2: "通道 2", 3: "通道 3", 4: "通道 4" };
var activeChs = { 1: true, 2: true, 3: true, 4: true };
var activeView = "voltage";
var historyCache = [];
var persistenceMode = false;
var persistenceDatasets = [];
var yAxisUnitA = false;
var lastConnected = null;
var connected = false;
var paused = false;
var currentSensitivity = { 1: 1, 2: 1, 3: 1, 4: 1 };
var chartMain = null;
var currentVendor = "unknown";
var scopeRunning = true;

/* ============================================================
   Utilities
   ============================================================ */
function fmtVal(v, digits) {
    if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "--";
    return Number(v).toFixed(digits);
}

function fmtTime(ts) {
    if (!ts) return "-";
    var parts = String(ts).split(" ");
    return parts.length === 2 ? parts[1] : ts;
}

function fmtTimebase(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
    var n = Number(v);
    if (n >= 1) return n + " s/div";
    if (n >= 0.001) return (n * 1000) + " ms/div";
    if (n >= 0.000001) return (n * 1e6) + " µs/div";
    if (n >= 0.000000001) return (n * 1e9) + " ns/div";
    return (n * 1e12) + " ps/div";
}

function fmtScale(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
    var n = Number(v);
    if (n >= 1) return n + " V/div";
    if (n >= 0.001) return (n * 1000) + " mV/div";
    return (n * 1e6) + " µV/div";
}

function fmtAxis(v) {
    var n = Number(v) || 0;
    if (Math.abs(n) >= 1) return n.toFixed(2) + " s";
    if (Math.abs(n) >= 0.001) return (n * 1000).toFixed(1) + " ms";
    if (Math.abs(n) >= 0.000001) return (n * 1e6).toFixed(1) + " µs";
    if (Math.abs(n) >= 0.000000001) return (n * 1e9).toFixed(1) + " ns";
    return (n * 1e12).toFixed(1) + " ps";
}

function popEl(el, txt) {
    if (!el) return;
    if (el.textContent !== txt) {
        el.textContent = txt;
        el.classList.remove("num-pop");
        void el.offsetWidth;
        el.classList.add("num-pop");
    }
}

function setLoading(btn, on) {
    if (!btn) return;
    if (on) { btn.classList.add("loading"); btn.disabled = true; }
    else { btn.classList.remove("loading"); btn.disabled = false; }
}

function showToast(type, msg, ms) {
    ms = ms || 3200;
    var icons = { info: "activity", success: "check", error: "activity" };
    var el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = '<span class="toast-icon">' + icon(icons[type] || "activity") + "</span>" + msg;
    $("toastContainer").appendChild(el);
    setTimeout(function() {
        el.classList.add("removing");
        setTimeout(function() { el.remove(); }, 220);
    }, ms);
}

function getCh(record, ch) {
    return (record.channels || {})[String(ch)] || (record.channels || {})[ch] || {};
}

/* ============================================================
   Channel Panel
   ============================================================ */
function buildChannelList() {
    var list = $("channelList");
    list.innerHTML = CHANNELS.map(function(ch) {
        var scaleOpts = SCALE_OPTIONS.map(function(o) {
            return '<option value="' + o[0] + '">' + o[1] + "</option>";
        }).join("");
        var probeOpts = [1, 10, 100, 1000].map(function(p) {
            return '<option value="' + p + '">' + p + "x</option>";
        }).join("");
        var pmodelOpts = PROBE_MODELS.map(function(m, i) {
            return '<option value="' + i + '">' + m.name + "</option>";
        }).join("");
        var on = activeChs[ch];
        return '<article class="ch-card' + (on ? "" : " off") + '" data-ch="' + ch + '" style="--ch-color:' + CH_COLORS[ch] + '">' +
            '<div class="ch-head">' +
                '<button class="ch-toggle' + (on ? " on" : "") + '" data-ch="' + ch + '" onclick="toggleChannel(' + ch + ')" title="启用或禁用通道">' + icon(on ? "eye" : "eye-off") + "</button>" +
                '<span class="ch-label" onclick="startRename(' + ch + ')" title="点击重命名">' + (channelNames[ch] || "通道 " + ch) + "</span>" +
                '<span class="ch-scale" id="chScale' + ch + '">--</span>' +
            "</div>" +
            '<div class="ch-value-row"><span class="ch-value" id="chRms' + ch + '">--</span><span class="ch-unit">V</span></div>' +
            '<div class="ch-submetrics">' +
                "<span><i>Vpp</i><b id=\"chVpp" + ch + "\">--</b></span>" +
                "<span><i>Freq</i><b id=\"chFreq" + ch + "\">--</b></span>" +
                "<span><i>I</i><b id=\"chCur" + ch + "\">--</b></span>" +
            "</div>" +
            '<details class="ch-details"><summary>设置</summary><div class="ch-cfg">' +
                '<div class="cfg-field"><label>V/div</label><select id="scale' + ch + '">' + scaleOpts + "</select></div>" +
                '<div class="cfg-field"><label>探头</label><select id="probe' + ch + '">' + probeOpts + "</select></div>" +
                '<div class="cfg-field"><label>耦合</label><select id="coup' + ch + '"><option value="DC" selected>DC</option><option value="AC">AC</option></select></div>' +
                '<div class="cfg-field"><label>阻抗</label><select id="imp' + ch + '"><option value="1M" selected>1 MΩ</option><option value="50">50 Ω</option></select></div>' +
                '<div class="cfg-field wide"><label>偏移 (V)</label><input id="offs' + ch + '" type="number" step="any" value="0"></div>' +
                '<div class="cfg-field"><label>电流模式</label><select id="pmode' + ch + '"><option value="voltage" selected>仅电压</option><option value="shunt_resistor">采样电阻</option><option value="current_probe">电流探头</option></select></div>' +
                '<div class="cfg-field"><label>探头型号</label><select id="pmodel' + ch + '" onchange="applyProbeModel(' + ch + ')">' + pmodelOpts + "</select></div>" +
                '<div class="cfg-field"><label>系数</label><input id="pfact' + ch + '" type="number" step="any" value="1"></div>' +
                '<div class="cfg-field"><label>量程</label><input id="prange' + ch + '" type="number" step="any" value="30"></div>' +
            "</div></details>" +
        "</article>";
    }).join("");
    updateChannelToggles();
}

function updateChannelToggles() {
    CHANNELS.forEach(function(ch) {
        var card = document.querySelector('.ch-card[data-ch="' + ch + '"]');
        if (!card) return;
        card.classList.toggle("off", !activeChs[ch]);
        var btn = card.querySelector(".ch-toggle");
        if (btn) {
            btn.classList.toggle("on", activeChs[ch]);
            btn.innerHTML = icon(activeChs[ch] ? "eye" : "eye-off");
            btn.title = activeChs[ch] ? "禁用通道" : "启用通道";
        }
    });
    var n = CHANNELS.filter(function(ch) { return activeChs[ch]; }).length;
    $("chCount").textContent = n + " / " + CHANNELS.length;
}

function toggleChannel(ch) {
    activeChs[ch] = !activeChs[ch];
    updateChannelToggles();
    if (activeView === "waveform") updateCaptureLabel();
    else refreshChart();
}

function startRename(ch) {
    var label = document.querySelector('.ch-card[data-ch="' + ch + '"] .ch-label');
    if (!label || label.querySelector("input")) return;
    var old = label.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.value = old;
    input.className = "rename-input";
    label.textContent = "";
    label.appendChild(input);
    input.focus();
    input.select();
    var done = function() {
        var name = input.value.trim() || old;
        if (name !== old) {
            channelNames[ch] = name;
            buildChannelList();
            buildTableHead();
            buildStatsPanel();
            refreshChart();
            saveChannelName(ch, name);
        } else {
            label.textContent = old;
        }
    };
    input.addEventListener("blur", done);
    input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") input.blur();
        if (e.key === "Escape") { input.value = old; input.blur(); }
    });
}

async function loadChannelNames() {
    try {
        var resp = await fetch("/api/channel-names");
        var names = await resp.json();
        if (names && typeof names === "object") {
            CHANNELS.forEach(function(ch) {
                if (names[String(ch)]) channelNames[ch] = names[String(ch)];
            });
        }
    } catch (e) {}
}

async function saveChannelName(ch, name) {
    var payload = {};
    payload[String(ch)] = name;
    try {
        await fetch("/api/channel-names", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (e) {}
}

/* ============================================================
   Stats & Data Table
   ============================================================ */
function buildStatsPanel() {
    $("statsPanel").innerHTML = CHANNELS.map(function(ch) {
        return '<div class="stat-card" style="--c:' + CH_COLORS[ch] + '">' +
            '<div class="stat-head"><span class="dot"></span><b>' + (channelNames[ch] || "CH" + ch) + "</b></div>" +
            '<div class="stat-grid">' +
                '<span>RMS<b id="st_rms' + ch + '">--</b></span>' +
                '<span>Max<b id="st_max' + ch + '">--</b></span>' +
                '<span>Min<b id="st_min' + ch + '">--</b></span>' +
                '<span>P-P<b id="st_pp' + ch + '">--</b></span>' +
                '<span>Avg<b id="st_avg' + ch + '">--</b></span>' +
                '<span>Freq<b id="st_freq' + ch + '">--</b></span>' +
            "</div></div>";
    }).join("");
}

function updateStatsPanel(chs) {
    CHANNELS.forEach(function(ch) {
        var d = chs[String(ch)] || chs[ch] || {};
        popEl($("st_rms" + ch), fmtVal(d.rms, 4));
        popEl($("st_max" + ch), fmtVal(d.vmax, 4));
        popEl($("st_min" + ch), fmtVal(d.vmin, 4));
        popEl($("st_pp" + ch), fmtVal(d.vpp, 4));
        popEl($("st_avg" + ch), fmtVal(d.voltage, 4));
        popEl($("st_freq" + ch), fmtVal(d.frequency, 2));
    });
}

function buildTableHead() {
    var html = "<th>测量项</th>";
    CHANNELS.forEach(function(ch) {
        html += '<th class="col-ch" style="--c:' + CH_COLORS[ch] + '">' + (channelNames[ch] || "CH" + ch) + "</th>";
    });
    $("tblHead").innerHTML = html;
}

function buildTableBody() {
    var html = "";
    MEASURE_ROWS.forEach(function(row) {
        html += "<tr><td>" + row.label + " (" + row.unit + ")</td>";
        CHANNELS.forEach(function(ch) {
            html += '<td id="tb_' + row.key + "_" + ch + '">--</td>';
        });
        html += "</tr>";
    });
    $("tblBody").innerHTML = html;
}

function updateDataTable(chs) {
    MEASURE_ROWS.forEach(function(row) {
        CHANNELS.forEach(function(ch) {
            var d = chs[String(ch)] || chs[ch] || {};
            var cell = $("tb_" + row.key + "_" + ch);
            if (cell) cell.textContent = fmtVal(d[row.key], row.fmt);
        });
    });
}

/* ============================================================
   Chart
   ============================================================ */
function baseOpts(yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 180 },
        interaction: { mode: "index", intersect: false },
        scales: {
            x: {
                ticks: { color: "#9aa7b8", maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } },
                grid: { color: "rgba(255,255,255,0.06)" },
                border: { display: false },
            },
            y: {
                title: { display: true, text: yLabel, color: "#9aa7b8", font: { size: 11, weight: "600" } },
                ticks: { color: "#9aa7b8", font: { size: 10 }, padding: 6 },
                grid: { color: "rgba(255,255,255,0.06)" },
                border: { display: false },
            },
        },
        plugins: {
            legend: {
                labels: {
                    color: "#dbe2ec",
                    usePointStyle: true,
                    pointStyleWidth: 7,
                    boxHeight: 2,
                    padding: 14,
                    font: { size: 10 },
                },
            },
            tooltip: {
                backgroundColor: "#f7f9fc",
                titleColor: "#151b26",
                bodyColor: "#35404f",
                borderColor: "rgba(20,28,40,0.14)",
                borderWidth: 1,
                padding: 10,
                cornerRadius: 6,
                displayColors: true,
                boxPadding: 3,
                titleFont: { size: 10, weight: "700" },
                bodyFont: { size: 10 },
            },
        },
    };
}

function createChart() {
    var canvas = $("chartMain");
    if (!window.Chart || !canvas) return;
    chartMain = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels: [], datasets: [] },
        options: baseOpts("电压 (V)"),
    });
}

function refreshChart() {
    if (!chartMain) return;
    chartMain.data.labels = historyCache.map(function(r) { return fmtTime(r.timestamp); });
    chartMain.data.datasets = [];
    var yLabel = "电压 (V)";

    if (activeView === "voltage") {
        yLabel = "电压 (V)";
        CHANNELS.forEach(function(ch) {
            if (!activeChs[ch]) return;
            chartMain.data.datasets.push({
                label: channelNames[ch] || "CH" + ch,
                borderColor: CH_COLORS[ch],
                backgroundColor: CH_COLORS[ch] + "22",
                data: historyCache.map(function(r) {
                    var v = getCh(r, ch).voltage;
                    return v === null || v === undefined ? null : v;
                }),
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2,
                fill: true,
            });
        });
    } else if (activeView === "freqamp") {
        yLabel = "频率 / 幅值";
        CHANNELS.forEach(function(ch) {
            if (!activeChs[ch]) return;
            chartMain.data.datasets.push({
                label: (channelNames[ch] || "CH" + ch) + " 频率",
                borderColor: CH_COLORS[ch],
                backgroundColor: "transparent",
                data: historyCache.map(function(r) {
                    var v = getCh(r, ch).frequency;
                    return v === null || v === undefined ? null : v;
                }),
                tension: 0.35,
                pointRadius: 0,
                borderWidth: 2,
                fill: false,
            });
            chartMain.data.datasets.push({
                label: (channelNames[ch] || "CH" + ch) + " 幅值",
                borderColor: CH_COLORS[ch],
                backgroundColor: "transparent",
                data: historyCache.map(function(r) {
                    var v = getCh(r, ch).amplitude;
                    return v === null || v === undefined ? null : v;
                }),
                tension: 0.35,
                pointRadius: 0,
                borderWidth: 1.5,
                borderDash: [6, 3],
                fill: false,
            });
        });
    } else if (activeView === "timing") {
        yLabel = "时间 (s)";
        var modes = [
            { suffix: " 上升", borderWidth: 2.5, dash: [] },
            { suffix: " 下降", borderWidth: 2, dash: [5, 4] },
            { suffix: " 脉宽", borderWidth: 2, dash: [2, 3] },
        ];
        CHANNELS.forEach(function(ch) {
            if (!activeChs[ch]) return;
            modes.forEach(function(mode) {
                chartMain.data.datasets.push({
                    label: (channelNames[ch] || "CH" + ch) + mode.suffix,
                    borderColor: CH_COLORS[ch],
                    backgroundColor: "transparent",
                    data: historyCache.map(function(r) {
                        var d = getCh(r, ch);
                        var key = mode.suffix.indexOf("上升") >= 0 ? "rise_time" : (mode.suffix.indexOf("下降") >= 0 ? "fall_time" : "pulse_width");
                        var v = d[key];
                        return v === null || v === undefined ? null : v;
                    }),
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: mode.borderWidth,
                    borderDash: mode.dash,
                    fill: false,
                });
            });
        });
    }

    chartMain.options.scales.y.title.text = yLabel;
    chartMain.options.scales.y.ticks.callback = function(v) {
        if (activeView === "timing") return fmtAxis(v);
        return v.toFixed(2);
    };
    chartMain.update("none");
}

function switchView(view) {
    activeView = view;
    document.querySelectorAll(".view-tab").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.view === view);
    });
    updateWaveActions();
    if (view === "waveform") {
        chartMain.data.datasets = persistenceDatasets.slice();
        chartMain.data.labels = [];
        setEmpty("chartEmpty", !persistenceDatasets.length);
        chartMain.update("none");
    } else {
        refreshChart();
        setEmpty("chartEmpty", !historyCache.length);
    }
}

function updateWaveActions() {
    var isWave = activeView === "waveform";
    ["btnCapture", "btnPersistence", "btnUnitToggle"].forEach(function(id) {
        var el = $(id);
        if (el) el.hidden = !isWave;
    });
    if (isWave) updateCaptureLabel();
}

function updateCaptureLabel() {
    var n = CHANNELS.filter(function(ch) { return activeChs[ch]; }).length;
    $("captureLabel").textContent = "捕获 (" + n + " Ch)";
}

function setEmpty(id, empty) {
    var el = $(id);
    if (el) el.classList.toggle("hidden", !empty);
}

/* ============================================================
   Waveform
   ============================================================ */
async function captureWaveform() {
    if (!chartMain) return;
    var active = CHANNELS.filter(function(ch) { return activeChs[ch]; });
    if (!active.length) { showToast("info", "请先启用通道", 1800); return; }
    setLoading($("btnCapture"), true);
    if (!persistenceMode) persistenceDatasets = [];
    chartMain.data.datasets = [];
    chartMain.data.labels = [];
    var anyData = false;
    var sharedLabels = null;
    var sharedStep = 1;

    for (var i = 0; i < active.length; i++) {
        var ch = active[i];
        try {
            var resp = await fetch("/api/waveform/" + ch);
            var data = await resp.json();
            if (!data.ok || !data.waveform) continue;
            var wf = data.waveform;
            var step = sharedLabels ? sharedStep : Math.max(1, Math.floor(wf.x.length / 700));
            var xs = [];
            var ys = [];
            for (var j = 0; j < wf.x.length; j += step) {
                xs.push(wf.x[j]);
                ys.push(wf.y[j]);
            }
            if (!sharedLabels) {
                sharedLabels = xs;
                sharedStep = step;
                chartMain.data.labels = xs.map(function(v) { return fmtAxis(v); });
            }
            chartMain.data.datasets.push({
                label: channelNames[ch] || "CH" + ch,
                borderColor: CH_COLORS[ch] + (persistenceMode ? "77" : ""),
                backgroundColor: "transparent",
                data: ys.slice(0, (sharedLabels || []).length || ys.length),
                pointRadius: 0,
                borderWidth: 1.5,
                tension: 0,
            });
            anyData = true;
        } catch (e) {
            console.error("waveform ch" + ch, e);
        }
    }

    if (anyData) {
        setEmpty("chartEmpty", false);
        $("readWave").textContent = active.length + " 通道";
        if (persistenceMode) {
            var stamped = chartMain.data.datasets.map(function(ds) {
                return {
                    label: ds.label + " " + new Date().toLocaleTimeString(),
                    borderColor: ds.borderColor,
                    backgroundColor: "transparent",
                    data: ds.data.slice(),
                    pointRadius: 0,
                    borderWidth: 1,
                    tension: 0,
                };
            });
            persistenceDatasets.push.apply(persistenceDatasets, stamped);
            chartMain.data.datasets = persistenceDatasets.slice();
        }
        showToast("success", "波形捕获完成");
    } else {
        setEmpty("chartEmpty", true);
        showToast("error", "波形捕获失败");
    }
    chartMain.update();
    setLoading($("btnCapture"), false);
}

function togglePersistence() {
    persistenceMode = !persistenceMode;
    var btn = $("btnPersistence");
    if (btn) {
        btn.classList.toggle("active", persistenceMode);
        btn.title = persistenceMode ? "关闭余辉" : "开启余辉";
    }
    if (!persistenceMode) persistenceDatasets = [];
    showToast("info", persistenceMode ? "余辉模式: 开" : "余辉模式: 关", 1500);
}

function toggleYUnit() {
    yAxisUnitA = !yAxisUnitA;
    var btn = $("btnUnitToggle");
    if (btn) {
        btn.classList.toggle("active", yAxisUnitA);
        btn.innerHTML = icon("arrow-up-down") + (yAxisUnitA ? "A" : "V");
    }
    if (activeView === "waveform" && chartMain) {
        chartMain.data.datasets.forEach(function(ds) {
            var factor = 1;
            CHANNELS.forEach(function(ch) {
                var f = $("pfact" + ch);
                if (f && ds.label.indexOf(channelNames[ch] || "CH" + ch) === 0) factor = parseFloat(f.value) || 1;
            });
            ds.data = ds.data.map(function(v) {
                if (v === null || v === undefined) return v;
                return yAxisUnitA ? v / factor : v * factor;
            });
        });
        chartMain.options.scales.y.title.text = yAxisUnitA ? "电流 (A)" : "电压 (V)";
        chartMain.update();
    }
    showToast("info", yAxisUnitA ? "Y 轴单位: 电流 (A)" : "Y 轴单位: 电压 (V)", 1500);
}

/* ============================================================
   Data Fetch
   ============================================================ */
async function fetchLatest() {
    if (paused) return;
    try {
        var resp = await fetch("/api/data");
        var d = await resp.json();
        var chs = d.channels || {};
        CHANNELS.forEach(function(ch) {
            var data = chs[String(ch)] || chs[ch] || {};
            popEl($("chRms" + ch), fmtVal(data.rms, 4));
            popEl($("chVpp" + ch), fmtVal(data.vpp, 4));
            popEl($("chFreq" + ch), fmtVal(data.frequency, 2));
            popEl($("chCur" + ch), fmtVal(data.current, 4));
        });
        updateDataTable(chs);
        updateStatsPanel(chs);
        $("readUpdated").textContent = d.timestamp || "--";
        $("footerClock").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    } catch (e) {}
}

async function fetchHistory() {
    try {
        var resp = await fetch("/api/history");
        var arr = await resp.json();
        historyCache = Array.isArray(arr) ? arr : [];
        $("historyCount").textContent = historyCache.length + " 条";
        $("footerHistory").textContent = "历史 " + historyCache.length + " 条";
        if (activeView !== "waveform") {
            refreshChart();
            setEmpty("chartEmpty", !historyCache.length);
        }
    } catch (e) {}
}

async function fetchStatus() {
    try {
        var resp = await fetch("/api/status");
        var s = await resp.json();
        connected = !!s.connected;
        currentVendor = s.vendor || "unknown";
        applyVendorConstraints();
        var ok = connected;
        $("statusDot").className = "status-dot " + (ok ? "live" : "dead");
        $("statusText").textContent = ok ? (VENDOR_LABELS[s.vendor] || "已连接") : "未连接";
        $("headerIdn").textContent = ok ? (s.idn || s.resource || "已连接") : "等待连接";
        $("connIdn").textContent = s.idn || "--";
        $("connVendor").textContent = VENDOR_LABELS[s.vendor] || s.vendor || "--";
        $("connResource").textContent = s.resource || "--";
        $("footerStatus").textContent = ok ? ("已连接 · " + (s.resource || "")) : "未连接";
        if (lastConnected !== null && lastConnected !== ok) {
            var detail = (VENDOR_LABELS[s.vendor] ? VENDOR_LABELS[s.vendor] + " " : "") + (s.resource || "");
            showToast(ok ? "success" : "error", ok ? ("示波器已连接 · " + detail) : "示波器连接已断开");
        }
        lastConnected = ok;
    } catch (e) {
        $("statusDot").className = "status-dot dead";
        $("statusText").textContent = "服务器离线";
        $("headerIdn").textContent = "服务器离线";
        if (lastConnected !== false) {
            showToast("error", "无法连接服务器");
            lastConnected = false;
        }
    }
}

/* ============================================================
   Scan / Connect / Export
   ============================================================ */
async function scanResources() {
    var btn = $("btnScan");
    setLoading(btn, true);
    try {
        var resp = await fetch("/api/resources");
        var data = await resp.json();
        var resources = data.resources || [];
        var current = data.current || "";
        var sel = $("selResource");
        sel.innerHTML = "";
        if (!resources.length) {
            sel.innerHTML = '<option value="">未找到设备</option>';
            showToast("error", "未发现 VISA 资源");
        } else {
            resources.forEach(function(r) {
                var o = document.createElement("option");
                o.value = r;
                o.textContent = r;
                if (r === current) o.selected = true;
                sel.appendChild(o);
            });
            showToast("success", "扫描完成 · " + resources.length + " 个设备");
        }
    } catch (e) {
        showToast("error", "扫描失败");
    } finally {
        setLoading(btn, false);
    }
}

async function connectScope() {
    var r = $("selResource").value;
    if (!r) { showToast("info", "请先选择 VISA 资源"); return; }
    var btn = $("btnConnect");
    setLoading(btn, true);
    $("btnConnectLabel").textContent = "连接中";
    try {
        var resp = await fetch("/api/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: r }),
        });
        var data = await resp.json();
        if (data.ok) {
            scopeRunning = true;
            updateRunStopBtn();
            showToast("success", "连接成功 · " + r);
            loadScopeSettings();
            loadCurrentConfig();
            fetchStatus();
        } else {
            showToast("error", "连接失败");
            fetchStatus();
        }
    } catch (e) {
        showToast("error", "连接异常");
    } finally {
        $("btnConnectLabel").textContent = "连接";
        setLoading(btn, false);
    }
}

function exportExcel() {
    showToast("info", "正在生成 Excel", 1500);
    window.open("/api/export", "_blank");
}

function togglePause() {
    paused = !paused;
    var btn = $("btnPause");
    btn.innerHTML = icon(paused ? "play" : "pause");
    btn.classList.toggle("active", paused);
    btn.title = paused ? "继续刷新" : "暂停刷新";
    showToast("info", paused ? "显示已暂停" : "显示已恢复", 1500);
}

function applyVendorConstraints() {
    var yoko = currentVendor === "yokogawa";
    CHANNELS.forEach(function(ch) {
        var imp = $("imp" + ch);
        if (imp) {
            imp.disabled = yoko;
            imp.title = yoko ? "DLM2000 阻抗由机箱机械开关决定" : "";
            if (yoko) imp.value = "1M";
        }
    });
    var samp = $("acqSampling");
    if (samp) {
        samp.disabled = !yoko;
        samp.title = yoko ? "" : "采样模式仅 YOKOGAWA 支持";
    }
}

async function toggleRunStop() {
    if (!connected) {
        showToast("error", "示波器未连接");
        return;
    }
    var btn = $("btnRunStop");
    setLoading(btn, true);
    try {
        var resp = await fetch(scopeRunning ? "/api/stop" : "/api/run", { method: "POST" });
        var data = await resp.json();
        if (data.ok) {
            scopeRunning = !scopeRunning;
            updateRunStopBtn();
            showToast("success", scopeRunning ? "采集已启动" : "采集已停止");
        } else {
            showToast("error", data.error || "操作失败");
        }
    } catch (e) {
        showToast("error", "请求异常");
    } finally {
        setLoading(btn, false);
    }
}

function updateRunStopBtn() {
    var btn = $("btnRunStop");
    if (!btn) return;
    btn.classList.toggle("active", !scopeRunning);
    var ico = btn.querySelector("[data-icon]");
    if (ico) ico.innerHTML = icon(scopeRunning ? "pause" : "play");
    var lbl = $("btnRunStopLabel");
    if (lbl) lbl.textContent = scopeRunning ? "停止" : "运行";
    btn.title = scopeRunning ? "停止采集" : "启动采集";
}

/* ============================================================
   Settings
   ============================================================ */
function applyProbeModel(ch) {
    var idx = parseInt($("pmodel" + ch).value, 10);
    var m = PROBE_MODELS[idx];
    if (!m) return;
    var f = $("pfact" + ch);
    var r = $("prange" + ch);
    if (f) f.value = m.sens;
    if (r) r.value = m.range;
    if (idx > 0) {
        var mode = $("pmode" + ch);
        if (mode) mode.value = "current_probe";
    }
}

async function loadScopeSettings() {
    try {
        var resp = await fetch("/api/settings");
        if (!resp.ok) return;
        var s = await resp.json();
        if (s.error) return;
        if (s.timebase) {
            $("setTimebase").value = String(s.timebase);
            $("readTimebase").textContent = fmtTimebase(s.timebase);
        }
        var acq = s.acquisition || {};
        var acqLabels = { NORM: "Normal", AVER: "Average", ENV: "Envelope", HRES: "High Res" };
        if (acq.mode) {
            var am = $("acqMode");
            if (am) am.value = acq.mode;
            $("readAcq").textContent = acqLabels[acq.mode] || acq.mode;
        }
        if (acq.average_count) {
            var aa = $("acqAvg");
            if (aa) aa.value = String(acq.average_count);
        }
        if (acq.record_length) {
            var ad = $("acqDepth");
            if (ad) ad.value = String(acq.record_length);
        }
        if (acq.sampling) {
            var asmp = $("acqSampling");
            if (asmp) asmp.value = acq.sampling;
        }
        var chs = s.channels || {};
        CHANNELS.forEach(function(ch) {
            var cfg = chs[String(ch)] || {};
            if (cfg.scale) {
                var scaleSel = $("scale" + ch);
                if (scaleSel) scaleSel.value = String(cfg.scale);
                $("chScale" + ch).textContent = fmtScale(cfg.scale);
            }
            if (cfg.probe) { var p = $("probe" + ch); if (p) p.value = String(cfg.probe); }
            if (cfg.coupling) { var c = $("coup" + ch); if (c) c.value = cfg.coupling; }
            if (cfg.impedance) { var i = $("imp" + ch); if (i) i.value = cfg.impedance; }
            if (cfg.offset !== null && cfg.offset !== undefined) {
                var o = $("offs" + ch);
                if (o) o.value = cfg.offset;
            }
        });
        var t = s.trigger || {};
        if (t.type) { var tt = $("trigType"); if (tt) tt.value = t.type; }
        if (t.mode) { var tm = $("trigMode"); if (tm) tm.value = t.mode; }
        if (t.source) { var ts = $("trigSrc"); if (ts) ts.value = t.source; }
        if (t.level !== null && t.level !== undefined) { var tl = $("trigLevel"); if (tl) tl.value = t.level; }
        if (t.coupling) { var tc = $("trigCoup"); if (tc) tc.value = t.coupling; }
        if (t.slope) { var tsl = $("trigSlope"); if (tsl) tsl.value = t.slope; }
        if (t.holdoff !== null && t.holdoff !== undefined) { var th = $("trigHoldoff"); if (th) th.value = t.holdoff; }
        $("readTrigger").textContent = (t.source || "CH1") + " · " + (t.type || "EDGE");
    } catch (e) {}
}

async function loadCurrentConfig() {
    try {
        var resp = await fetch("/api/current-config");
        var data = await resp.json();
        var modes = data.mode || {};
        var factors = data.factor || {};
        var ranges = data.range || {};
        CHANNELS.forEach(function(ch) {
            var m = $("pmode" + ch);
            if (m && modes[String(ch)]) m.value = modes[String(ch)];
            var f = $("pfact" + ch);
            if (f && factors[String(ch)] !== null && factors[String(ch)] !== undefined) {
                f.value = factors[String(ch)];
                currentSensitivity[ch] = parseFloat(factors[String(ch)]) || 1;
            }
            var r = $("prange" + ch);
            if (r && ranges[String(ch)] !== null && ranges[String(ch)] !== undefined) r.value = ranges[String(ch)];
        });
    } catch (e) {}
}

async function saveCurrentConfig() {
    var mp = {}, fp = {}, rp = {};
    CHANNELS.forEach(function(ch) {
        var m = $("pmode" + ch);
        var f = $("pfact" + ch);
        var r = $("prange" + ch);
        if (m) mp[String(ch)] = m.value;
        if (f) {
            fp[String(ch)] = parseFloat(f.value) || 1;
            currentSensitivity[ch] = fp[String(ch)];
        }
        if (r) rp[String(ch)] = parseFloat(r.value) || 30;
    });
    try {
        await fetch("/api/current-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: mp, factor: fp, range: rp }),
        });
    } catch (e) {}
}

async function applyAllSettings() {
    var payload = {
        timebase: parseFloat($("setTimebase").value),
        acquisition: {
            mode: $("acqMode").value,
            average_count: parseInt($("acqAvg").value, 10) || 16,
            record_length: parseInt($("acqDepth").value, 10) || 12500,
            sampling: $("acqSampling").value,
        },
        channels: {},
        trigger: {
            type: $("trigType").value,
            mode: $("trigMode").value,
            source: $("trigSrc").value,
            level: parseFloat($("trigLevel").value) || 1.0,
            coupling: $("trigCoup").value,
            slope: $("trigSlope").value,
            holdoff: parseFloat($("trigHoldoff").value) || 0,
        },
    };
    CHANNELS.forEach(function(ch) {
        payload.channels[String(ch)] = {
            scale: parseFloat($("scale" + ch).value),
            probe: parseInt($("probe" + ch).value, 10),
            coupling: $("coup" + ch).value,
            impedance: $("imp" + ch).value,
            offset: parseFloat($("offs" + ch).value) || 0,
        };
    });
    var btn = $("btnApply");
    setLoading(btn, true);
    try {
        var resp = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        var data = await resp.json();
        if (data.ok) {
            await saveCurrentConfig();
            $("readTimebase").textContent = fmtTimebase(payload.timebase);
            $("readTrigger").textContent = payload.trigger.source + " · " + payload.trigger.type;
            var acqLabels = { NORM: "Normal", AVER: "Average", ENV: "Envelope", HRES: "High Res" };
            $("readAcq").textContent = acqLabels[payload.acquisition.mode] || payload.acquisition.mode;
            CHANNELS.forEach(function(ch) {
                $("chScale" + ch).textContent = fmtScale(payload.channels[String(ch)].scale);
            });
            showToast("success", "设置已应用");
        } else {
            showToast("error", data.error || "设置失败");
        }
    } catch (e) {
        showToast("error", "请求异常");
    } finally {
        setLoading(btn, false);
    }
}

/* ============================================================
   Init
   ============================================================ */
document.getElementById("viewTabs").addEventListener("click", function(e) {
    var tab = e.target.closest(".view-tab");
    if (tab) switchView(tab.dataset.view);
});

async function init() {
    applyIcons();
    updateRunStopBtn();
    await loadChannelNames();
    createChart();
    buildChannelList();
    buildTableHead();
    buildTableBody();
    buildStatsPanel();
    scanResources();
    fetchStatus();
    fetchLatest();
    fetchHistory();
    loadScopeSettings();
    loadCurrentConfig();
    setInterval(function() { fetchLatest(); }, 1000);
    setInterval(fetchStatus, 3000);
    setInterval(fetchHistory, 5000);
}

init();
