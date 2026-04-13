import time

from PyQt6.QtCore import pyqtSignal, QObject, pyqtSlot

class RobotRun(QObject):
    finished = pyqtSignal(int)
    Current_Position = pyqtSignal(int, list)
    ErrorInformation = pyqtSignal(int, str)
    UpdateStatus = pyqtSignal(int, str)
    FinishForward = pyqtSignal(bool)
    FinishReverse = pyqtSignal(bool)

    def __init__(self,robot,points,speed):
        super().__init__()
        self.mc = robot["Connection"]
        self.id = robot["ID"]
        self.speed = speed
        self.points = points
        self.running = False
        self.stopping = False

    @pyqtSlot()
    def run_forward(self):
        self.running = True
        self.stopping = False
        self.mc.focus_all_servos()

        for point in self.points:
            if self.stopping:
                break

            self.mc.send_angles(point["coords"], self.speed)

            if self.mc.get_error_information != 0:
                error_message = self.get_error()
                self.UpdateStatus.emit(self.id, "Error")
                self.ErrorInformation.emit(self.id, error_message)
                break

            self.UpdateStatus.emit(self.id, "Moving")
            while self.mc.is_moving == 1:
                if self.mc.get_error_information != 0:
                    error_message = self.get_error()
                    self.UpdateStatus.emit(self.id, "Error")
                    self.ErrorInformation.emit(self.id, error_message)
                    break
                time.sleep(0.05)
        self.UpdateStatus(self.id, "In postion")
        self.FinishForward.emit(True)

    @pyqtSlot()
    def run_reverse(self):
        self.stopping = True
        self.running = False

        for point in reversed(self.points):
            self.mc.send_angles(point["coords"], self.speed)

            if self.mc.get_error_information != 0:
                error_message = self.get_error()
                self.UpdateStatus.emit(self.id, "Error")
                self.ErrorInformation.emit(self.id, error_message)
                break

            self.UpdateStatus.emit(self.id, "Moving")
            while self.mc.is_moving == 1:
                if self.mc.get_error_information != 0:
                    error_message = self.get_error()
                    self.UpdateStatus.emit(self.id, "Error")
                    self.ErrorInformation.emit(self.id, error_message)
                    break
                time.sleep(0.05)
        self.FinishReverse.emit(True)
        self.stop()

    def get_error(self):
        error = self.mc.get_error_information()
        message = ""

        if error == 0:
            message = "None"
        elif  1 <= error < 16 :
            message = f"Joint {error} at the limit"
        elif 16 <= error < 20 :
            message = "Collision"
        elif error >= 32:
            message = "Can not reach postion"
        else:
            message = "Unknown error"

        return message

    def stop(self):
        self.running = False
        self.stopping = False
        self.mc.stop()
        #self.mc.release_all_servos()
        self.finished.emit(self.id)
