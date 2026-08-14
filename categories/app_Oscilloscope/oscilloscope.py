"""
示波器驱动模块 — 通过 PyVISA + SCPI 与示波器通讯
支持 YOKOGAWA DLM2024 / RIGOL / Keysight 等 SCPI 兼容示波器
"""

from __future__ import annotations
import re
import threading
from typing import Any
import pyvisa
from config import VISA_RESOURCE, ENABLED_CHANNELS, CHANNEL_CURRENT_MODE, CHANNEL_FACTOR, TIMEOUT_MS


# YOKOGAWA DLM2000 系列的自动测量参数名 (IM 710105-17E, MEASure 组)
# key 为上层数据模型字段, value 为 DLM2000 SCPI 参数名
YOKOGAWA_MEASURE_ITEMS: dict[str, str] = {
    "voltage": "AVERage",
    "rms": "RMS",
    "vmax": "MAXimum",
    "vmin": "MINimum",
    "vpp": "PTOPeak",
    "frequency": "FREQuency",
    "amplitude": "AMPLitude",
    "duty_cycle": "DUTYcycle",
    "pulse_width": "PWIDth",
    "rise_time": "RISE",
    "fall_time": "FALL",
    "overshoot": "POVershoot",
}

# DLM2000 的 :TRIGger:ATRIGger:TYPE 取值 (SIMPle/PULSe/WIDTh...)
YOKOGAWA_TRIGGER_TYPES: dict[str, str] = {
    "EDGE": "SIMPle",
    "PULSE": "PULSe",
    "RUNT": "WIDTh",
}

# 每次 :WAVeform:SEND? 最多返回 12500 个采样点 (官方 FAQ 确认)
YOKOGAWA_WAVEFORM_CHUNK = 12500


