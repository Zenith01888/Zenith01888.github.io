# 示波器 Web 上位机

Web 上位机应用，每秒自动读取示波器 4 通道的 12 项测量数据。
支持 YOKOGAWA DLM2024 / RIGOL / Keysight，内置 VISA 扫描、探头配置、波形捕获、Excel 导出。

浏览器演示版部署在 `web/`，可直接打开查看界面与交互；真实仪器采集仍需本地运行 Flask 应用。

## 功能

- **12 项测量**：RMS、Max、Min、P-P、平均值、电流、频率、幅值、占空比、脉宽、上升时间、下降时间、过冲
- **厂商自动识别**：通过 `*IDN?` 识别 YOKOGAWA / RIGOL / Keysight，并自动切换命令体系
- **YOKOGAWA DLM2024 适配**：按官方 DLM2000 通信接口手册 (IM 710105-17E) 读写测量、波形与设置
- **实时采集**：每秒批量读取全部通道
- **采集设置**：Normal / Average / Envelope / High Res 采集模式、平均次数、存储深度、采样模式，运行/停止采集
- **Web 仪表盘**：Bento Grid 浅色主题，统一图表 + 统计面板 + 数据表
- **视图切换**：电压趋势 / 频率+幅值 / 时序参数 / 实时波形，通道筛选
- **探头配置**：型号预设(TCP0030A/2020/312A/305A/404XL/A622)、耦合(DC/AC)、阻抗(1MΩ/50Ω)、偏移、时基
- **电流测量**：电压模式 / 采样电阻 / 电流探头，灵敏度+量程可配
- **触发设置**：Edge/Pulse/Runt，源(CH1-4/EXT/LINE)，电平，耦合
- **波形捕获**：YOKOGAWA `:WAVEFORM:SEND?` / 通用 `WAVeform:DATA?`，余辉模式叠加，V↔A 单位切换
- **通道重命名**：点击卡片名称内联编辑，同步图例/表格/Excel
- **VISA 资源扫描**：页面点击扫描即可发现示波器
- **Excel 导出**：一键导出全部历史数据（每通道 12 列）
- **历史记录**：自动保留最近 1440 条

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

DLM2024 推荐使用 `pyvisa-py`（纯 Python VISA 后端，支持 USBTMC / VXI-11 LAN）；
如连接不稳定，可安装 NI-VISA 后改用系统 VISA 后端。

### 2. 启动

```bash
python app.py
```

浏览器打开 http://localhost:5000

### 3. 连接示波器

1. 工具栏点击 **扫描**
2. 下拉框中选择示波器地址（DLM2024 可填 `TCPIP::<主机名或IP>::INSTR` 或 USB 资源）
3. 点击 **连接**
4. 展开 **通道配置** 调整探头/耦合/偏移/时基
5. 切换到 **实时波形** 标签 → 点击 **捕获** 获取波形

## YOKOGAWA DLM2024 兼容性

连接后驱动会识别 `YOKOGAWA,DLM2024,...`，并按官方 DLM2000 通信接口手册（IM 710105-17E）
使用以下命令：

| 功能 | 命令 |
|------|------|
| 自动测量开关 | `:MEASure:CHANNEL<n>:<ITEM>:STATe ON` + `:MEASure:MODE CONTinuous` |
| 读取测量值 | `:MEASure:CHANNEL<n>:<ITEM>:VALue?` |
| 波形数据 | `:WAVEFORM:TRACE <n>` / `:WAVEFORM:FORMAT ASCII` / `:WAVEFORM:START` / `:WAVEFORM:END` / `:WAVEFORM:SEND?` |
| 波形信息 | `:WAVEFORM:SRATE?` / `:WAVEFORM:LENGTH?` / `:WAVEFORM:TRIGGER?` |
| 垂直挡位 | `:CHANNEL<n>:VDIV` |
| 探头衰减 | `:CHANNEL<n>:PROBE:MODE` |
| 偏移 | `:CHANNEL<n>:OFFSET`（单位 V） |
| 耦合 | `:CHANNEL<n>:COUPLING` |
| 时基 | `:TIMEBASE:TDIV` |
| 采集模式 | `:ACQuire:MODE`（NORMal / AVERage / ENVelope）+ `:ACQuire:RESolution`（高分辨率） |
| 平均次数 | `:ACQuire:AVERage:COUNt` |
| 存储深度 | `:ACQuire:RLENgth` |
| 采样模式 | `:ACQuire:SAMPling` |
| 触发类型 | `:TRIGGER:ATRIGGER:TYPE`（SIMPle / PULSe / WIDTh） |
| 触发模式 | `:TRIGGER:MODE`（AUTO / NORMal / NSINgle） |
| 触发源/电平/耦合 | `:TRIGGER:ATRIGGER:SIMPLE:SOURCE / LEVEL / COUPLING` |
| 触发斜率 | `:TRIGGER:ATRIGGER:SIMPLE:SLOPE` |
| 触发抑制 | `:TRIGGER:HOLDOFF:TIME` |
| 运行/停止 | `:STARt` / `:STOP` |

