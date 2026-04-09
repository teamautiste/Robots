import sys
import json
import os

from PyQt6.QtWidgets import (QApplication, QMainWindow,
                             QItemDelegate, QLineEdit,
                             QDialog, QTableWidgetItem)
from PyQt6.QtCore import QTimer, QThread, Qt
from PyQt6.QtGui import QDoubleValidator
from PyQt6.uic import loadUi
from pymycobot import MyCobot320
from jog_control import Ui_MainWindow

from core.ups_monitor import UPSMonitor
from core.connection import Connection
from core.robot_runner import RobotRun

class NumericDelegate(QItemDelegate):
    def __init__(self, parent=None):
        super().__init__(parent)

    def createEditor(self, parent, option, index):
        editor = QLineEdit(parent)
        validator = QDoubleValidator(editor)
        validator.setDecimals(6)  # precision
        validator.setBottom(-9999999)
        validator.setTop(9999999)

        validator.setNotation(QDoubleValidator.Notation.StandardNotation)
        editor.setValidator(validator)
        return editor

class NewRecipeDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        loadUi("ui/NewRecipe_Dialog.ui", self)

class JogInterface(QMainWindow):
    def __init__(self):
        super().__init__()

        self.ui = Ui_MainWindow()
        self.dialog_ui = NewRecipeDialog(self)

        self.ui.setupUi(self)
        self.robots_ip = {}
        self.get_robots_ip()
        self.tableRecipe = ""
        self.speed = self.ui.speedSlider.value()
        self.run_speed = self.ui.runSpeed_spinBox.value()
        self.ui.SpeedLable.setText(f"{self.speed}")
        self.mc = MyCobot320
        self.currentRobot = ""
        self.threads = {}
        self.workers = {}
        self.robot_threads = []
        self.robot_connections = []
        self.robots = {}
        self.currentRobotPoints = []
        self.recipes = []
        self.currentRecipe = {}
        self.runRecipe = {}
        self.ui.LockServos_Button.hide()
        self.path = os.getcwd()
        self.recipePath = os.path.join(self.path, "recipes")
        self.sequence_index = 0
        self.UPS_LIST = {
            "UPS1": "ACPI\\PNP0C0A\\1",
            "UPS2": "ACPI\\PNP0C0A\\2"
        }

        self.load_recipe_list()
        self.update_robot_list()
        self.currentJoint = None
        self.currentAxis = None
        self.jog_timer = QTimer()
        self.jog_timer.timeout.connect(self._continuous_jog_tick)

        self.ups_monitor = UPSMonitor()

        self.ups_monitor.powerLost.connect(self.on_power_lost)
        self.ups_monitor.powerRestored.connect(self.on_power_restored)
        self.ups_monitor.monitoringDisabled.connect(
            lambda msg: print(f"UPS monitoring disabled: {msg}")
        )
        self.ups_monitor.start()

    #Interface Functions Connect
        self.ui.AddRecipe_Button.clicked.connect(self.dialog_ui.exec)
        self.dialog_ui.accepted.connect(self.add_recipe)
        self.ui.DeleteRecipe_Button.clicked.connect(self.delete_recipe)
        self.ui.Recipe_List.currentRowChanged.connect(self.change_points_table)
        self.ui.AddPoint_Button.clicked.connect(self.add_point_row)
        self.ui.DeletePoint_Button.clicked.connect(self.delete_selected_rows)
        self.ui.SavePoints_Button.clicked.connect(self.save_from_table)
        self.ui.MoveUp_Button.clicked.connect(self.move_up)
        self.ui.MoveDown_Button.clicked.connect(self.move_down)

        self.ui.SaveConfig_Button.clicked.connect(self.save_robot_config)
        self.ui.speedSlider.valueChanged.connect(self.update_speed)
        self.ui.runSpeed_spinBox.valueChanged.connect(self.update_run_speed)
        self.ui.comboBox_JogMode.currentIndexChanged.connect(self.change_jog_mode)
        self.ui.comboBox_RobotSelect.currentTextChanged.connect(self.change_robot)
        self.ui.TeachPoint.clicked.connect(self.teach_point)
        self.ui.GoToPoint_Button.clicked.connect(self.move_to_point)
        self.ui.ReleaseServos_Button.clicked.connect(self.release_servos)
        self.ui.LockServos_Button.clicked.connect(self.focus_servos)

        self.numeric_delegate = NumericDelegate(self)
        #self.ui.LoadRecipes_Button.clicked.connect(self.load_recipe_list)
        self.ui.Recipe_comboBox.currentIndexChanged.connect(self.change_run_recipe)
        self.ui.RecipeTeach_comboBox.currentIndexChanged.connect(self.change_recipe)

        self.ui.run_Button.clicked.connect(self.start_sequence)
        self.ui.stop_Button.clicked.connect(self.stop_sequence)
        self.ui.stop_Button.setEnabled(False)

        self.ui.TestConnection_1_Button.clicked.connect(lambda: self.connect_to_robot(1))
        self.ui.TestConnection_2_Button.clicked.connect(lambda: self.connect_to_robot(2))
        self.ui.TestConnection_3_Button.clicked.connect(lambda: self.connect_to_robot(3))
        self.ui.TestConnection_4_Button.clicked.connect(lambda: self.connect_to_robot(4))
        self.ui.TestConnection_5_Button.clicked.connect(lambda: self.connect_to_robot(5))
        self.ui.TestConnection_6_Button.clicked.connect(lambda: self.connect_to_robot(6))
        self.ui.TestConnection_7_Button.clicked.connect(lambda: self.connect_to_robot(7))
        self.ui.TestConnection_8_Button.clicked.connect(lambda: self.connect_to_robot(8))

        # Angle Jogging Buttons
        self.ui.J1_jog_minus_Button.pressed.connect(lambda: self.angle_jog_minus(1))
        self.ui.J2_jog_minus_Button.pressed.connect(lambda: self.angle_jog_minus(2))
        self.ui.J3_jog_minus_Button.pressed.connect(lambda: self.angle_jog_minus(3))
        self.ui.J4_jog_minus_Button.pressed.connect(lambda: self.angle_jog_minus(4))
        self.ui.J5_jog_minus_Button.pressed.connect(lambda: self.angle_jog_minus(5))
        self.ui.J6_jog_minus_Button.pressed.connect(lambda: self.angle_jog_minus(6))

        self.ui.J1_jog_plus_Button.pressed.connect(lambda: self.angle_jog_plus(1))
        self.ui.J2_jog_plus_Button.pressed.connect(lambda: self.angle_jog_plus(2))
        self.ui.J3_jog_plus_Button.pressed.connect(lambda: self.angle_jog_plus(3))
        self.ui.J4_jog_plus_Button.pressed.connect(lambda: self.angle_jog_plus(4))
        self.ui.J5_jog_plus_Button.pressed.connect(lambda: self.angle_jog_plus(5))
        self.ui.J6_jog_plus_Button.pressed.connect(lambda: self.angle_jog_plus(6))

        for i in range(1,7):
            plusbutton = getattr(self.ui,f"J{i}_jog_plus_Button")
            minusbutton = getattr(self.ui,f"J{i}_jog_minus_Button")

            plusbutton.released.connect(self.stop_jog)
            minusbutton.released.connect(self.stop_jog)

        self.numeric_delegate = NumericDelegate(self)
        for i in range(1, 9):
            table = getattr(self.ui, f"Robot{i}_PointsTable")
            for col in range(1, 7):
                table.setItemDelegateForColumn(col, self.numeric_delegate)

        # Coord Jogging Buttons
        self.ui.X_jog_minus_Button.pressed.connect(lambda: self.coords_jog_minus(1))
        self.ui.Y_jog_minus_Button.pressed.connect(lambda: self.coords_jog_minus(2))
        self.ui.Z_jog_minus_Button.pressed.connect(lambda: self.coords_jog_minus(3))
        self.ui.Rx_jog_minus_Button.pressed.connect(lambda: self.coords_jog_minus(4))
        self.ui.Ry_jog_minus_Button.pressed.connect(lambda: self.coords_jog_minus(5))
        self.ui.Rz_jog_minus_Button.pressed.connect(lambda: self.coords_jog_minus(6))

        self.ui.X_jog_plus_Button.pressed.connect(lambda: self.coords_jog_plus(1))
        self.ui.Y_jog_plus_Button.pressed.connect(lambda: self.coords_jog_plus(2))
        self.ui.Z_jog_plus_Button.pressed.connect(lambda: self.coords_jog_plus(3))
        self.ui.Rx_jog_plus_Button.pressed.connect(lambda: self.coords_jog_plus(4))
        self.ui.Ry_jog_plus_Button.pressed.connect(lambda: self.coords_jog_plus(5))
        self.ui.Rz_jog_plus_Button.pressed.connect(lambda: self.coords_jog_plus(6))

        self.ui.jointJog.setEnabled(False)
        self.ui.coordJog.setEnabled(False)
        self.ui.AngleTable_Frame.setEnabled(False)
        self.ui.CoordsTable_Frame.setEnabled(False)
        self.ui.Speed_Frame.setEnabled(False)
        self.ui.Teach_Frame.setEnabled(False)
        self.ui.TeachPoint.setEnabled(False)
        self.ui.GoToPoint_Button.setEnabled(False)
        self.ui.PointsComboBox.setEnabled(False)

        self.timer = QTimer()
        self.timer.timeout.connect(self.update_coords)
        self.timer.start(200)  # every 200ms

    # Interface Functions #
    def connect_to_robot(self, index):
        button = getattr(self.ui, f"TestConnection_{index}_Button")
        label = getattr(self.ui,f"TestConnection_{index}_Status")
        textbox = getattr(self.ui,f"Robot_{index}_ip")

        rawip = textbox.text()
        ip = rawip.replace("_","")
        ip2 = ip.replace(" ","")

        button.setEnabled(False)
        label.setText("Connecting...")

        thread = QThread()
        conection = Connection(ip2,index)
        self.threads[index] = thread
        self.workers[index] = conection

        conection.moveToThread(thread)
        thread.started.connect(conection.run)
        conection.finished.connect(thread.quit)
        conection.finished.connect(conection.deleteLater)
        thread.finished.connect(thread.deleteLater)

        conection.robot_connection.connect(self.store_robot)
        conection.result.connect(self.robot_connection_result)

        thread.start()
        thread.finished.connect(lambda: button.setEnabled(True))

    def robot_connection_result(self, index, success):
        label = getattr(self.ui,f"TestConnection_{index}_Status")
        if success:
            label.setText("Connected!")
            self.update_robot_list()
        else:
            label.setText("Connection Failed")

    def store_robot(self, index, mc):
        self.robots[f"Robot {index}"] = {"ID": index, "Connection": mc}

    def get_robots_ip(self):
        if os.path.exists("robots_IPS.json"):
            with open("robots_IPS.json", "r") as f:
                self.robots_ip = json.load(f)

        else:
            self.robots_ip = {"Robot_1": "192.168.1.1",
                              "Robot_2": "192.168.1.2",
                              "Robot_3": "192.168.1.3",
                              "Robot_4": "192.168.1.4",
                              "Robot_5": "192.168.1.5",
                              "Robot_6": "192.168.1.6",
                              "Robot_7": "192.168.1.7",
                              "Robot_8": "192.168.1.8"}

        for i in range(1,9):
            textbox = getattr(self.ui, f"Robot_{i}_ip")
            textbox.setText(self.robots_ip[f"Robot_{i}"])

    def save_robot_config(self):
        for i in range(1,9):
            textbox = getattr(self.ui, f"Robot_{i}_ip")
            self.robots_ip[f"Robot_{i}"] = textbox.text()

        with open("robots_IPS.json","w") as f:
            json.dump(self.robots_ip,f, indent= 4)

    def change_robot(self,text):
        try:
            self.currentRobot = ""
            if text == "None":
                self.update_points_list()
                self.mc = MyCobot320

                self.ui.jointJog.setEnabled(False)
                self.ui.coordJog.setEnabled(False)
                self.ui.AngleTable_Frame.setEnabled(False)
                self.ui.CoordsTable_Frame.setEnabled(False)
                self.ui.Speed_Frame.setEnabled(False)
                self.ui.Teach_Frame.setEnabled(False)

            else:
                self.mc = self.robots[text]["Connection"]
                self.currentRobot = text
                self.update_points_list()
                self.focus_servos()

                self.ui.jointJog.setEnabled(True)
                self.ui.coordJog.setEnabled(True)
                self.ui.AngleTable_Frame.setEnabled(True)
                self.ui.CoordsTable_Frame.setEnabled(True)
                self.ui.Speed_Frame.setEnabled(True)
                self.ui.Teach_Frame.setEnabled(True)

        except Exception as e:
            self.ui.statusLabel.setText(f"Robot connection Error: {e}")

    def update_speed(self, value):
        self.speed = value
        self.ui.SpeedLable.setText(f"{value}")

    def update_run_speed(self, value):
        self.run_speed = value

    def change_jog_mode(self, index):
        if index == 0:
            self.ui.coordJog.hide()
            self.ui.jointJog.show()
            self.ui.CoordsTable_Frame.hide()
            self.ui.AngleTable_Frame.show()
        if index == 1:
            self.ui.coordJog.show()
            self.ui.jointJog.hide()
            self.ui.CoordsTable_Frame.show()
            self.ui.AngleTable_Frame.hide()

    def update_coords(self):
        try:
            angles = self.mc.get_angles()
            coords = self.mc.get_coords()
        except:
            return
            #self.ui.statusLabel.setText("Unable to update coords")
        if not isinstance(angles, (list, tuple)) or len(angles) != 6:
            print("Invalid angles:", angles)
            return

        if not isinstance(coords, (list, tuple)) or len(coords) != 6:
            print("Invalid coords:", coords)
            return

        for i in range(6):
            #newitem = QtWidgets.QTableWidgetItem(str(angles[i]))
            #self.ui.anglesTable.setItem(0, i, newitem)
            self.ui.anglesTable.item(0, i).setText(str(angles[i]))

        for i in range(6):
            #newitem = QtWidgets.QTableWidgetItem(str(coords[i]))
            #self.ui.coordsTable.setItem(0, i, newitem)
            self.ui.coordsTable.item(0, i).setText(str(coords[i]))

    def update_points_list(self):
        self.ui.PointsComboBox.clear()
        self.ui.PointsComboBox.addItem("New Point")
        try:
            if self.currentRecipe != {} and self.currentRobot != "":
                self.currentRobotPoints = self.currentRecipe[self.currentRobot]
                for item in self.currentRobotPoints:
                    self.ui.PointsComboBox.addItem(item["name"])
        except Exception as e:
            print(e)

    def update_robot_list(self):
        self.ui.comboBox_RobotSelect.clear()
        self.ui.comboBox_RobotSelect.addItem("None")
        print(self.robots.keys())
        robotlist = list(self.robots.keys())
        for item in robotlist:
            self.ui.comboBox_RobotSelect.addItem(item)

    def teach_point(self):
        currpos = self.mc.get_angles()
        if currpos is not -1:
            try:
                if self.ui.PointsComboBox.currentIndex() == 0:
                    index = len(self.currentRobotPoints) + 1
                    pointname = f"Point {index}"
                    self.currentRobotPoints.append({"name" : pointname, "coords" : currpos})

                else:
                    indexname = self.ui.PointsComboBox.currentText()
                    for p in self.currentRobotPoints:
                        if p["name"] == indexname:
                            p["coords"] = currpos
                            print(p)
                            break

                self.currentRecipe[self.currentRobot] = self.currentRobotPoints
                with open(f"{self.recipePath}\\{self.recipes[(self.ui.Recipe_comboBox.currentIndex() - 1)]}.json", "w") as file:
                    json.dump(self.currentRecipe,file, indent=4)

                if self.ui.PointsComboBox.currentIndex() == 0:
                    self.ui.PointSavedLabel.setText(f"New point saved as: {pointname}")
                else:
                    self.ui.PointSavedLabel.setText(f"{indexname} Overwritten")

            except Exception as e:
                self.ui.statusLabel.setText(f"Could not Save recipe: {e}")
        else:
            self.ui.statusLabel.setText("Could not Tech Point: Error in get robot postion")
            return

        self.update_points_list()
        self.change_points_table()

    def change_recipe(self):
        if self.ui.RecipeTeach_comboBox.currentIndex() > 0:
            try:
                recipepath = f"{self.recipePath}\\{self.recipes[(self.ui.RecipeTeach_comboBox.currentIndex() - 1)]}.json"
                if os.path.exists(recipepath):
                    with open(recipepath,"r") as f:
                        self.currentRecipe = json.load(f)
                self.ui.TeachPoint.setEnabled(True)
                self.ui.GoToPoint_Button.setEnabled(True)
                self.ui.PointsComboBox.setEnabled(True)
            except Exception as e:
                self.ui.TeachPoint.setEnabled(False)
                self.ui.GoToPoint_Button.setEnabled(False)
                self.ui.PointsComboBox.setEnabled(False)
                self.ui.statusLabel.setText(f"Could not Save recipe: {e}")
        else:
            self.currentRecipe = {}
            self.ui.TeachPoint.setEnabled(False)
            self.ui.GoToPoint_Button.setEnabled(False)
            self.ui.PointsComboBox.setEnabled(False)
        self.update_points_list()

    def change_run_recipe(self):
        if self.ui.Recipe_comboBox.currentIndex() > 0:
            recipepath = f"{self.recipePath}\\{self.recipes[(self.ui.Recipe_comboBox.currentIndex() - 1)]}.json"
            if os.path.exists(recipepath):
                with open(recipepath,"r") as f:
                    self.runRecipe = json.load(f)
        else:
            self.runRecipe = {}

    def change_points_table(self):
        selection = self.ui.Recipe_List.currentRow()
        for i in range(1,9):
            table = getattr(self.ui,f"Robot{i}_PointsTable")
            table.setRowCount(0)
            table.setSortingEnabled(False)

        if selection != -1:
            self.tableRecipe = f"{self.recipes[selection]}.json"
            with open(f"{self.recipePath}\\{self.tableRecipe}","r") as f:
                points = json.load(f)

            for i in range(1,9):
                robotpoints = points[f"Robot {i}"]
                table = getattr(self.ui,f"Robot{i}_PointsTable")
                row = 0
                for point in robotpoints:
                    name = point["name"]
                    table.insertRow(row)
                    table.setItem(row,0,QTableWidgetItem(name))
                    for column in range(6):
                        angles = point["coords"]
                        tableitem = QTableWidgetItem(str(angles[column]))
                        tableitem.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                        table.setItem(row, column + 1, tableitem)
                    row += 1

    def add_point_row(self):
        tableindex= self.ui.RobotPoints_Table.currentIndex() + 1
        table = getattr(self.ui, f"Robot{tableindex}_PointsTable")
        row = table.rowCount()
        table.insertRow(row)
        table.setItem(row, 0, QTableWidgetItem(f"Point {row + 1}"))

        for i in range(6):
            item = QTableWidgetItem("0.0")
            table.setItem(row, i + 1, item)

    def delete_selected_rows(self):
        tableindex = self.ui.RobotPoints_Table.currentIndex() + 1
        table = getattr(self.ui, f"Robot{tableindex}_PointsTable")

        selected = table.selectionModel().selectedRows()

        for index in sorted(selected, key=lambda x: x.row(), reverse=True):
            table.removeRow(index.row())

    def save_from_table(self):
        i = self.ui.RobotPoints_Table.currentIndex() + 1
        table = getattr(self.ui, f"Robot{i}_PointsTable")
        table.setSortingEnabled(False)
        rows = table.rowCount()

        with open(f"{self.recipePath}\\{self.tableRecipe}", "r") as f:
            recipe = json.load(f)

        points = []
        for row in range(rows):
            name = table.item(row, 0).text()
            joints = []
            for col in range(1, 7):
                item = table.item(row, col)
                try:
                    joints.append(float(item.text()))
                except:
                    joints.append(0)
            points.append({"name": name,"coords": joints})

        recipe[f"Robot {i}"] = points

        with open(f"{self.recipePath}\\{self.tableRecipe}", "w") as f:
            json.dump(recipe, f, indent=4)

        self.change_points_table()
        self.update_points_list()

    def add_recipe(self):
        filename = f"{self.dialog_ui.NewRecipe_LineEdit.text()}.json"
        points = {
        "Robot 1":[
            {
                "name" : "Home", "coords" : [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 2":[
            {
                "name" : "Home", "coords" : [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 3":[
            {
                "name" : "Home", "coords" : [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 4": [
            {
                "name" : "Home", "coords": [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 5": [
            {
                "name" : "Home", "coords": [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 6": [
            {
                "name" : "Home", "coords": [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 7": [
            {
                "name" : "Home", "coords": [0.0,0.0,0.0,0.0,0.0,0.0]
            }],
        "Robot 8": [
            {
                "name" : "Home", "coords": [0.0,0.0,0.0,0.0,0.0,0.0]
            }]
        }

        with open(f"{self.recipePath}\\{filename}","w") as f:
            json.dump(points, f, indent=4)

        self.load_recipe_list()

    def delete_recipe(self):
        listindex = self.ui.Recipe_List.currentRow()
        filepath = f"{self.recipePath}\\{self.recipes[listindex]}.json"
        os.remove(filepath)
        self.load_recipe_list()

    def load_recipe_list(self):
        self.ui.Recipe_List.clear()
        self.ui.Recipe_comboBox.clear()
        self.ui.Recipe_comboBox.addItem("None")
        self.ui.RecipeTeach_comboBox.clear()
        self.ui.RecipeTeach_comboBox.addItem("None")
        self.recipes = []

        if not os.path.exists(self.recipePath):
            os.makedirs(self.recipePath)
            return
        else:
             for item in os.listdir(self.recipePath):
                 if item.endswith(".json"):
                    x = item.replace(".json","")
                    self.recipes.append(x)
        self.ui.Recipe_List.addItems(self.recipes)
        for i in self.recipes:
            self.ui.Recipe_comboBox.addItem(i)
            self.ui.RecipeTeach_comboBox.addItem(i)

    def move_up(self):
        i = self.ui.RobotPoints_Table.currentIndex() + 1
        table = getattr(self.ui, f"Robot{i}_PointsTable")
        table.setSortingEnabled(False)
        row = table.currentRow()

        if row <= 0:
            return

        for col in range(table.columnCount()):
            item1 = table.takeItem(row,col)
            item2 = table.takeItem(row - 1, col)

            table.setItem(row, col, item2)
            table.setItem(row - 1, col, item1)

        table.setCurrentCell(row - 1,0)

    def move_down(self):
        i = self.ui.RobotPoints_Table.currentIndex() + 1
        table = getattr(self.ui, f"Robot{i}_PointsTable")
        table.setSortingEnabled(False)
        row = table.currentRow()

        if row < 0 or row >= table.rowCount() - 1:
            return

        for col in range(table.columnCount()):
            item1 = table.takeItem(row, col)
            item2 = table.takeItem(row + 1, col)

            table.setItem(row, col, item2)
            table.setItem(row + 1, col, item1)

        table.setCurrentCell(row + 1, 0)

    #  Robot Control Functions   #
    def angle_jog_plus(self, joint):
        try:
            jog_angle = self.mc.get_angles()[joint - 1]

        except:
            self.ui.statusLabel.setText("Robot Connection Error")
            return

        if jog_angle >= 163:
            self.ui.statusLabel.setText(f"Psitive limit reached for Joint {joint}")
        else:
            if self.ui.radioButtonContinuous.isChecked():
                self.direction = +1
                self.currentJoint = joint
                self.jog_timer.start(50)  # 50 ms update

            elif self.ui.radioButtonStep.isChecked():
                jog_angle += float(self.ui.spinBoxStep.value())
                self.mc.send_angle(joint, jog_angle, self.speed)
        #error = self.mc.get_error_information()
        #self.ui.statusLabel.setText(f"Robot ERROR: {error}")

    def angle_jog_minus(self, joint):
        try:
            jog_angle = self.mc.get_angles()[joint - 1]
        except:
            self.ui.statusLabel.setText("Robot Connection Error")
            return

        if jog_angle >= 163:
            self.ui.statusLabel.setText(f"Psitive limit reached for Joint {joint}")
        else:
            if self.ui.radioButtonContinuous.isChecked():
                self.direction = -1
                self.currentJoint = joint
                self.jog_timer.start(50)  # 50 ms update

            elif self.ui.radioButtonStep.isChecked():
                jog_angle -= float(self.ui.spinBoxStep.value())
                self.mc.send_angle(joint, jog_angle, self.speed)

        #error = self.mc.get_error_information()
        #self.ui.statusLabel.setText(f"Robot ERROR: {error}")

    def coords_jog_plus(self, axis):
        try:
            jog_step = self.mc.get_coords()[axis - 1]
        except:
            self.ui.statusLabel.setText("Robot Connection Error")
            return

        if self.ui.radioButtonContinuous.isChecked():
            self.direction = +1
            self.currentAxis = axis
            self.jog_timer.start(50)  # 50 ms update

        elif self.ui.radioButtonStep.isChecked():
            jog_step += float(self.ui.spinBoxStep.value())
            self.mc.send_coord(axis, jog_step, self.speed)

    def coords_jog_minus(self, axis):
        try:
            jog_step = self.mc.get_coords()[axis - 1]
        except:
            self.ui.statusLabel.setText("Robot Connection Error")
            return

        if self.ui.radioButtonContinuous.isChecked():
            self.direction = -1
            self.currentAxis = axis
            self.jog_timer.start(50)  # 50 ms update

        elif self.ui.radioButtonStep.isChecked():
            jog_step -= float(self.ui.spinBoxStep.value())
            self.mc.send_coord(axis, jog_step, self.speed)

    def _continuous_jog_tick(self):
        if self.currentJoint is not None:
            angle = self.mc.get_angles()[self.currentJoint - 1]
            angle += self.direction * 5.0
            self.mc.send_angle(self.currentJoint, angle, self.speed)
        elif self.currentAxis is not None:
            coord = self.mc.get_coords()[self.currentAxis - 1]
            coord += self.direction * 2.0
            self.mc.send_coord(self.currentAxis, coord, self.speed)

    def stop_jog(self):
        if self.ui.radioButtonContinuous.isChecked():
            self.mc.stop()
            self.jog_timer.stop()

    def move_to_point(self):
        index = self.ui.PointsComboBox.currentIndex()
        pointslist = list(self.currentRobotPoints.values())

        try:
            self.mc.clear_error_information()
            self.mc.focus_all_servos()

            if index != 0:
                target = pointslist[index - 1]
                self.mc.send_angles(target, self.speed)
        except Exception as e:
            self.ui.statusLabel.setText(f"Robot connection Error: {e}")

    def release_servos(self):
        try:
            self.mc.release_all_servos()
            self.ui.statusLabel.setText("Robot Servos Released")
        except:
            return

        self.ui.ReleaseServos_Button.hide()
        self.ui.LockServos_Button.show()
        self.ui.GoToPoint_Button.setEnabled(False)
        self.ui.jointJog.setEnabled(False)
        self.ui.coordJog.setEnabled(False)

    def focus_servos(self):
        try:
            self.mc.focus_all_servos()
            self.ui.statusLabel.setText("Robot Servos Enabled")
        except:
            return

        self.ui.ReleaseServos_Button.show()
        self.ui.LockServos_Button.hide()
        self.ui.GoToPoint_Button.setEnabled(True)
        self.ui.jointJog.setEnabled(True)
        self.ui.coordJog.setEnabled(True)

    def setup_robot_threads(self):
        self.robot_threads = []
        self.robot_connections = []

        for robot, points in self.runRecipe.items():
            thread = QThread()

            if robot not in self.robots:
                continue

            robot_connection = RobotRun(self.robots[robot], points, self.run_speed)
            robot_connection.moveToThread(thread)
            robot_connection.finished.connect(thread.quit)
            robot_connection.finished.connect(robot_connection.deleteLater)
            thread.finished.connect(thread.deleteLater)

            thread.start()
            self.robot_threads.append(thread)
            self.robot_connections.append(robot_connection)

        for robot in self.robot_connections:
            robot.FinishForward.connect(self._on_robot_done)
            robot.FinishReverse.connect(self._on_robot_stopped)
            robot.UpdateStatus.connect(self.update_status_table)
            robot.ErrorInformation.connect(self._display_error_message)

    #  Auto run functions  #
    def start_sequence(self):
        self.sequence_index = 0
        self.ui.run_Button.setEnabled(False)
        self.ui.stop_Button.setEnabled(True)
        self.setup_robot_threads()
        if len(self.robot_connections) < 1:
            print("No Robots Connected")
            return
        self._start_next_robot()

    def _start_next_robot(self):
        if self.sequence_index >= len(self.robot_connections):
            return

        robot = self.robot_connections[self.sequence_index]
        QMetaObject.invokeMethod(robot, "run_forward", Qt.ConnectionType.QueuedConnection)

    def _on_robot_done(self):
        self.sequence_index += 1
        self._start_next_robot()

    def stop_sequence(self):
        if len(self.robot_connections) < 1:
            return
        self.sequence_index = len(self.robot_connections) - 1
        self._stop_next_robot()

    def _stop_next_robot(self):
        if self.sequence_index < 0:
            print("Stop sequence finished")
            self._disconnect_signals()
            self.ui.run_Button.setEnabled(True)
            self.ui.stop_Button.setEnabled(False)
            return

        robot = self.robot_connections[self.sequence_index]
        QMetaObject.invokeMethod(robot, "run_reverse", Qt.ConnectionType.QueuedConnection)

    def _on_robot_stopped(self):
        self.sequence_index -= 1
        self._stop_next_robot()

    def _disconnect_signals(self):
        for robot in self.robot_connections:
            try:
                robot.FinishForward.disconnect(self._on_robot_done)
            except TypeError:
                pass

            try:
                robot.FinishReverse.disconnect(self._on_robot_stopped)
            except TypeError:
                pass

    def on_power_restored(self):
        print(f"power restored")

    def on_power_lost(self):
        print("Power Lost")
        self.stop_sequence()

    def update_status_table(self, robot_id, status):
        if status != "Error":
            self.ui.RobotStatus_Table.setItem(robot_id - 1, 1, QTableWidgetItem(""))

        self.ui.RobotStatus_Table.setItem(robot_id - 1, 0, QTableWidgetItem(status))

    def _display_error_message(self,robot_id, error_message):
        self.ui.RobotStatus_Table.setItem(robot_id - 1, 1, QTableWidgetItem(error_message))

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("WindowsVista")
    window = JogInterface()
    window.show()
    sys.exit(app.exec())