class Oscilloscope:
    """示波器驱动，封装 SCPI 命令用于多通道测量

    自动检测仪器厂商 (RIGOL / YOKOGAWA / Keysight / 其他)，
    根据厂商适配 SCPI 命令格式。
    """

    # ------------------------------------------------------------------
    # 静态工具
    # ------------------------------------------------------------------

    @staticmethod
    def list_resources() -> list[str]:
        """扫描系统中所有可用的 VISA 资源，返回地址列表"""
        try:
            rm = pyvisa.ResourceManager()
            resources = rm.list_resources()
            rm.close()
            return list(resources)
        except Exception as e:
            print(f"[扫描 VISA 资源失败] {e}")
            return []

    # ------------------------------------------------------------------
    # 初始化
    # ------------------------------------------------------------------

    def __init__(self, resource_name: str = VISA_RESOURCE):
        self.resource_name = resource_name
        self.rm: pyvisa.ResourceManager | None = None
        self.instr: pyvisa.Resource | None = None
        self._lock = threading.Lock()
        self.vendor: str = "unknown"      # rigol / yokogawa / keysight / unknown
        self.idn: str = ""                # *IDN? 原始返回
        self._yokogawa_meas_ready = False

    # ------------------------------------------------------------------
    # 连接管理
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        """连接示波器，自动识别厂商，成功返回 True"""
        with self._lock:
            try:
                self.rm = pyvisa.ResourceManager()
                self.instr = self.rm.open_resource(self.resource_name)
                self.instr.timeout = TIMEOUT_MS
                self.idn = self.instr.query("*IDN?").strip()
                self._detect_vendor()
                self._yokogawa_meas_ready = False
                if self.vendor == "yokogawa":
                    # 官方手册建议程序化读取时关闭响应头，避免解析头前缀
                    try:
                        self.instr.write(":COMMUNICATE:HEADER OFF")
                    except Exception:
                        pass
                print(f"[连接成功] {self.idn}  → 识别为 {self.vendor}")
                return True
            except Exception as e:
                print(f"[连接失败] {e}")
                self.instr = None
                self.vendor = "unknown"
                self.idn = ""
                self._yokogawa_meas_ready = False
                return False

    def _detect_vendor(self):
        """从 *IDN? 响应中识别仪器厂商"""
        upper = self.idn.upper()
        if "YOKOGAWA" in upper or "DLM" in upper:
            self.vendor = "yokogawa"
        elif "RIGOL" in upper:
            self.vendor = "rigol"
        elif "KEYSIGHT" in upper or "AGILENT" in upper or "HEWLETT" in upper:
            self.vendor = "keysight"
        else:
            self.vendor = "unknown"

    def switch_and_connect(self, new_resource: str) -> bool:
        """切换到新地址并重新连接"""
        self.disconnect()
        self.resource_name = new_resource
        return self.connect()

    def disconnect(self):
        """断开连接"""
        if self.instr:
            try:
                self.instr.close()
            except Exception:
                pass
            self.instr = None
        if self.rm:
            try:
                self.rm.close()
            except Exception:
                pass
            self.rm = None
        self.vendor = "unknown"
        self.idn = ""
        self._yokogawa_meas_ready = False

    @property
    def is_connected(self) -> bool:
        return self.instr is not None

    # ------------------------------------------------------------------
    # 通道名称适配 (YOKOGAWA DLM2000 命令格式)
    # ------------------------------------------------------------------
    # YOKOGAWA DLM2000: :CHANNEL1:VDIV / COUPLING / OFFSET / PROBE:MODE
    #                    :WAVEFORM:TRACE / SEND / SRATE
    #                    :TIMEBASE:TDIV
    #                    :TRIGGER:ATRIGGER:TYPE / SIMPLE:SOURCE / LEVEL
    # RIGOL/generic:     CHANnel1:SCALe / COUPling / OFFSet / PROBe
    #                    WAVeform:SOURce / DATA? / PREamble?
    #                    TIMebase:SCALe
    #                    TRIGger:SOURce / LEVel / TYPE / COUPling

    def _ch(self, channel: int) -> str:
        """返回通道标识符 (用于 MEASure 命令)"""
        if self.vendor == "yokogawa":
            return f"CH{channel}"
        return f"CHANnel{channel}"

    def _ch_cmd(self, channel: int, cmd: str) -> str:
        """根据厂商构建通道配置命令

        YOKOGAWA:  :CHANNEL<n>:VDIV / COUPLING / POSITION / PROBE
        通用:      CHANnel<n>:SCALe / COUPling / OFFSet / PROBe
        """
        if self.vendor == "yokogawa":
            return f":CHANNEL{channel}:{cmd}"
        return f"CHANnel{channel}:{cmd}"

    def _scpi_vertical(self, channel: int) -> str:
        """垂直挡位命令"""
        if self.vendor == "yokogawa": return f":CHANNEL{channel}:VDIV"
        return f"CHANnel{channel}:SCALe"

    def _scpi_coupling(self, channel: int) -> str:
        if self.vendor == "yokogawa": return f":CHANNEL{channel}:COUPLING"
        return f"CHANnel{channel}:COUPling"

    def _scpi_offset(self, channel: int) -> str:
        # DLM2000: OFFSET 单位为 V; POSITION 才是格数, 这里用 OFFSET 保持与上层 "偏移(V)" 一致
        if self.vendor == "yokogawa": return f":CHANNEL{channel}:OFFSET"
        return f"CHANnel{channel}:OFFSet"

    def _scpi_probe(self, channel: int) -> str:
        if self.vendor == "yokogawa": return f":CHANNEL{channel}:PROBE:MODE"
        return f"CHANnel{channel}:PROBe"

    def _scpi_impedance(self, channel: int) -> str:
        # YOKOGAWA DLM2000: 输入阻抗由机械开关决定, 无 SCPI 命令
        if self.vendor == "yokogawa":
            return None
        return f"CHANnel{channel}:IMPedance"

    def _scpi_timebase(self) -> str:
        if self.vendor == "yokogawa": return ":TIMEBASE:TDIV"
        return "TIMebase:SCALe"

    def _scpi_wave_source(self) -> str:
        if self.vendor == "yokogawa": return ":WAVEFORM:TRACE"
        return "WAVeform:SOURce"

    def _scpi_wave_data(self) -> str:
        if self.vendor == "yokogawa": return ":WAVEFORM:SEND?"
        return "WAVeform:DATA?"

    def _scpi_wave_preamble(self) -> str:
        if self.vendor == "yokogawa": return ":WAVEFORM:SRATE?"
        return "WAVeform:PREamble?"

    def _scpi_trig_source(self) -> str:
        if self.vendor == "yokogawa": return ":TRIGGER:ATRIGGER:SIMPLE:SOURCE"
        return "TRIGger:SOURce"

    def _scpi_trig_level(self) -> str:
        if self.vendor == "yokogawa": return ":TRIGGER:ATRIGGER:SIMPLE:LEVEL"
        return "TRIGger:LEVel"

    def _scpi_trig_type(self) -> str:
        if self.vendor == "yokogawa": return ":TRIGGER:ATRIGGER:TYPE"
        # RIGOL / Keysight 用 TRIGger:MODE 选择触发类型 (EDGE/PULSe/RUNT...)
        return "TRIGger:MODE"

    def _scpi_trig_coupling(self) -> str:
        if self.vendor == "yokogawa": return ":TRIGGER:ATRIGGER:SIMPLE:COUPLING"
        return "TRIGger:COUPling"

    # --- 采集系统 (vendor-aware) ---
    def _scpi_acq_mode(self) -> str:
        if self.vendor == "yokogawa": return ":ACQuire:MODE"
        return "ACQuire:MODE"

    def _scpi_acq_average(self) -> str:
        if self.vendor == "yokogawa": return ":ACQuire:AVERage:COUNt"
        return "ACQuire:AVERage:COUNt"

    def _scpi_acq_record(self) -> str | None:
        if self.vendor == "yokogawa": return ":ACQuire:RLENgth"
        if self.vendor == "rigol": return "ACQuire:MDEPth"
        return None

    def _scpi_acq_sampling(self) -> str | None:
        if self.vendor == "yokogawa": return ":ACQuire:SAMPling"
        return None

    def _scpi_acq_high_res(self) -> str | None:
        if self.vendor == "yokogawa": return ":ACQuire:RESolution"
        return None

    def _scpi_trig_mode(self) -> str:
        # 触发模式 (Auto/Normal/Single), 与触发类型命令不同
        if self.vendor == "yokogawa": return ":TRIGGER:MODE"
        return "TRIGger:SWEep"

    def _scpi_trig_slope(self) -> str:
        if self.vendor == "yokogawa": return ":TRIGGER:ATRIGGER:SIMPLE:SLOPE"
        return "TRIGger:SLOPe"

    def _scpi_trig_holdoff(self) -> str:
        if self.vendor == "yokogawa": return ":TRIGGER:HOLDOFF:TIME"
        return "TRIGger:HOLDoff"

    def _yokogawa_trig_source_value(self, src: str) -> str:
        """把 UI 的 CH1/EXT/LINE 转成 DLM2000 源值 (通道用数字)"""
        s = str(src).strip().upper()
        if s in ("EXT", "EXTERNAL", "EXTERN"):
            return "EXTernal"
        if s == "LINE":
            return "LINE"
        m = re.fullmatch(r"CH(\d)", s)
        if m:
            return str(int(m.group(1)))
        return s

    def _yokogawa_trig_source_label(self, raw: str) -> str:
        """把 DLM2000 源值 (1/EXTernal/LINE) 转回 UI 的 CH1/EXT/LINE"""
        s = str(raw).strip().upper()
        if s.startswith("EXT"):
            return "EXT"
        if s == "LINE":
            return "LINE"
        if s.isdigit():
            return f"CH{int(s)}"
        m = re.fullmatch(r"CH(\d)", s)
        if m:
            return s
        return raw.strip() or "CH1"

    def _yokogawa_trig_type_value(self, ttype: str) -> str:
        """把 UI 的 EDGE/PULSe/RUNT 转成 DLM2000 触发类型"""
        return YOKOGAWA_TRIGGER_TYPES.get(str(ttype).strip().upper(), "SIMPle")

    def _yokogawa_trig_type_label(self, raw: str) -> str:
        """把 DLM2000 触发类型转回 UI 值 (RUNT 对应 DLM 的 WIDTh 状态宽度触发)"""
        s = str(raw).strip().upper()
        if s in ("SIMPLE", "EDGE"):
            return "EDGE"
        if s == "PULSE":
            return "PULSe"
        if s == "WIDTH":
            return "RUNT"
        return "EDGE"

    def _trig_mode_value(self, mode: str) -> str:
        """UI 的 AUTO/NORM/SING -> 厂商触发模式值"""
        s = str(mode).strip().upper()
        if s.startswith("SING"):
            return "NSINgle" if self.vendor == "yokogawa" else "SINGle"
        if s.startswith("NORM"):
            return "NORMal"
        return "AUTO"

    def _trig_mode_label(self, raw: str) -> str:
        """厂商触发模式值 -> UI 的 AUTO/NORM/SING"""
        s = str(raw).strip().upper()
        if "SING" in s:
            return "SING"
        if "NORM" in s:
            return "NORM"
        return "AUTO"

    def _acq_mode_value(self, mode: str) -> str:
        """UI 的 NORM/AVER/ENV/HRES -> 厂商采集模式值"""
        s = str(mode).strip().upper()
        if s.startswith("AVER"):
            return "AVERage"
        if s.startswith("ENV"):
            return "ENVelope"
        return "NORMal"

    def _acq_mode_label(self, raw: str) -> str:
        """厂商采集模式值 -> UI 的 NORM/AVER/ENV/HRES"""
        s = str(raw).strip().upper()
        if "AVER" in s:
            return "AVER"
        if "ENV" in s:
            return "ENV"
        return "NORM"

    # ------------------------------------------------------------------
    # 底层 SCPI
    # ------------------------------------------------------------------

    def _query(self, cmd: str) -> str:
        if not self.instr:
            raise ConnectionError("示波器未连接")
        with self._lock:
            return self.instr.query(cmd).strip()

    def _write(self, cmd: str) -> None:
        if not self.instr:
            raise ConnectionError("Oscilloscope not connected")
        with self._lock:
            self.instr.write(cmd)

    def _try_query(self, *cmds: str) -> str | None:
        """依次尝试多条 SCPI 命令，返回第一条成功的，全部失败返回 None"""
        for cmd in cmds:
            try:
                return self._query(cmd)
            except Exception:
                continue
        return None

    # ------------------------------------------------------------------
    # Single-channel measurement helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_scpi_float(raw: str | None) -> float | None:
        """从 SCPI 响应中提取数值; 兼容带响应头的响应与 NAN/****** 等不可测占位"""
        if raw is None:
            return None
        text = str(raw).strip()
        if not text or text.upper() in ("NAN", "NAN ", "******", "*****", "--"):
            return None
        m = re.search(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][-+]?\d+)?\s*$", text)
        if not m:
            return None
        try:
            return float(m.group(0))
        except ValueError:
            return None

    def _read_scpi_float(self, cmd: str) -> float:
        """Query a float value; raises on failure."""
        value = self._parse_scpi_float(self._query(cmd))
        if value is None:
            raise ValueError(f"无法解析 SCPI 数值响应: {cmd}")
        return value

    def _try_query_number(self, *cmds: str) -> float | None:
        """依次尝试多条查询命令, 返回第一个可解析的数值, 全部失败返回 None"""
        for cmd in cmds:
            try:
                raw = self._query(cmd)
            except Exception:
                continue
            value = self._parse_scpi_float(raw)
            if value is not None:
                return value
        return None

    def _read_yokogawa_measure(self, channel: int, key: str) -> float | None:
        """按 DLM2000 官方协议读取通道测量值 (:MEASure:CHANNEL<n>:<ITEM>:VALue?)"""
        param = YOKOGAWA_MEASURE_ITEMS.get(key)
        if param is None:
            return None
        return self._parse_scpi_float(self._query(f":MEASure:CHANNEL{channel}:{param}:VALue?"))

    def _prepare_yokogawa_measurements(self, channels: list[int] | None = None) -> None:
        """首次连接后启用 DLM2000 自动测量项并切换到连续测量模式"""
        if self.vendor != "yokogawa" or self._yokogawa_meas_ready:
            return
        channels = channels or ENABLED_CHANNELS
        try:
            self._write(":COMMUNICATE:HEADER OFF")
        except Exception:
            pass
        for ch in channels:
            for param in YOKOGAWA_MEASURE_ITEMS.values():
                try:
                    self._write(f":MEASure:CHANNEL{ch}:{param}:STATe ON")
                except Exception:
                    pass
        try:
            self._write(":MEASure:MODE CONTinuous")
            self._yokogawa_meas_ready = True
        except Exception:
            pass

    # --- Standard measurements (vendor-aware) ---

    def read_mean_voltage(self, channel: int) -> float | None:
        """读取指定通道的平均电压 (V)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "voltage")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:MEAN? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取平均值")
        return value

    def read_duty_cycle(self, channel: int) -> float:
        """读取占空比 (0~100, %)

        不同厂商命令略有差异，按优先级依次尝试：
        1. MEASure:DUTYcycle?        (RIGOL / Keysight)
        2. MEASure:DUTY?             (YOKOGAWA)
        3. MEASure:PDUTYcycle?       (负占空比回退)
        4. MEASure:PDUTY?            (YOKOGAWA 负占空比)
        """
        if self.vendor == "yokogawa":
            value = self._read_yokogawa_measure(channel, "duty_cycle")
            if value is None:
                raise ValueError(f"CH{channel}: 无法读取占空比")
            return value
        ch = self._ch(channel)
        value = self._try_query_number(
            f"MEASure:DUTYcycle? {ch}",
            f"MEASure:DUTY? {ch}",
            f"MEASure:PDUTYcycle? {ch}",
            f"MEASure:PDUTY? {ch}",
        )
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取占空比")
        return value

    def _read_current_scpi(self, channel: int) -> float | None:
        """尝试多条电流命令"""
        if self.vendor == "yokogawa":
            # DLM2000 无直接电流 SCPI 参数, 交给上层按电压×系数换算
            return None
        ch = self._ch(channel)
        return self._try_query_number(f"MEASure:CURRent:DC? {ch}")

    # --- 新增测量项 ---

    def read_rms(self, channel: int) -> float:
        """读取 RMS 电压 (V)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "rms")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:VRMS? {ch}", f"MEASure:RMS? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取 RMS")
        return value

    def read_vmax(self, channel: int) -> float:
        """读取最大值 (V)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "vmax")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:VMAX? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取 VMAX")
        return value

    def read_vmin(self, channel: int) -> float:
        """读取最小值 (V)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "vmin")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:VMIN? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取 VMIN")
        return value

    def read_vpp(self, channel: int) -> float:
        """读取峰峰值 (Vpp)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "vpp")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:VPP? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取 VPP")
        return value

    def read_frequency(self, channel: int) -> float:
        """读取频率 (Hz)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "frequency")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:FREQuency? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取频率")
        return value

    def read_pulse_width(self, channel: int) -> float:
        """读取正脉宽 (s)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "pulse_width")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:PWIDth? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取脉宽")
        return value

    def read_amplitude(self, channel: int) -> float:
        """读取幅值 (Vpp)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "amplitude")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:VAMPlitude? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取幅值")
        return value

    def read_rise_time(self, channel: int) -> float:
        """读取上升时间 (s)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "rise_time")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:RISetime? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取上升时间")
        return value

    def read_fall_time(self, channel: int) -> float:
        """读取下降时间 (s)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "fall_time")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:FALLtime? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取下降时间")
        return value

    def read_overshoot(self, channel: int) -> float:
        """读取过冲 (%)"""
        if self.vendor == "yokogawa":
            return self._read_yokogawa_measure(channel, "overshoot")
        ch = self._ch(channel)
        value = self._try_query_number(f"MEASure:OVERshoot? {ch}")
        if value is None:
            raise ValueError(f"CH{channel}: 无法读取过冲")
        return value

    def read_waveform(self, channel: int, points: int = 1000) -> dict:
        """读取通道波形数据

        YOKOGAWA DLM2000: :WAVEFORM:TRACE <n>, :WAVEFORM:FORMAT ASCII,
                          :WAVEFORM:START/END, :WAVEFORM:SEND?
                          (每次 SEND? 最多 12500 点, 官方 FAQ 确认)
        通用:            WAVeform:SOURce, WAVeform:DATA?
        Returns: {"x": [time_values], "y": [voltage_values], "dt": float, "t0": float}
        """
        if self.vendor == "yokogawa":
            return self._read_waveform_yokogawa(channel, points)

        # Generic / RIGOL approach
        ch = self._ch(channel)
        self._write(f"WAVeform:SOURce {ch}")
        self._write("WAVeform:FORMat ASCii")
        self._write(f"WAVeform:POINts {points}")
        pre = self._query("WAVeform:PREamble?")
        parts = pre.split(",")
        dt = self._parse_scpi_float(parts[4] if len(parts) > 4 else "") or 1.0
        t0 = self._parse_scpi_float(parts[5] if len(parts) > 5 else "") or 0.0
        raw = self._query("WAVeform:DATA?")
        y_vals = []
        for token in raw.replace(";", ",").split(","):
            value = self._parse_scpi_float(token)
            if value is not None:
                y_vals.append(value)
        x_vals = [t0 + i * dt for i in range(len(y_vals))]
        return {"x": x_vals, "y": y_vals, "dt": dt, "t0": t0}

    def _read_waveform_yokogawa(self, channel: int, points: int = 1000) -> dict:
        """按 DLM2000 官方协议读取波形 (IM 710105-17E + 官方 FAQ 序列)"""
        self._write(f":WAVEFORM:TRACE {channel}")
        self._write(":WAVEFORM:RECORD 0")
        self._write(":WAVEFORM:FORMAT ASCII")

        srate = self._parse_scpi_float(self._query(":WAVEFORM:SRATE?"))
        dt = 1.0 / srate if srate and srate > 0 else 1e-9
        total_len = int(self._parse_scpi_float(self._query(":WAVEFORM:LENGTH?")) or points)
        trig = int(self._parse_scpi_float(self._query(":WAVEFORM:TRIGGER?")) or 0)
        if total_len <= 0:
            total_len = points

        # 以触发点为中心取 points 个点, 并限制在记录范围内
        start = max(0, min(trig - points // 2, max(0, total_len - 1)))
        end = min(total_len - 1, start + points - 1)

        y_vals: list[float] = []
        for chunk_start in range(start, end + 1, YOKOGAWA_WAVEFORM_CHUNK):
            chunk_end = min(chunk_start + YOKOGAWA_WAVEFORM_CHUNK - 1, end)
            self._write(f":WAVEFORM:START {chunk_start}")
            self._write(f":WAVEFORM:END {chunk_end}")
            raw = self._query(":WAVEFORM:SEND?")
            for token in raw.replace(";", ",").split(","):
                value = self._parse_scpi_float(token)
                if value is not None:
                    y_vals.append(value)
            if len(y_vals) >= points:
                break

        if len(y_vals) > points:
            step = max(1, len(y_vals) // points)
            y_vals = y_vals[::step][:points]

        # TRIGGER? 返回记录起点到触发点的采样点数, 用它在 X 轴上定位 t=0
        x_vals = [(start + i - trig) * dt for i in range(len(y_vals))]
        return {"x": x_vals, "y": y_vals, "dt": dt, "t0": -trig * dt}

    # ------------------------------------------------------------------
    # 示波器挡位 / 探头 / 时基 / 耦合 / 阻抗 / 偏移 / 触发 读写
    # ------------------------------------------------------------------

    # --- 垂直系统 (vendor-aware) ---
    def get_vertical_scale(self, channel: int) -> float: return self._read_scpi_float(f"{self._scpi_vertical(channel)}?")
    def set_vertical_scale(self, channel: int, scale: float): self._write(f"{self._scpi_vertical(channel)} {scale}")
    def get_probe(self, channel: int) -> int:
        try: return int(self._read_scpi_float(f"{self._scpi_probe(channel)}?"))
        except: return 1
    def set_probe(self, channel: int, ratio: int):
        try: self._write(f"{self._scpi_probe(channel)} {ratio}")
        except: pass
    def get_coupling(self, channel: int) -> str:
        try: return self._query(f"{self._scpi_coupling(channel)}?").upper()
        except: return "DC"
    def set_coupling(self, channel: int, mode: str): self._write(f"{self._scpi_coupling(channel)} {mode}")
    def get_impedance(self, channel: int) -> str:
        cmd = self._scpi_impedance(channel)
        if cmd is None:
            # DLM2000 输入阻抗由机械开关决定, 无 SCPI 命令, 返回默认值
            return "1M"
        try: return self._query(f"{cmd}?").upper()
        except: return "1M"
    def set_impedance(self, channel: int, imp: str):
        cmd = self._scpi_impedance(channel)
        if cmd is None:
            return  # DLM2000 无 SCPI 阻抗设置, 保持硬件开关状态
        try: self._write(f"{cmd} {imp}")
        except: pass
    def get_offset(self, channel: int) -> float: return self._read_scpi_float(f"{self._scpi_offset(channel)}?")
    def set_offset(self, channel: int, offset: float): self._write(f"{self._scpi_offset(channel)} {offset}")

    # --- 水平系统 ---
    def get_timebase(self) -> float: return self._read_scpi_float(f"{self._scpi_timebase()}?")
    def set_timebase(self, scale: float): self._write(f"{self._scpi_timebase()} {scale}")

    # --- 触发系统 ---
    def get_trigger_type(self) -> str:
        if self.vendor == "yokogawa":
            try: return self._yokogawa_trig_type_label(self._query(f"{self._scpi_trig_type()}?"))
            except Exception: return "EDGE"
        try:
            raw = self._query(f"{self._scpi_trig_type()}?").upper()
            if raw.startswith("PULSE"):
                return "PULSe"
            if raw.startswith("RUNT"):
                return "RUNT"
            if raw.startswith("EDGE"):
                return "EDGE"
            return raw or "EDGE"
        except: return "EDGE"
    def set_trigger_type(self, ttype: str):
        if self.vendor == "yokogawa":
            self._write(f"{self._scpi_trig_type()} {self._yokogawa_trig_type_value(ttype)}")
            return
        self._write(f"{self._scpi_trig_type()} {ttype}")
    def get_trigger_source(self) -> str:
        if self.vendor == "yokogawa":
            try: return self._yokogawa_trig_source_label(self._query(f"{self._scpi_trig_source()}?"))
            except Exception: return "CH1"
        try: return self._query(f"{self._scpi_trig_source()}?").upper()
        except: return "CH1"
    def set_trigger_source(self, src: str):
        if self.vendor == "yokogawa":
            self._write(f"{self._scpi_trig_source()} {self._yokogawa_trig_source_value(src)}")
            return
        self._write(f"{self._scpi_trig_source()} {src}")
    def get_trigger_level(self) -> float:
        try: return self._read_scpi_float(f"{self._scpi_trig_level()}?")
        except: return 1.0
    def set_trigger_level(self, level: float): self._write(f"{self._scpi_trig_level()} {level}")
    def get_trigger_coupling(self) -> str:
        try: return self._query(f"{self._scpi_trig_coupling()}?").upper()
        except: return "DC"
    def set_trigger_coupling(self, mode: str):
        if self.vendor == "yokogawa":
            # DLM2000 只有 AC/DC; HFRej 通过 HFREJECTION 单独设置, LFRej 无对应命令
            norm = str(mode).strip().upper()
            if norm in ("HFREJ", "HFREJECTION"):
                self._write(f"{self._scpi_trig_coupling()} AC")
                try: self._write(":TRIGGER:ATRIGGER:SIMPLE:HFREJECTION 15KHZ")
                except Exception: pass
                return
            if norm in ("LFREJ", "LFREJECTION"):
                self._write(f"{self._scpi_trig_coupling()} AC")
                return
            self._write(f"{self._scpi_trig_coupling()} {norm}")
            return
        self._write(f"{self._scpi_trig_coupling()} {mode}")

    def get_trigger_mode(self) -> str:
        try: return self._trig_mode_label(self._query(f"{self._scpi_trig_mode()}?"))
        except Exception: return "AUTO"
    def set_trigger_mode(self, mode: str):
        self._write(f"{self._scpi_trig_mode()} {self._trig_mode_value(mode)}")

    def get_trigger_slope(self) -> str:
        try:
            raw = self._query(f"{self._scpi_trig_slope()}?").upper()
            return "FALL" if raw.startswith("FALL") else "RISE"
        except Exception:
            return "RISE"
    def set_trigger_slope(self, slope: str):
        s = str(slope).strip().upper()
        self._write(f"{self._scpi_trig_slope()} {s if s.startswith('FALL') else 'RISE'}")

    def get_trigger_holdoff(self) -> float:
        try: return self._read_scpi_float(f"{self._scpi_trig_holdoff()}?")
        except Exception: return 0.0
    def set_trigger_holdoff(self, seconds: float):
        self._write(f"{self._scpi_trig_holdoff()} {seconds}")

    # --- 采集系统读写 ---
    def get_acquisition(self) -> dict:
        """读取采集模式/平均次数/记录长度/采样模式"""
        acq = {
            "mode": "NORM",
            "average_count": 16,
            "record_length": 12500,
            "sampling": "REAL",
            "high_res": False,
        }
        mode_cmd = self._scpi_acq_mode()
        if mode_cmd:
            raw = self._try_query(f"{mode_cmd}?", "ACQuire:TYPE?")
            if raw:
                upper = raw.upper()
                acq["mode"] = "HRES" if "HRES" in upper or "HRMODE" in upper else self._acq_mode_label(raw)
        hr_cmd = self._scpi_acq_high_res()
        if hr_cmd:
            try:
                acq["high_res"] = (self._parse_scpi_float(self._query(f"{hr_cmd}?")) or 0) > 0
                if acq["high_res"]:
                    acq["mode"] = "HRES"
            except Exception:
                pass
        avg_cmd = self._scpi_acq_average()
        if avg_cmd:
            try:
                v = self._parse_scpi_float(self._query(f"{avg_cmd}?"))
                if v: acq["average_count"] = int(v)
            except Exception:
                pass
        rec_cmd = self._scpi_acq_record()
        if rec_cmd:
            try:
                v = self._parse_scpi_float(self._query(f"{rec_cmd}?"))
                if v: acq["record_length"] = int(v)
            except Exception:
                pass
        samp_cmd = self._scpi_acq_sampling()
        if samp_cmd:
            try:
                raw = self._query(f"{samp_cmd}?").upper()
                if raw.startswith("INT"):
                    acq["sampling"] = "INT"
                elif raw.startswith("REP"):
                    acq["sampling"] = "REP"
                else:
                    acq["sampling"] = "REAL"
            except Exception:
                pass
        return acq

    def apply_acquisition(self, acq: dict):
        """批量应用采集模式/平均次数/记录长度/采样模式"""
        mode = str(acq.get("mode", "NORM")).strip().upper()
        hr_cmd = self._scpi_acq_high_res()
        if mode.startswith("HRES"):
            if hr_cmd:
                self._write(f"{hr_cmd} ON")
                self._write(f"{self._scpi_acq_mode()} NORMal")
            else:
                try: self._write("ACQuire:TYPE HRESolution")
                except Exception: self._write(f"{self._scpi_acq_mode()} NORMal")
        else:
            if hr_cmd:
                try: self._write(f"{hr_cmd} OFF")
                except Exception: pass
            self._write(f"{self._scpi_acq_mode()} {self._acq_mode_value(mode)}")
        if "average_count" in acq:
            avg_cmd = self._scpi_acq_average()
            if avg_cmd:
                self._write(f"{avg_cmd} {int(acq['average_count'])}")
        if "record_length" in acq:
            rec_cmd = self._scpi_acq_record()
            if rec_cmd:
                self._write(f"{rec_cmd} {int(acq['record_length'])}")
        if "sampling" in acq:
            samp_cmd = self._scpi_acq_sampling()
            if samp_cmd:
                s = str(acq["sampling"]).upper()
                value = "REPetitive" if s.startswith("REP") else ("INTerporate" if s.startswith("INT") else "REAL")
                self._write(f"{samp_cmd} {value}")

    # --- 运行控制 ---
    def run(self):
        self._write(":STARt" if self.vendor == "yokogawa" else ":RUN")
    def stop(self):
        self._write(":STOP")

    # --- 批量读写 ---
    def get_all_settings(self) -> dict:
        """读取示波器全部设置"""
        s = {"timebase": 0.001, "acquisition": {}, "trigger": {}, "channels": {}}
        try: s["timebase"] = self.get_timebase()
        except Exception as e: print(f"[设置] 读取时基失败: {e}")
        s["acquisition"] = self.get_acquisition()
        # Trigger
        for key, fn in [("type",self.get_trigger_type),("mode",self.get_trigger_mode),
                         ("source",self.get_trigger_source),("level",self.get_trigger_level),
                         ("coupling",self.get_trigger_coupling),("slope",self.get_trigger_slope),
                         ("holdoff",self.get_trigger_holdoff)]:
            try: s["trigger"][key]=fn()
            except: pass
        # Channels
        for ch in ENABLED_CHANNELS:
            try:
                s["channels"][str(ch)] = {
                    "scale": self.get_vertical_scale(ch), "probe": self.get_probe(ch),
                    "coupling": self.get_coupling(ch), "impedance": self.get_impedance(ch),
                    "offset": round(self.get_offset(ch), 4),
                }
            except Exception as e: print(f"[设置] 读取CH{ch}失败: {e}")
        return s

    def apply_settings(self, settings: dict):
        """批量应用设置到示波器"""
        if "timebase" in settings: self.set_timebase(float(settings["timebase"]))
        if "acquisition" in settings: self.apply_acquisition(settings["acquisition"])
        if "trigger" in settings:
            t = settings["trigger"]
            if "type" in t: self.set_trigger_type(t["type"])
            if "mode" in t: self.set_trigger_mode(t["mode"])
            if "source" in t: self.set_trigger_source(t["source"])
            if "level" in t: self.set_trigger_level(float(t["level"]))
            if "coupling" in t: self.set_trigger_coupling(t["coupling"])
            if "slope" in t: self.set_trigger_slope(t["slope"])
            if "holdoff" in t: self.set_trigger_holdoff(float(t["holdoff"]))
        if "channels" in settings:
            for ch_str, cfg in settings["channels"].items():
                ch = int(ch_str)
                if ch not in ENABLED_CHANNELS: continue
                if "scale" in cfg: self.set_vertical_scale(ch, float(cfg["scale"]))
                if "probe" in cfg: self.set_probe(ch, int(cfg["probe"]))
                if "coupling" in cfg: self.set_coupling(ch, cfg["coupling"])
                if "impedance" in cfg: self.set_impedance(ch, cfg["impedance"])
                if "offset" in cfg: self.set_offset(ch, float(cfg["offset"]))

    # ------------------------------------------------------------------
    # 多通道批量读取
    # ------------------------------------------------------------------

    def read_all_channels(
        self,
        channels: list[int] | None = None,
    ) -> dict[int, dict]:
        """读取所有启用通道的测量值

        Returns:
            {
                channel: {
                    "voltage": float,
                    "current": float | None,
                    "duty_cycle": float | None,
                },
                ...
            }
        """
        if channels is None:
            channels = ENABLED_CHANNELS

        if self.vendor == "yokogawa":
            self._prepare_yokogawa_measurements(channels)

        # Snapshot mutable configs to avoid tearing mid-iteration
        current_mode = dict(CHANNEL_CURRENT_MODE)
        current_factor = dict(CHANNEL_FACTOR)

        result: dict[int, dict] = {}
        for ch in channels:
            ch_data: dict = {
                "voltage": None,
                "current": None,
                "duty_cycle": None,
                "frequency": None,
                "pulse_width": None,
                "amplitude": None,
                "rise_time": None,
                "fall_time": None,
                "overshoot": None,
                "rms": None,
                "vmax": None,
                "vmin": None,
                "vpp": None,
            }

            # --- 全部测量项 (逐项容错, 未测出/不支持时保持 None) ---
            for key, fn, digits in [
                ("voltage", self.read_mean_voltage, 6),
                ("rms", self.read_rms, 6),
                ("vmax", self.read_vmax, 6),
                ("vmin", self.read_vmin, 6),
                ("vpp", self.read_vpp, 6),
                ("duty_cycle", self.read_duty_cycle, 4),
                ("frequency", self.read_frequency, 2),
                ("amplitude", self.read_amplitude, 6),
                ("pulse_width", self.read_pulse_width, 9),
                ("rise_time", self.read_rise_time, 9),
                ("fall_time", self.read_fall_time, 9),
                ("overshoot", self.read_overshoot, 4),
            ]:
                try:
                    value = fn(ch)
                except Exception as e:
                    print(f"[CH{ch}] {key} failed: {e}")
                    continue
                if value is not None:
                    ch_data[key] = round(float(value), digits)

            # --- Current (computed from voltage if needed) ---
            mode = current_mode.get(ch, "voltage")
            factor = current_factor.get(ch, 1.0)

            if mode == "current_probe":
                raw = self._read_current_scpi(ch)
                if raw is not None:
                    ch_data["current"] = round(raw, 6)
                elif ch_data.get("voltage") is not None:
                    ch_data["current"] = round(ch_data["voltage"] * factor, 6)
            elif mode == "shunt_resistor" and ch_data.get("voltage") is not None and factor:
                ch_data["current"] = round(ch_data["voltage"] / factor, 6)
            # else "voltage": current stays None

            result[ch] = ch_data

        return result
