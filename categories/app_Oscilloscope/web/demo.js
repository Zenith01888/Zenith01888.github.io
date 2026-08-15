(function () {
  "use strict";

  var nativeFetch = window.fetch.bind(window);

  var demoChannelNames = {
    1: "通道 1",
    2: "通道 2",
    3: "通道 3",
    4: "通道 4",
  };

  var demoCurrentConfig = {
    mode: {
      "1": "voltage",
      "2": "shunt_resistor",
      "3": "current_probe",
      "4": "voltage",
    },
    factor: {
      "1": 1.0,
      "2": 0.1,
      "3": 0.1,
      "4": 1.0,
    },
    range: {
      "1": 30,
      "2": 30,
      "3": 30,
      "4": 30,
    },
  };

  var demoSignals = [
    { freq: 1000, amp: 2.4, duty: 50, offset: 0, phase: 0 },
    { freq: 50, amp: 3.1, duty: 42, offset: 0.8, phase: 1.2 },
    { freq: 200, amp: 1.6, duty: 68, offset: -0.6, phase: 2.1 },
    { freq: 340, amp: 0.9, duty: 25, offset: 1.2, phase: 3.4 },
  ];

  var demoHistory = [];
  var demoClock = Date.now();

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatTime(date) {
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) +
      ":" + pad(date.getMinutes()) +
      ":" + pad(date.getSeconds())
    );
  }

  function rnd(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeDemoRecord() {
    var now = new Date(demoClock);
    var channels = {};

    for (var i = 0; i < 4; i++) {
      var cfg = demoSignals[i];
      var ch = String(i + 1);
      var t = (demoClock - Date.now()) / 1000;
      var voltage = cfg.offset +
        Math.sin(t * Math.PI * 2 * (cfg.freq / 10) + cfg.phase) * cfg.amp * 0.72 +
        rnd(-0.02, 0.02) * cfg.amp;
      var vmax = cfg.offset + cfg.amp * 0.82;
      var vmin = cfg.offset - cfg.amp * 0.78;
      var frequency = cfg.freq * (0.985 + rnd(0, 0.03));
      var current = demoCurrentConfig.mode[ch] === "voltage"
        ? null
        : Math.abs(voltage) * demoCurrentConfig.factor[ch];

      channels[ch] = {
        rms: Math.abs(voltage) * 0.707 + 0.02,
        vmax: vmax,
        vmin: vmin,
        vpp: vmax - vmin,
        voltage: voltage,
        current: current,
        frequency: frequency,
        duty_cycle: cfg.duty + rnd(-0.5, 0.5),
        pulse_width: (cfg.duty / 100) / frequency,
        rise_time: (0.9 + rnd(0, 0.4)) / frequency,
        fall_time: (0.8 + rnd(0, 0.5)) / frequency,
        overshoot: 1.2 + rnd(0, 0.8),
      };
    }

    return { timestamp: formatTime(now), channels: channels };
  }

  function seedDemoHistory() {
    if (demoHistory.length) return;
    for (var i = 59; i >= 0; i--) {
      demoClock = Date.now() - i * 1000;
      demoHistory.push(makeDemoRecord());
    }
  }

  function makeWaveform(channel) {
    var cfg = demoSignals[channel - 1] || demoSignals[0];
    var xs = [];
    var ys = [];
    var count = 720;

    for (var i = 0; i < count; i++) {
      var t = (i - count / 2) * 1e-5;
      xs.push(t);
      ys.push(
        cfg.offset +
        cfg.amp * Math.sin(Math.PI * 2 * cfg.freq * t + cfg.phase) +
        rnd(-0.035, 0.035) * cfg.amp
      );
    }

    return { x: xs, y: ys };
  }

  function jsonResponse(payload) {
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  function defaultSettings() {
    var channels = {};
    [1, 2, 3, 4].forEach(function (ch) {
      channels[String(ch)] = {
        scale: 1,
        probe: 10,
        coupling: "DC",
        impedance: "1M",
        offset: 0,
      };
    });

    return {
      timebase: 0.001,
      acquisition: {
        mode: "NORM",
        average_count: 16,
        record_length: 12500,
        sampling: "REAL",
      },
      channels: channels,
      trigger: {
        type: "EDGE",
        mode: "AUTO",
        source: "CH1",
        level: 1.0,
        coupling: "DC",
        slope: "RISE",
        holdoff: 0,
      },
    };
  }

  function demoApi(path, options) {
    var method = (options.method || "GET").toUpperCase();

    if (path === "/api/data") {
      demoClock = Date.now();
      var record = makeDemoRecord();
      demoHistory.push(record);
      if (demoHistory.length > 1440) demoHistory.shift();
      return jsonResponse(record);
    }

    if (path === "/api/history") {
      seedDemoHistory();
      return jsonResponse(demoHistory.slice(-160));
    }

    if (path === "/api/status") {
      return jsonResponse({
        connected: true,
        resource: "DEMO::YOKOGAWA::DLM2024::SIMULATED",
        vendor: "demo",
        idn: "DLM2024 · 浏览器演示",
        channel_names: demoChannelNames,
      });
    }

    if (path === "/api/resources") {
      return jsonResponse({
        resources: ["DEMO::YOKOGAWA::DLM2024::SIMULATED"],
        current: "DEMO::YOKOGAWA::DLM2024::SIMULATED",
      });
    }

    if (path === "/api/connect") {
      return jsonResponse({
        ok: true,
        resource: "DEMO::YOKOGAWA::DLM2024::SIMULATED",
        connected: true,
      });
    }

    if (path === "/api/channel-names") {
      if (method === "POST") {
        try {
          var payload = JSON.parse(options.body || "{}");
          Object.keys(payload).forEach(function (ch) {
            if (payload[ch]) demoChannelNames[ch] = String(payload[ch]);
          });
        } catch (error) {
          // Ignore malformed demo payloads.
        }
      }
      return jsonResponse(demoChannelNames);
    }

    if (path === "/api/settings") {
      if (method === "POST") return jsonResponse({ ok: true });
      return jsonResponse(defaultSettings());
    }

    if (path === "/api/current-config") {
      if (method === "POST") {
        try {
          var config = JSON.parse(options.body || "{}");
          ["mode", "factor", "range"].forEach(function (key) {
            if (!config[key]) return;
            Object.keys(config[key]).forEach(function (ch) {
              demoCurrentConfig[key][ch] = config[key][ch];
            });
          });
        } catch (error) {
          // Ignore malformed demo payloads.
        }
      }
      return jsonResponse(demoCurrentConfig);
    }

    if (path === "/api/run") return jsonResponse({ ok: true, running: true });
    if (path === "/api/stop") return jsonResponse({ ok: true, running: false });

    var waveformMatch = path.match(/^\/api\/waveform\/(\d+)$/);
    if (waveformMatch) {
      return jsonResponse({
        ok: true,
        channel: Number(waveformMatch[1]),
        waveform: makeWaveform(Number(waveformMatch[1])),
      });
    }

    return jsonResponse({ ok: false, error: "demo endpoint not found" });
  }

  window.fetch = function (input, options) {
    var url = typeof input === "string" ? input : input.url;
    if (url && url.indexOf("/api/") === 0) return demoApi(url, options || {});
    return nativeFetch.apply(this, arguments);
  };

  window.demoExportExcel = function () {
    var records = window.historyCache || demoHistory;
    if (!records.length) {
      if (window.showToast) window.showToast("info", "暂无演示数据", 1800);
      return;
    }

    var rows = [["时间"]];
    var names = window.channelNames || demoChannelNames;
    [1, 2, 3, 4].forEach(function (ch) {
      var base = names[String(ch)] || ("CH" + ch);
      rows[0].push(
        base + " RMS(V)", base + " Max(V)", base + " Min(V)", base + " P-P(V)",
        base + " Avg(V)", base + " Current(A)", base + " Freq(Hz)",
        base + " Duty(%)", base + " Pulse(s)", base + " Rise(s)",
        base + " Fall(s)", base + " Overshoot(%)"
      );
    });

    var keys = [
      "rms", "vmax", "vmin", "vpp", "voltage", "current",
      "frequency", "duty_cycle", "pulse_width", "rise_time",
      "fall_time", "overshoot",
    ];

    records.forEach(function (record) {
      var row = [record.timestamp || ""];
      [1, 2, 3, 4].forEach(function (ch) {
        var d = (record.channels || {})[String(ch)] || {};
        keys.forEach(function (key) {
          var v = d[key];
          row.push(v === null || v === undefined ? "--" : v);
        });
      });
      rows.push(row);
    });

    var stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
    if (window.XLSX) {
      var ws = window.XLSX.utils.aoa_to_sheet(rows);
      var wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "示波器数据");
      window.XLSX.writeFile(wb, "oscilloscope_demo_" + stamp + ".xlsx");
    } else {
      var csv = rows.map(function (row) {
        return row.map(function (cell) {
          return '"' + String(cell).replace(/"/g, '""') + '"';
        }).join(",");
      }).join("\n");
      var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "oscilloscope_demo_" + stamp + ".csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    if (window.showToast) window.showToast("success", "演示数据已导出");
  };
})();
