'use strict';

/* ===================================================================
 * PWM Monitor v2 — 模块化重构
 * 代码质量目标：低耦合、可测、file:// 兼容
 * =================================================================== */

// ─── Configuration ───────────────────────────────────────────────────
const CONFIG = Object.freeze({
  BAUD_DEFAULT: 115200,
  TABLE_MAX_ROWS: 200,
  CHANNELS: [
    { id: 0, key: 'ch1', label: 'CAP1', pin: 'PA6', cssColor: 'var(--color-ch1)' },
    { id: 1, key: 'ch2', label: 'CAP2', pin: 'PA1', cssColor: 'var(--color-ch2)' },
    { id: 2, key: 'ch3', label: 'CAP3', pin: 'PA7', cssColor: 'var(--color-ch3)' },
  ],
  PARSER_PATTERNS: [
    // Primary: CAP<n>: Freq=xxx.xx Hz Duty=xx.xx%
    /CAP(\d):\s*Freq[=:]\s*([\d.]+)\s*Hz.*?Duty?[=:]\s*([\d.]+)\s*%/i,
    // Fallback (legacy single-channel): Freq=xxx.xx Hz Duty=xx.xx%
    /Freq[=:]\s*([\d.]+)\s*Hz.*?Duty?[=:]\s*([\d.]+)\s*%/i,
  ],
});

// ─── DOM Cache — 一次查找，后续复用 ─────────────────────────────
const $ = (() => {
  const cache = {};
  const get = (id) => {
    if (!(id in cache)) {
      cache[id] = document.getElementById(id);
    }
    return cache[id];
  };
  // 惰性缓存，支持重置（DOM 重建时）
  get.reset = () => { Object.keys(cache).forEach(k => delete cache[k]); };
  // 查一组 ID 并返回对象
  get.many = (...ids) => Object.fromEntries(ids.map(id => [id, get(id)]));
  return get;
})();

// ─── Logger ─────────────────────────────────────────────────────────
const Log = {
  info(...args) { console.log('[PWM]', ...args); },
  warn(...args) { console.warn('[PWM]', ...args); },
  error(...args) { console.error('[PWM]', ...args); },
};

// ─── Utils ──────────────────────────────────────────────────────────
const pad = (n) => n.toString().padStart(2, '0');

const safeNum = (v, decimals = 1) => {
  const n = parseFloat(v);
  return (Number.isFinite(n) && n >= 0) ? n.toFixed(decimals) : '--';
};

const nowStr = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

// ─── DataStore ──────────────────────────────────────────────────────
class DataStore {
  constructor() {
    this.buffer = [];
    this.stats = CONFIG.CHANNELS.map(() => ({
      fSum: 0, fMin: Infinity, fMax: -Infinity,
      dSum: 0, dMin: Infinity, dMax: -Infinity,
      count: 0,
    }));
    this._pending = { c1f: NaN, c1d: NaN, c2f: NaN, c2d: NaN, c3f: NaN, c3d: NaN };
    this.enabled = { ch1: true, ch2: true, ch3: true };
  }

  get pending() { return this._pending; }
  get length() { return this.buffer.length; }
  get last() { return this.buffer.length ? this.buffer[this.buffer.length - 1] : null; }

  setEnabled(ch1, ch2, ch3) {
    this.enabled.ch1 = ch1;
    this.enabled.ch2 = ch2;
    this.enabled.ch3 = ch3;
  }

  /**
   * 记录一个通道的解析结果到 pending 缓冲区。
   * 当所有已启用通道的数据都到齐后，自动提交。
   */
  recordParsed(ch, freq, duty) {
    this._pending['c' + ch + 'f'] = freq;
    this._pending['c' + ch + 'd'] = duty;
    return this._tryCommit();
  }

  /** Fallback: 直接设置 ch1（旧格式兼容） */
  recordLegacy(freq, duty) {
    this._pending.c1f = freq;
    this._pending.c1d = duty;
    return this._tryCommit();
  }

  _tryCommit() {
    if (!this.enabled.ch1 && !this.enabled.ch2 && !this.enabled.ch3) return false;
    const needC1 = this.enabled.ch1 && (isNaN(this._pending.c1f) || isNaN(this._pending.c1d));
    const needC2 = this.enabled.ch2 && (isNaN(this._pending.c2f) || isNaN(this._pending.c2d));
    const needC3 = this.enabled.ch3 && (isNaN(this._pending.c3f) || isNaN(this._pending.c3d));
    if (needC1 || needC2 || needC3) return false;
    this._commit();
    return true;
  }

