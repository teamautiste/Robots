import ctypes
import time

from PyQt6.QtCore import pyqtSignal, QThread


class SystemPowerStatus(ctypes.Structure):
    _fields_ = [
        ("ACLineStatus", ctypes.c_byte),
        ("BatteryFlag", ctypes.c_byte),
        ("BatteryLifePercent", ctypes.c_byte),
        ("Reserved1", ctypes.c_byte),
        ("BatteryLifeTime", ctypes.c_ulong),
        ("BatteryFullLifeTime", ctypes.c_ulong),
    ]

class UPSMonitor(QThread):
    powerLost = pyqtSignal()
    powerRestored = pyqtSignal()
    monitoringDisabled = pyqtSignal(str)

    def __init__(self, poll_interval=1):
        super().__init__()
        self.poll_interval = poll_interval
        self._running = True
        self._last_state = None

    def stop(self):
        self._running = False

    def run(self):
        status = SystemPowerStatus()

        try:
            result = ctypes.windll.kernel32.GetSystemPowerStatus(
                ctypes.byref(status)
            )
        except Exception as e:
            self.monitoringDisabled.emit("Power status API not available")
            return

        if status.BatteryFlag == 128:
            self.monitoringDisabled.emit("No battery detected")
            return

        while self._running:
            ctypes.windll.kernel32.GetSystemPowerStatus(
                ctypes.byref(status)
            )

            if status.ACLineStatus == 0:
                current_state = "battery"
            elif status.ACLineStatus == 1:
                current_state = "ac"
            else:
                current_state = "unknown"

            if current_state != self._last_state:

                if current_state == "battery":
                    time.sleep(1)
                    if current_state == "battery":
                        self.powerLost.emit()

                elif current_state == "ac":
                    self.powerRestored.emit()

                self._last_state = current_state

            time.sleep(self.poll_interval)
