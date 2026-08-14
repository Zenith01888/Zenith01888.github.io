# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

Web 上位机应用，每秒自动读取示波器 4 通道数据：电压(RMS/Max/Min/P-P/Avg)、电流、频率、占空比、脉宽、上升/下降时间、过冲。
内置 VISA 资源扫描、通道重命名、探头配置(型号/耦合/阻抗/偏移)、触发设置、波形捕获、余辉模式、Excel 导出。

## 技术栈

- **后端**: Python 3 + Flask + PyVISA + openpyxl
- **前端**: HTML/CSS/JS (单页面, Chart.js, Hallmark 设计系统, Geist 字体, OKLCH 调色板)
- **示波器协议**: SCPI over VISA (VXI-11 / USBTMC / serial)
- **支持厂商**: RIGOL / YOKOGAWA DLM2024 / Keysight (自动识别 *IDN?)

## 架构

```
app.py              # Flask 主入口, API 路由, 后台采集线程, Excel 导出
oscilloscope.py     # 示波器驱动: 连接/VISA扫描/多通道读取/波形/挡位/触发
config.py           # 默认参数: VISA地址、启用通道、电流模式/系数、通道名称
tokens.css          # Hallmark 设计令牌: OKLCH 颜色 / Geist 字体 / 间距 / 动效
templates/
  index.html        # 前端: 统一 Bento Grid 布局 (卡片 → 图表 → 统计 → 数据表)
static/
  app.css           # 页面样式 (Hallmark 设计系统)
  app.js            # 前端逻辑: 扫描/连接/定时刷新/导出/波形捕获/设置
tests/
  test_oscilloscope.py  # 驱动命令单元测试 (FakeInstrument, 无需硬件)
.hallmark/
  log.json          # 设计迭代记录 (Hallmark 项目记忆)
```

## 常用命令

```bash
# 安装依赖
pip install -r requirements.txt

# 启动应用
python app.py
# 访问 http://localhost:5000

# 驱动单元测试 (无需真实示波器)
python -m unittest discover -s tests -v
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 主页面 |
| GET | `/api/data` | 最新数据 (12项测量/通道) |
| GET | `/api/history` | 全部历史数据列表 |
| GET | `/api/status` | 连接状态 `{connected, resource, vendor, idn, channel_names}` |
| GET | `/api/resources` | 扫描 VISA 资源 `{resources: [...], current}` |
| POST | `/api/connect` | 切换连接 `{resource}` → `{ok, resource, connected}` |
| GET | `/api/export` | 导出 Excel (.xlsx, 12列/通道) |
| GET/POST | `/api/settings` | 读取/应用 挡位/探头/耦合/阻抗/偏移/时基/触发 |
| POST | `/api/run` | 启动示波器采集 (DLM: `:STARt`, 其他: `:RUN`) |
| POST | `/api/stop` | 停止示波器采集 (`:STOP`) |
| GET/POST | `/api/current-config` | 读取/更新 电流模式/灵敏度/量程(每通道) |
| GET/POST | `/api/channel-names` | 读取/更新 通道自定义名称 |
| GET | `/api/waveform/<ch>` | 获取单通道波形数据 |

## 关键设计

- **UI 设计系统**: Hallmark modern-minimal / Bento Grid 布局, 浅色主题, OKLCH 调色板 (paper: oklch(97% 0.004 260), accent: oklch(55% 0.19 260) blue), Geist 字体 (Google Fonts), 4pt 间距, 统一图表+统计+数据表 bento 盒
- **设计令牌**: `tokens.css` 提供可移植的 OKLCH 颜色 / 字体 / 间距 / 动效 / 圆角 / z-index 变量
- **采集间隔**: 1 秒 (可修改 `measure_loop` args)
- **多通道**: `ENABLED_CHANNELS` 控制采集哪些通道, 每通道 12 项 SCPI 测量
- **厂商适配**: YOKOGAWA DLM2000 按官方 IM 710105-17E 协议, 自动测量用 `:MEASure:CHANNEL<n>:<PARAM>:STATe ON` + `:VALue?`, 模式 `:MEASure:MODE CONTinuous`; 其他厂商用 `MEASure:...? CHANnel<n>` 命令与占空比 4 条回退
- **DLM2024 波形**: `:WAVEFORM:TRACE <n>` / `:WAVEFORM:FORMAT ASCII` / `:WAVEFORM:START` / `:WAVEFORM:END` / `:WAVEFORM:SEND?` (每次最多 12500 点, 自动分块); 时间轴用 `:WAVEFORM:SRATE?` + `:WAVEFORM:TRIGGER?`
- **DLM2024 采集**: `:ACQuire:MODE` (NORMal/AVERage/ENVelope) + `:ACQuire:RESolution` (High Res), `:ACQuire:AVERage:COUNt`, `:ACQuire:RLENgth`, `:ACQuire:SAMPling`; 运行/停止用 `:STARt`/`:STOP`
- **DLM2024 触发**: `:TRIGGER:ATRIGGER:TYPE` 映射 EDGE→SIMPle / PULSe→PULSe / RUNT→WIDTh; 源 `CH1`→数字 `1`, `EXT`→`EXTernal`; 耦合只有 AC/DC, HFRej 用 `:TRIGGER:ATRIGGER:SIMPLE:HFREJECTION 15KHZ`
- **触发模式/斜率/抑制**: DLM 用 `:TRIGGER:MODE` (AUTO/NORMal/NSINgle), `:TRIGGER:ATRIGGER:SIMPLE:SLOPE`, `:TRIGGER:HOLDOFF:TIME`; 其他厂商用 `TRIGger:SWEep` / `TRIGger:SLOPe` / `TRIGger:HOLDoff`
- **DLM2024 通道**: 偏移用 `:CHANNEL<n>:OFFSET` (V), 探头用 `:CHANNEL<n>:PROBE:MODE`, 阻抗由机械开关决定无 SCPI (读取返回 1M, 写入忽略)
- **响应解析**: 连接时发送 `:COMMUNICATE:HEADER OFF`, `_parse_scpi_float` 同时兼容带响应头/NAN/`******` 的返回
- **后台线程**: `measure_loop()` 每秒调用 `scope.read_all_channels()` 一次
- **数据模型**: `{timestamp, channels: {"1": {voltage,current,frequency,amplitude,duty_cycle,pulse_width,rise_time,fall_time,overshoot,rms,vmax,vmin,vpp}, ...}}`
- **Excel 导出**: openpyxl 生成带样式的 .xlsx, 表头深色背景白字, 每通道 12 列
- **运行时配置**: 挡位/探头/耦合/阻抗/偏移/时基/触发 均可通过 Web 面板实时修改
- **电流探头**: 支持探头型号预设(TCP0030A/2020/312A/305A/404XL/A622), 自动填充灵敏度+量程
- **通道重命名**: 点击卡片通道名内联编辑, 同步图表图例/数据表/Excel
- **视图切换**: 电压趋势 / 频率+幅值 / 时序参数 / 实时波形, CH1-4 通道筛选
- **统计面板**: 图表下方 RMS/Max/Min/P-P/Avg/Freq 实时显示
- **测试**: `tests/test_oscilloscope.py` 用 FakeInstrument 校验厂商命令生成 (DLM2024 测量/波形/设置), 无需真实硬件
