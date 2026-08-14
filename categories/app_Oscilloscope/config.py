"""
配置文件 — 根据你的示波器和测量需求修改以下参数
"""

# ---- 示波器连接 ----
# VISA 资源地址。也可在 Web 页面中扫描并切换。
# 示例:
#   USB:  "USB0::0x1AB1::0x04CE::DS1ZAXXXXX::INSTR"
#   TCP:  "TCPIP::192.168.1.100::INSTR"
#   ASRL: "ASRL3::INSTR"  (串口)
VISA_RESOURCE = "TCPIP::192.168.1.100::INSTR"

# ---- 测量通道 ----
# 需要采集的通道号列表 (1-4)
ENABLED_CHANNELS = [1, 2, 3, 4]

# ---- 电流测量 (按通道配置) ----
# "voltage"        — 仅读取电压 (default)
# "shunt_resistor" — 电压 / 采样电阻 = 电流
# "current_probe"  — 使用示波器电流探头
# 每个通道可以不同模式, 格式: { 通道号: "模式" }
CHANNEL_CURRENT_MODE = {
    1: "voltage",
    2: "voltage",
    3: "voltage",
    4: "voltage",
}

# ---- 采样电阻 / 探头比率 (按通道配置) ----
# shunt_resistor 模式: 电阻值 (Ω)
# current_probe 模式: 探头比率 (A/V)
CHANNEL_FACTOR = {
    1: 1.0,
    2: 1.0,
    3: 1.0,
    4: 1.0,
}

# ---- 通讯超时 (毫秒) ----
TIMEOUT_MS = 5000

# ---- 通道名称 (支持自定义重命名) ----
CHANNEL_NAMES = {
    1: "通道 1",
    2: "通道 2",
    3: "通道 3",
    4: "通道 4",
}

# ---- 运行时可变配置 (从 Web 面板修改) ----
# CHANNEL_CURRENT_MODE / CHANNEL_FACTOR / CHANNEL_NAMES 在 app.py 中通过
# /api/current-config 和 /api/channel-names 端点运行时修改。
# 初始值在此文件中定义，运行时修改不会写回该文件。

# ---- 数据保留 ----
MAX_HISTORY_POINTS = 1440  # 保留最近 N 条记录 (1440 = 24小时, 每分钟一条)
