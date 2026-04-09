from PyQt6.QtCore import pyqtSignal, QObject
from pymycobot import MyCobot320Socket


class Connection(QObject):
    result = pyqtSignal(int, bool)
    finished = pyqtSignal()
    robot_connection = pyqtSignal(int, object)

    def __init__(self, ip, index):
        super().__init__()
        self.ip = ip
        self.robot = index

    def run(self):
        try:
            mc = MyCobot320Socket(self.ip, 9000)
            mc.power_on()
            mc.clear_error_information()

            self.robot_connection.emit(self.robot, mc)
            self.result.emit(self.robot, True)
        except:
            self.result.emit(self.robot, False)
        finally:
            self.finished.emit()
