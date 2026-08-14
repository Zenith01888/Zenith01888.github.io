"""针对 YOKOGAWA DLM2024 / 通用 SCPI 命令生成的单元测试 (无需真实硬件)"""

import unittest

from oscilloscope import Oscilloscope, YOKOGAWA_MEASURE_ITEMS


class FakeInstrument:
    """模拟 pyvisa 资源: 记录写入的命令, 按查询命令返回预设响应"""

    def __init__(self, responses=None):
        self.responses = dict(responses or {})
        self.writes: list[str] = []
        self.queries: list[str] = []
        self.timeout = 5000

    def write(self, cmd):
        self.writes.append(cmd)

    def query(self, cmd):
        self.queries.append(cmd)
        if cmd not in self.responses:
            raise OSError(f"no canned response for: {cmd}")
        value = self.responses[cmd]
        return value() if callable(value) else value

    def close(self):
        pass


def make_scope(vendor: str, responses=None) -> Oscilloscope:
    scope = Oscilloscope()
    scope.vendor = vendor
    scope.instr = FakeInstrument(responses or {})
    return scope


def windowed_send(instr: FakeInstrument, values: list[int]):
    """模拟真实 DLM: SEND? 只返回最近一次 START..END 窗口内的数据"""
    def _send():
        start = 0
        end = 0
        for write in instr.writes:
            if write.startswith(":WAVEFORM:START "):
                start = int(write.split(" ", 1)[1])
            elif write.startswith(":WAVEFORM:END "):
                end = int(write.split(" ", 1)[1])
        return ",".join(str(values[i]) for i in range(start, min(end, len(values) - 1) + 1))
    return _send


class VendorDetectionTest(unittest.TestCase):
    def test_yokogawa_dlm2024(self):
        scope = Oscilloscope()
        scope.idn = "YOKOGAWA,DLM2024,91J123456,1.10"
        scope._detect_vendor()
        self.assertEqual(scope.vendor, "yokogawa")

    def test_rigol(self):
        scope = Oscilloscope()
        scope.idn = "RIGOL TECHNOLOGIES,DS1054Z,DS1ZA000000000,00.04.04"
        scope._detect_vendor()
        self.assertEqual(scope.vendor, "rigol")


class ScpiFloatParsingTest(unittest.TestCase):
    def test_plain_and_header_responses(self):
        self.assertEqual(Oscilloscope._parse_scpi_float("1.23E+00"), 1.23)
        self.assertEqual(
            Oscilloscope._parse_scpi_float(":MEASURE:CHANNEL1:RMS:VALUE 1.23E+00"),
            1.23,
        )

    def test_unmeasurable_tokens(self):
        self.assertIsNone(Oscilloscope._parse_scpi_float("NAN"))
        self.assertIsNone(Oscilloscope._parse_scpi_float("******"))
        self.assertIsNone(Oscilloscope._parse_scpi_float("--"))
        self.assertIsNone(Oscilloscope._parse_scpi_float(""))


class YokogawaMeasurementsTest(unittest.TestCase):
    def test_rms_uses_channel_value_query(self):
        scope = make_scope("yokogawa", {":MEASure:CHANNEL1:RMS:VALue?": "0.123"})
        self.assertEqual(scope.read_rms(1), 0.123)
        self.assertEqual(scope.instr.queries, [":MEASure:CHANNEL1:RMS:VALue?"])

    def test_average_parses_header_prefixed_response(self):
        scope = make_scope(
            "yokogawa",
            {":MEASure:CHANNEL1:AVERage:VALue?": ":MEASURE:CHANNEL1:AVERAGE:VALUE 1.000E+00"},
        )
        self.assertEqual(scope.read_mean_voltage(1), 1.0)

    def test_duty_cycle_preserved_as_percent(self):
        scope = make_scope("yokogawa", {":MEASure:CHANNEL1:DUTYcycle:VALue?": "0.5"})
        self.assertEqual(scope.read_duty_cycle(1), 0.5)

    def test_prepare_enables_items_and_continuous_mode(self):
        scope = make_scope("yokogawa")
        scope._prepare_yokogawa_measurements([1, 2])
        writes = scope.instr.writes
        self.assertIn(":COMMUNICATE:HEADER OFF", writes)
        self.assertIn(":MEASure:CHANNEL1:RMS:STATe ON", writes)
        self.assertIn(":MEASure:CHANNEL2:DUTYcycle:STATe ON", writes)
        self.assertIn(":MEASure:MODE CONTinuous", writes)
        self.assertTrue(scope._yokogawa_meas_ready)

    def test_read_all_channels_handles_nan(self):
        responses = {}
        for key, param in YOKOGAWA_MEASURE_ITEMS.items():
            responses[f":MEASure:CHANNEL1:{param}:VALue?"] = "1.0"
        responses[":MEASure:CHANNEL1:PTOPeak:VALue?"] = "NAN"
        scope = make_scope("yokogawa", responses)
        data = scope.read_all_channels([1])
        ch = data[1]
        self.assertIsNotNone(ch["rms"])
        self.assertIsNone(ch["vpp"])
        self.assertTrue(scope._yokogawa_meas_ready)