  _commit() {
    const now = new Date();
    const sample = {
      ts: now,
      time: nowStr(),
      c1f: this.enabled.ch1 ? this._pending.c1f : NaN,
      c1d: this.enabled.ch1 ? this._pending.c1d : NaN,
      c2f: this.enabled.ch2 ? this._pending.c2f : NaN,
      c2d: this.enabled.ch2 ? this._pending.c2d : NaN,
      c3f: this.enabled.ch3 ? this._pending.c3f : NaN,
      c3d: this.enabled.ch3 ? this._pending.c3d : NaN,
    };
    this.buffer.push(sample);

    CONFIG.CHANNELS.forEach((ch) => {
      if (this.enabled[ch.key]) {
        this._updateStats(ch.id, sample['c' + (ch.id + 1) + 'f'], sample['c' + (ch.id + 1) + 'd']);
      }
    });

    // Reset pending
    this._pending = { c1f: NaN, c1d: NaN, c2f: NaN, c2d: NaN, c3f: NaN, c3d: NaN };
  }

  _updateStats(idx, freq, duty) {
    const s = this.stats[idx];
    s.fSum += freq; s.count++;
    s.fMin = Math.min(s.fMin, freq);
    s.fMax = Math.max(s.fMax, freq);
    s.dSum += duty;
    s.dMin = Math.min(s.dMin, duty);
    s.dMax = Math.max(s.dMax, duty);
  }

  clear() {
    this.buffer = [];
    this.stats = CONFIG.CHANNELS.map(() => ({
      fSum: 0, fMin: Infinity, fMax: -Infinity,
      dSum: 0, dMin: Infinity, dMax: -Infinity,
      count: 0,
    }));
    this._pending = { c1f: NaN, c1d: NaN, c2f: NaN, c2d: NaN, c3f: NaN, c3d: NaN };
  }

  getSlice(count = CONFIG.TABLE_MAX_ROWS) {
    return this.buffer.slice(-count);
  }

  getVisibleColumns() {
    const cols = ['#', 'time'];
    const colIndices = [];
    CONFIG.CHANNELS.forEach((ch) => {
      if (this.enabled[ch.key]) {
        cols.push(ch.label + ' Freq (Hz)', ch.label + ' Duty (%)');
        colIndices.push(ch.id);
      }
    });
    return { cols, colIndices, total: cols.length };
  }
}

// ─── SerialManager ──────────────────────────────────────────────────
class SerialManager {
  constructor(store, onData) {
    this.store = store;
    this.onData = onData; // 新数据回调
    this.port = null;
    this.reader = null;
    this._keepReading = false;
    this._connected = false;
  }

  get connected() { return this._connected; }

  async requestPort() {
    return navigator.serial.requestPort();
  }