DLM2000 注意点：

- 首次连接会启用每通道 12 项自动测量并切换到连续测量模式；未测出的值（DLM 返回 `NAN`）显示为 `--`。
- 连接时自动发送 `:COMMUNICATE:HEADER OFF`（官方 FAQ 推荐），驱动同时兼容带响应头的返回格式。
- 输入阻抗由 DLM2024 机箱上的机械开关决定，无 SCPI 命令；面板读取固定显示 1 MΩ，写入会被忽略。
- 触发类型映射：`EDGE→SIMPle`、`PULSe→PULSe`、`RUNT→WIDTh`（DLM 无 Runt 类型，用 State Width 近似）。
- 触发耦合只有 `AC/DC`；`HF Rej` 通过 `:TRIGGER:ATRIGGER:SIMPLE:HFREJECTION 15KHZ` 设置，`LF Rej` 无对应命令。
- 触发模式 `Single` 在 DLM 上映射为 `NSINgle`；采样模式仅 YOKOGAWA 支持，其他厂商界面中该控件自动禁用。
- `:WAVEFORM:SEND?` 每次最多返回 12500 点，驱动会自动按 `START/END` 分块读取；默认读取 1000 点并围绕触发点取窗口。

`/api/run` 与 `/api/stop` 可启动/停止采集（DLM 使用 `:STARt` / `:STOP`，其他厂商使用 `:RUN` / `:STOP`）。

## 配置

编辑 `config.py`：

```python
# 启用哪些通道
ENABLED_CHANNELS = [1, 2, 3, 4]

# 每通道电流测量模式
CHANNEL_CURRENT_MODE = {
    1: "voltage",        # 仅测电压
    2: "shunt_resistor", # 电压 / 采样电阻
    3: "current_probe",  # 电流探头
    4: "voltage",
}

# 对应系数 (电阻 Ω 或灵敏度 V/A)
CHANNEL_FACTOR = {
    1: 1.0, 2: 0.1, 3: 0.1, 4: 1.0,
}

# 通道自定义名称
CHANNEL_NAMES = {1: "通道 1", 2: "通道 2", 3: "通道 3", 4: "通道 4"}
```

| 模式 | 说明 |
|------|------|
| `voltage` | 仅读取电压，电流显示为 -- |
| `shunt_resistor` | 电流 = 电压 / 电阻 |
| `current_probe` | 电流 = 电压 × 探头比率（DLM 无直接电流 SCPI，按系数换算） |

## 测试

驱动命令生成有单元测试（FakeInstrument 模拟，无需真实硬件）：

```bash
python -m unittest discover -s tests -v
```

## 文件结构

```
├── app.py               # Flask 主程序 + 后台线程 + Excel 导出
├── oscilloscope.py      # 示波器驱动 (PyVISA + SCPI, 厂商自动识别)
├── config.py            # 连接与测量参数默认值
├── requirements.txt     # Python 依赖
├── static/app.css       # 页面样式
├── static/app.js        # 前端仪表盘逻辑
├── templates/index.html # Flask Web 页面
├── web/
│   ├── index.html       # GitHub Pages 浏览器演示页面
│   └── demo.js          # 浏览器内模拟数据后端
├── tests/
│   └── test_oscilloscope.py
└── README.md
```

## 技术栈

- **后端**：Python 3 + Flask + PyVISA + openpyxl
- **前端**：HTML/CSS/JS (单页面, Chart.js, Hallmark 设计系统, Geist 字体, OKLCH 调色板)
- **示波器协议**：SCPI over VISA (VXI-11 / USBTMC / serial)
- **支持示波器**：YOKOGAWA DLM2024 / RIGOL DS1000Z / Keysight 3000T 等 SCPI 兼容设备