class YokogawaWaveformTest(unittest.TestCase):
    def test_waveform_uses_official_sequence(self):
        responses = {
            ":WAVEFORM:SRATE?": "1E+09",
            ":WAVEFORM:LENGTH?": "10000",
            ":WAVEFORM:TRIGGER?": "5000",
            ":WAVEFORM:SEND?": ",".join(str(i) for i in range(1000)),
        }
        scope = make_scope("yokogawa", responses)
        wf = scope.read_waveform(1, points=1000)

        writes = scope.instr.writes
        self.assertIn(":WAVEFORM:TRACE 1", writes)
        self.assertIn(":WAVEFORM:RECORD 0", writes)
        self.assertIn(":WAVEFORM:FORMAT ASCII", writes)
        self.assertIn(":WAVEFORM:START 4500", writes)
        self.assertIn(":WAVEFORM:END 5499", writes)
        self.assertEqual(scope.instr.queries.count(":WAVEFORM:SEND?"), 1)
        self.assertEqual(len(wf["y"]), 1000)
        self.assertAlmostEqual(wf["x"][0], -5e-7)
        self.assertAlmostEqual(wf["t0"], -5e-6)

    def test_waveform_chunks_over_12500_points(self):
        instr = FakeInstrument({
            ":WAVEFORM:SRATE?": "1E+09",
            ":WAVEFORM:LENGTH?": "13000",
            ":WAVEFORM:TRIGGER?": "6500",
        })
        instr.responses[":WAVEFORM:SEND?"] = windowed_send(instr, list(range(13000)))
        scope = Oscilloscope()
        scope.vendor = "yokogawa"
        scope.instr = instr
        wf = scope.read_waveform(1, points=13000)
        self.assertEqual(scope.instr.queries.count(":WAVEFORM:SEND?"), 2)
        self.assertEqual(len(wf["y"]), 13000)


class YokogawaSettingsTest(unittest.TestCase):
    def test_get_all_settings(self):
        responses = {
            ":TIMEBASE:TDIV?": "0.001",
            ":TRIGGER:ATRIGGER:TYPE?": "SIMPLE",
            ":TRIGGER:ATRIGGER:SIMPLE:SOURCE?": "1",
            ":TRIGGER:ATRIGGER:SIMPLE:LEVEL?": "1.25",
            ":TRIGGER:ATRIGGER:SIMPLE:COUPLING?": "DC",
        }
        for ch in range(1, 5):
            responses[f":CHANNEL{ch}:VDIV?"] = "1"
            responses[f":CHANNEL{ch}:PROBE:MODE?"] = "10"
            responses[f":CHANNEL{ch}:COUPLING?"] = "DC"
            responses[f":CHANNEL{ch}:OFFSET?"] = "0"
        scope = make_scope("yokogawa", responses)

        settings = scope.get_all_settings()
        self.assertEqual(settings["timebase"], 0.001)
        self.assertEqual(
            settings["trigger"],
            {
                "type": "EDGE",
                "mode": "AUTO",
                "source": "CH1",
                "level": 1.25,
                "coupling": "DC",
                "slope": "RISE",
                "holdoff": 0.0,
            },
        )
        self.assertEqual(settings["channels"]["1"]["probe"], 10)
        self.assertEqual(settings["channels"]["1"]["impedance"], "1M")
        self.assertIn(":CHANNEL1:OFFSET?", scope.instr.queries)
        self.assertFalse(any("IMPedance" in q for q in scope.instr.queries))

    def test_apply_settings_maps_yokogawa_values(self):
        scope = make_scope("yokogawa")
        scope.apply_settings({
            "timebase": 0.002,
            "trigger": {"type": "PULSe", "source": "CH2", "level": 0.5, "coupling": "DC"},
            "channels": {
                "1": {"scale": 2, "probe": 10, "coupling": "AC", "impedance": "50", "offset": 0.25},
            },
        })
        writes = scope.instr.writes
        self.assertIn(":TIMEBASE:TDIV 0.002", writes)
        self.assertIn(":TRIGGER:ATRIGGER:TYPE PULSe", writes)
        self.assertIn(":TRIGGER:ATRIGGER:SIMPLE:SOURCE 2", writes)
        self.assertIn(":TRIGGER:ATRIGGER:SIMPLE:LEVEL 0.5", writes)
        self.assertIn(":CHANNEL1:VDIV 2.0", writes)
        self.assertIn(":CHANNEL1:PROBE:MODE 10", writes)
        self.assertIn(":CHANNEL1:OFFSET 0.25", writes)
        self.assertFalse(any("IMPedance" in w for w in writes))