  async connect(baudRate) {
    // 请求用户选择端口
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baudRate || CONFIG.BAUD_DEFAULT });
    this.port = port;
    this._connected = true;
    this._startReading();
    return port.getInfo();
  }

  disconnect() {
    this._keepReading = false;
    if (this.reader) {
      try { this.reader.cancel(); } catch (_) {}
      this.reader = null;
    }
    if (this.port) {
      try { this.port.close(); } catch (_) {}
      this.port = null;
    }
    this._connected = false;
  }

  async _startReading() {
    this._keepReading = true;
    let leftover = '';
    const textDecoder = new TextDecoder();

    try {
      while (this.port && this.port.readable && this._keepReading) {
        this.reader = this.port.readable.getReader();
        try {
          while (true) {
            const { value, done } = await this.reader.read();
            if (done) break;
            const text = textDecoder.decode(value, { stream: true });
            leftover += text;
            const lines = leftover.split('\n');
            leftover = lines.pop() || '';
            for (const line of lines) {
              this._parseLine(line.trim());
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') Log.error('读取出错:', err);
        } finally {
          if (this.reader) {
            this.reader.releaseLock();
            this.reader = null;
          }
        }
      }
    } catch (err) {
      Log.error('读取循环异常:', err);
    }
  }

  _parseLine(line) {
    if (!line) return;

    // 主格式: CAP<n>: Freq=xxx.xx Hz Duty=xx.xx%
    const m = line.match(CONFIG.PARSER_PATTERNS[0]);
    if (m) {
      const ch = parseInt(m[1], 10);
      const freq = parseFloat(m[2]);
      const duty = parseFloat(m[3]);
      if (ch >= 1 && ch <= 3 && Number.isFinite(freq) && Number.isFinite(duty)) {
        const committed = this.store.recordParsed(ch, freq, duty);
        if (committed) this.onData();
      }
      return;
    }

    // 旧格式（单通道降级）
    const old = line.match(CONFIG.PARSER_PATTERNS[1]);
    if (old) {
      const freq = parseFloat(old[1]);
      const duty = parseFloat(old[2]);
      if (Number.isFinite(freq) && Number.isFinite(duty)) {
        const committed = this.store.recordLegacy(freq, duty);
        if (committed) this.onData();
      }
    }
  }
}

// ─── ExcelExporter ──────────────────────────────────────────────────
class ExcelExporter {
  constructor(store) {
    this.store = store;
    this.lastSaveTime = null;
  }

  save() {
    const buffer = this.store.buffer;
    if (buffer.length === 0) return null;

    const now = new Date();
    const chCount = CONFIG.CHANNELS.filter(ch => this.store.enabled[ch.key]).length;
    const filename = `PWM_${chCount}CH_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`;

    const { cols, colIndices } = this.store.getVisibleColumns();
    const aoa = [cols];

    buffer.forEach((d, i) => {
      const row = [i + 1, d.time];
      colIndices.forEach((ch) => {
        const n = ch + 1;
        row.push(safeNum(d['c' + n + 'f']));
        row.push(safeNum(d['c' + n + 'd']));
      });
      aoa.push(row);
    });

    // 统计部分
    aoa.push([], ['========== 通道统计 ==========']);
    colIndices.forEach((ch) => {
      const s = this.store.stats[ch];
      if (s.count === 0) return;
      const n = ch + 1;
      aoa.push(['CAP' + n + ' 记录数', s.count]);
      aoa.push(['CAP' + n + ' 频率 Min/Avg/Max (Hz)',
        s.fMin.toFixed(1), (s.fSum / s.count).toFixed(1), s.fMax.toFixed(1)]);
      aoa.push(['CAP' + n + ' 占空比 Min/Avg/Max (%)',
        s.dMin.toFixed(1), (s.dSum / s.count).toFixed(1), s.dMax.toFixed(1)]);
      aoa.push([]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 列宽
    const colWidths = [{ wch: 8 }, { wch: 14 }];
    colIndices.forEach(() => colWidths.push({ wch: 14 }, { wch: 14 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'PWM 数据');
    XLSX.writeFile(wb, filename);

    this.lastSaveTime = now;
    return now;
  }
}

// ─── WakeLockManager ────────────────────────────────────────────────
class WakeLockManager {
  constructor() {
    this._lock = null;
    this._supported = 'wakeLock' in navigator;
    this._onChange = null;
    this._retryTimer = null;
    this._running = false;
  }

  get supported() { return this._supported; }
  get active() { return !!this._lock; }

  onChange(cb) { this._onChange = cb; }

  async request() {
    if (!this._supported) return false;
    try {
      this._lock = await navigator.wakeLock.request('screen');
      this._lock.addEventListener('release', () => { this._handleRelease(); });
      if (this._onChange) this._onChange(true);
      return true;
    } catch (err) {
      Log.warn('Wake Lock 请求失败:', err.message);
      if (this._onChange) this._onChange(false);
      this._scheduleRetry();
      return false;
    }
  }

  /** 页面打开即启动，持续保持唤醒，自动重试 */
  start() {
    if (!this._supported) {
      if (this._onChange) this._onChange(false);
      return;
    }
    this._running = true;
    this.request();
  }

  /** 停止自动重试（页面关闭时调用） */
  stop() {
    this._running = false;
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    this._releaseLock();
    if (this._onChange) this._onChange(false);
  }

  _handleRelease() {
    this._lock = null;
    if (this._onChange) this._onChange(false);
    this._scheduleRetry();
  }

  _scheduleRetry() {
    if (!this._running) return;
    if (this._retryTimer) return;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      if (this._running && !this._lock) {
        this.request();
      }
    }, 3000);
  }

  _releaseLock() {
    if (!this._lock) return;
    try {
      this._lock.removeEventListener('release', this._handleRelease);
      this._lock.release();
    } catch (_) {}
    this._lock = null;
  }
}

// ─── UIManager ──────────────────────────────────────────────────────
class UIManager {
  constructor(store, exporter) {
    this.store = store;
    this.exporter = exporter;
    this._els = {};
    this._autoSaveTimer = null;
  }

  /** 连接 DOM 元素引用（初始化时调用） */
  bind() {
    const ids = [
      'statusDot', 'connStatus', 'wakeLockStatus',
      'portSelect', 'baudRate',
      'ch1Enable', 'ch2Enable', 'ch3Enable',
      'saveInterval', 'saveStatus',
      'dataTable', 'recordCount', 'lastUpdate',
      'totalRecords', 'autoSaveInfo',
      'cap1Freq', 'cap1Duty', 'cap1FreqStats', 'cap1DutyStats',
      'cap2Freq', 'cap2Duty', 'cap2FreqStats', 'cap2DutyStats',
      'cap3Freq', 'cap3Duty', 'cap3FreqStats', 'cap3DutyStats',
    ];
    this._els = $.many(...ids);
    this._thead = document.querySelector('thead tr');
    this._tableWrap = document.querySelector('.table-wrap');

    // 暗色模式切换（监听系统变化）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    });
    // 初始同步系统暗色模式
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }

  // ─── Serial UI ───
  updateSerialUI(connected, info) {
    const e = this._els;
    if (connected) {
      e.connStatus.textContent = '✓ 已连接';
      e.connStatus.className = 'badge badge-ok';
      e.statusDot.className = 'header-dot on';
      const vid = info?.usbVendorId?.toString(16) || '?';
      e.portSelect.innerHTML = `<option>已连接 VID:${vid}</option>`;
    } else {
      e.connStatus.textContent = '未连接';
      e.connStatus.className = 'badge badge-idle';
      e.statusDot.className = 'header-dot';
      this._populatePortSelect([]);
    }
  }

  _populatePortSelect(ports) {
    const sel = this._els.portSelect;
    sel.innerHTML = '<option>-- 选择串口 --</option>';
    ports.forEach(p => {
      const info = p.getInfo();
      const opt = document.createElement('option');
      opt.value = '';
      opt.port = p;
      opt.textContent = `COM (VID:${info.usbVendorId?.toString(16) || '?'})`;
      sel.appendChild(opt);
    });
  }

  async refreshPortList() {
    try {
      const ports = await navigator.serial.getPorts();
      this._populatePortSelect(ports);
    } catch (_) { /* no authorized ports */ }
  }

  // ─── Data display ───
  updateDisplay() {
    const last = this.store.last;
    CONFIG.CHANNELS.forEach((ch) => {
      const n = ch.id + 1;
      const freqEl = this._els['cap' + n + 'Freq'];
      const dutyEl = this._els['cap' + n + 'Duty'];
      const fStatEl = this._els['cap' + n + 'FreqStats'];
      const dStatEl = this._els['cap' + n + 'DutyStats'];
      const s = this.store.stats[ch.id];

      if (last) {
        freqEl.textContent = safeNum(last['c' + n + 'f']);
        dutyEl.textContent = safeNum(last['c' + n + 'd']);
      }

      if (s.count > 0) {
        fStatEl.textContent = `${s.fMin.toFixed(1)} / ${(s.fSum / s.count).toFixed(1)} / ${s.fMax.toFixed(1)} Hz`;
        dStatEl.textContent = `${s.dMin.toFixed(1)} / ${(s.dSum / s.count).toFixed(1)} / ${s.dMax.toFixed(1)} %`;
      }
    });

    this._els.lastUpdate.textContent = '最后更新 ' + nowStr();
    this._els.totalRecords.textContent = this.store.length;
    this._els.recordCount.textContent = `(${this.store.length}条)`;
  }

  renderTable() {
    // 表头
    const thead = this._thead;
    const { colIndices } = this.store.getVisibleColumns();
    const chColors = CONFIG.CHANNELS.map(ch => ch.cssColor);

    let hhtml = '<th>#</th><th>时间</th>';
    colIndices.forEach((ch) => {
      hhtml += `<th style="color:${chColors[ch]};">CAP${ch + 1} Freq (Hz)</th>`;
      hhtml += `<th style="color:${chColors[ch]};">CAP${ch + 1} Duty (%)</th>`;
    });
    thead.innerHTML = hhtml;

    const colCount = 2 + colIndices.length * 2;
    const rows = this.store.getSlice();
    const tbody = this._els.dataTable;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="empty-state">等待串口数据…</div></td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((d, i) => {
      const absIdx = this.store.length - rows.length + i + 1;
      let r = `<tr><td>${absIdx}</td><td>${d.time}</td>`;
      colIndices.forEach((ch) => {
        const n = ch + 1;
        r += `<td style="color:${chColors[ch]};">${safeNum(d['c' + n + 'f'])}</td>`;
        r += `<td style="color:${chColors[ch]};">${safeNum(d['c' + n + 'd'])}</td>`;
      });
      return r + '</tr>';
    }).join('');

    // 自动滚动到底部
    if (this._tableWrap) {
      this._tableWrap.scrollTop = this._tableWrap.scrollHeight;
    }
  }

  // ─── Wake Lock UI ───
  updateWakeLockUI(active) {
    const el = this._els.wakeLockStatus;
    if (active) {
      el.textContent = '保持唤醒';
      el.className = 'badge badge-ok';
    } else {
      el.textContent = '正在获取唤醒锁…';
      el.className = 'badge badge-warn';
    }
  }

  // ─── Auto Save ───
  updateAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
    const sec = parseInt(this._els.saveInterval.value, 10);
    if (sec > 0) {
      this._autoSaveTimer = setInterval(() => {
        if (this.store.length > 0) {
          const t = this.exporter.save();
          if (t) {
            this._els.autoSaveInfo.textContent = '上次保存: ' + t.toLocaleTimeString('zh-CN', { hour12: false });
          }
        }
      }, sec * 1000);
      this._els.saveStatus.textContent = `自动保存: ${sec >= 60 ? (sec / 60) + '分钟' : sec + '秒'}`;
    } else {
      this._els.saveStatus.textContent = '自动保存: 关闭';
    }
  }

  // ─── Clear UI ───
  clearDisplay() {
    CONFIG.CHANNELS.forEach((ch) => {
      const n = ch.id + 1;
      this._els['cap' + n + 'Freq'].textContent = '--';
      this._els['cap' + n + 'Duty'].textContent = '--';
      this._els['cap' + n + 'FreqStats'].textContent = '-- / -- / --';
      this._els['cap' + n + 'DutyStats'].textContent = '-- / -- / --';
    });
    this._els.totalRecords.textContent = '0';
    this._els.recordCount.textContent = '(0条)';
    this.renderTable();
  }

  destroy() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }
}

// ─── App — 统筹者 ──────────────────────────────────────────────────
class App {
  constructor() {
    this.store = new DataStore();
    this.exporter = new ExcelExporter(this.store);
    this.ui = new UIManager(this.store, this.exporter);
    this.wakeLock = new WakeLockManager();
    this.serial = new SerialManager(this.store, () => this._onNewData());
  }

  init() {
    this.ui.bind();
    this._bindEvents();

    // Wake Lock 状态回调 + 页面打开即保持唤醒
    this.wakeLock.onChange((active) => this.ui.updateWakeLockUI(active));
    this.wakeLock.start();

    // 页面恢复可见时，wakeLock.start() 已在 handleRelease 中自动重试
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.wakeLock.active) {
        this.wakeLock.request();
      }
    });

    // 刷新端口列表
    this.ui.refreshPortList();
  }

  _bindEvents() {
    const els = this.ui._els;

    // 通道切换
    ['ch1Enable', 'ch2Enable', 'ch3Enable'].forEach((id, idx) => {
      els[id].addEventListener('change', () => {
        this.store.setEnabled(
          els.ch1Enable.checked,
          els.ch2Enable.checked,
          els.ch3Enable.checked
        );
        this.ui.renderTable();
      });
    });

    // 自动保存间隔
    els.saveInterval.addEventListener('change', () => this.ui.updateAutoSave());

    // 页面关闭
    window.addEventListener('beforeunload', () => { this.wakeLock.stop(); this.serial.disconnect(); });
  }

  // ─── Serial ───
  async connect() {
    try {
      const info = await this.serial.connect(parseInt(this.ui._els.baudRate.value, 10) || CONFIG.BAUD_DEFAULT);
      this.ui.updateSerialUI(true, info);
      this.ui.updateAutoSave();
      Log.info('已连接串口');
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('连接失败: ' + err.message);
      }
    }
  }

  disconnect() {
    this.serial.disconnect();
    this.ui.updateSerialUI(false);
    this.ui.destroy();
    this.ui.refreshPortList();
    Log.info('已断开串口');
  }

  refreshPorts() {
    this.ui.refreshPortList();
  }

  // ─── Data ───
  _onNewData() {
    this.ui.updateDisplay();
    this.ui.renderTable();
  }

  clearData() {
    if (!confirm('确认清空所有数据？')) return;
    this.store.clear();
    this.ui.clearDisplay();
  }

  // ─── Excel ───
  saveToExcel() {
    const t = this.exporter.save();
    if (t === null) {
      alert('没有数据可保存');
      return;
    }
    this.ui._els.autoSaveInfo.textContent = '上次保存: ' + t.toLocaleTimeString('zh-CN', { hour12: false });
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────
(function main() {
  const app = new App();
  app.init();

  // 暴露到全局供 onclick 调用（file:// 兼容）
  window.app = app;
  window.connectSerial = () => app.connect();
  window.disconnectSerial = () => app.disconnect();
  window.refreshPorts = () => app.refreshPorts();
  window.saveToExcel = () => app.saveToExcel();
  window.clearData = () => app.clearData();
})();