class GenericVendorTest(unittest.TestCase):
    def test_rigol_rms_uses_generic_command(self):
        scope = make_scope("rigol", {"MEASure:VRMS? CHANnel1": "1.5"})
        self.assertEqual(scope.read_rms(1), 1.5)
        self.assertEqual(scope.instr.queries[0], "MEASure:VRMS? CHANnel1")

    def test_generic_duty_cycle_is_not_scaled(self):
        scope = make_scope("rigol", {"MEASure:DUTYcycle? CHANnel1": "0.5"})
        self.assertEqual(scope.read_duty_cycle(1), 0.5)

    def test_generic_trigger_type_uses_mode_command(self):
        scope = make_scope("rigol")
        scope.set_trigger_type("PULSe")
        self.assertIn("TRIGger:MODE PULSe", scope.instr.writes)

    def test_generic_trigger_type_label_normalized(self):
        scope = make_scope("rigol", {"TRIGger:MODE?": "PULSE"})
        self.assertEqual(scope.get_trigger_type(), "PULSe")


class YokogawaAcquisitionAndRunTest(unittest.TestCase):
    def test_get_acquisition_and_trigger_controls(self):
        responses = {
            ":ACQuire:MODE?": "AVERAGE",
            ":ACQuire:RESolution?": "0",
            ":ACQuire:AVERage:COUNt?": "32",
            ":ACQuire:RLENgth?": "125000",
            ":ACQuire:SAMPling?": "REPETITIVE",
            ":TRIGGER:MODE?": "NSINGLE",
            ":TRIGGER:ATRIGGER:SIMPLE:SLOPE?": "FALL",
            ":TRIGGER:HOLDOFF:TIME?": "0.0005",
        }
        scope = make_scope("yokogawa", responses)
        acq = scope.get_acquisition()
        self.assertEqual(acq["mode"], "AVER")
        self.assertEqual(acq["average_count"], 32)
        self.assertEqual(acq["record_length"], 125000)
        self.assertEqual(acq["sampling"], "REP")
        self.assertFalse(acq["high_res"])
        self.assertEqual(scope.get_trigger_mode(), "SING")
        self.assertEqual(scope.get_trigger_slope(), "FALL")
        self.assertEqual(scope.get_trigger_holdoff(), 0.0005)

    def test_get_acquisition_high_res(self):
        responses = {
            ":ACQuire:MODE?": "NORMAL",
            ":ACQuire:RESolution?": "1",
            ":ACQuire:AVERage:COUNt?": "16",
            ":ACQuire:RLENgth?": "12500",
            ":ACQuire:SAMPling?": "REAL",
        }
        scope = make_scope("yokogawa", responses)
        acq = scope.get_acquisition()
        self.assertEqual(acq["mode"], "HRES")
        self.assertTrue(acq["high_res"])

    def test_apply_acquisition(self):
        scope = make_scope("yokogawa")
        scope.apply_acquisition({
            "mode": "AVER",
            "average_count": 64,
            "record_length": 1250000,
            "sampling": "INT",
        })
        writes = scope.instr.writes
        self.assertIn(":ACQuire:RESolution OFF", writes)
        self.assertIn(":ACQuire:MODE AVERage", writes)
        self.assertIn(":ACQuire:AVERage:COUNt 64", writes)
        self.assertIn(":ACQuire:RLENgth 1250000", writes)
        self.assertIn(":ACQuire:SAMPling INTerporate", writes)

    def test_apply_high_resolution(self):
        scope = make_scope("yokogawa")
        scope.apply_acquisition({"mode": "HRES"})
        writes = scope.instr.writes
        self.assertIn(":ACQuire:RESolution ON", writes)
        self.assertIn(":ACQuire:MODE NORMal", writes)

    def test_trigger_mode_slope_holdoff_apply(self):
        scope = make_scope("yokogawa")
        scope.set_trigger_mode("SING")
        scope.set_trigger_slope("FALL")
        scope.set_trigger_holdoff(0.001)
        writes = scope.instr.writes
        self.assertIn(":TRIGGER:MODE NSINgle", writes)
        self.assertIn(":TRIGGER:ATRIGGER:SIMPLE:SLOPE FALL", writes)
        self.assertIn(":TRIGGER:HOLDOFF:TIME 0.001", writes)

    def test_run_stop(self):
        scope = make_scope("yokogawa")
        scope.run()
        scope.stop()
        self.assertEqual(scope.instr.writes, [":STARt", ":STOP"])


if __name__ == "__main__":
    unittest.main()
