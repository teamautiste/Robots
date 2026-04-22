import json
import os
import threading
import time
import ctypes
import datetime

try:
    from pymycobot import MyCobot320Socket
except ImportError:
    MyCobot320Socket = None

class AppState:
    def __init__(self):
        self._lock = threading.Lock()
        self.robots = {}
        self.robots_ip = {}
        self.sequence_running = False
        self.sequence_recipe = None
        self.ups_status = "unknown"
        self.log = []

    def update_robot(self, index, **kwargs):
        with self._lock:
            if index not in self.robots:
                self.robots[index] = {}
            self.robots[index].update(kwargs)

    def get_robot(self, index):
        with self._lock:
            return self.robots.get(index, {})

    def get_all_robots(self):
        with self._lock:
            return dict(self.robots)

class JogEngine:
    def __init__(self, recipe_path="recipes"):
        self.state = AppState()
        self.socketio = None
        self.recipe_path = recipe_path
        self._load_ip_config()
        self._start_ups_monitor()

    def set_socketio(self, sio):
        self.socketio = sio

    def _emit(self, event, data):
        if self.socketio:
            try:
                self.socketio.emit(event, data)
            except Exception:
                pass

    def _log(self, level, message):
        entry = {
            "level": level,
            "message": message,
            "ts": datetime.datetime.now().strftime("%H:%M:%S"),
        }
        self.state.log.append(entry)
        if len(self.state.log) > 200:
            self.state.log = self.state.log[-200:]
        self._emit("log", entry)

    def _load_ip_config(self):
        if os.path.exists("robots_IPS.json"):
            with open("robots_IPS.json", "r") as f:
                self.state.robots43_ip = json.load(f)
        else:
            self.state.robots_ip = {
                f"Robot_{i}": f"192.168.1.{i}" for i in range(1, 9)
            }

    def get_ip_config(self):
        return self.state.robots_ip

    def save_ip_config(self, data):
        self.state.robots_ip = data
        with open("robots_IPS.json", "w") as f:
            json.dump(data, f, indent=4)
        self._log("ok", "[OK] IP config saved")
        return {"success": True}

    def connect_robot(self, index):
        ip_key = f"Robot_{index}"
        ip = self.state.robots_ip.get(ip_key, f"192.168.1.{index}")
        self.state.update_robot(index, ID=index, Connection=None, status="connecting", error="", ip=ip)
        self._emit("robot_status", {"robot_id": index, "status": "connecting", "error": "", "ip": ip})

        def _connect():
            if MyCobot320Socket is None:
                self.state.update_robot(index, status="error", error="pymycobot not installed", Connection=None)
                self._emit("robot_status", {"robot_id": index, "status": "error", "error": "pymycobot not installed", "ip": ip})
                return
            try:
                mc = MyCobot320Socket(ip, 9000)
                mc.power_on()
                mc.clear_error_information()
                self.state.update_robot(index, Connection=mc, status="connected", error="")
                self._log("ok", f"[OK] Robot {index} connected ({ip})")
                self._emit("robot_status", {"robot_id": index, "status": "connected", "error": "", "ip": ip})
            except Exception as e:
                self.state.update_robot(index, Connection=None, status="error", error=str(e))
                self._log("err", f"[ERR] Robot {index} connection failed: {e}")
                self._emit("robot_status", {"robot_id": index, "status": "error", "error": str(e), "ip": ip})

        threading.Thread(target=_connect, daemon=True).start()
        return {"success": True, "message": f"Connecting to Robot {index} at {ip}..."}

    def get_robots_status(self):
        result = []
        for i in range(1, 9):
            ip_key = f"Robot_{i}"
            ip = self.state.robots_ip.get(ip_key, f"192.168.1.{i}")
            robot = self.state.get_robot(i)
            result.append({
                "id": i,
                "ip": ip,
                "status": robot.get("status", "disconnected"),
                "error": robot.get("error", ""),
                "connected": robot.get("Connection") is not None,
            })
        return result

    def get_position(self, index):
        robot = self.state.get_robot(index)
        mc = robot.get("Connection")
        if not mc:
            return {"angles": [0] * 6, "coords": [0] * 6, "connected": False}
        try:
            angles = mc.get_angles() or [0] * 6
            coords = mc.get_coords() or [0] * 6
            if not isinstance(angles, list) or len(angles) != 6:
                angles = [0] * 6
            if not isinstance(coords, list) or len(coords) != 6:
                coords = [0] * 6
            return {"angles": angles, "coords": coords, "connected": True}
        except Exception:
            return {"angles": [0] * 6, "coords": [0] * 6, "connected": False}

    def jog(self, index, mode, axis, direction, step, speed):
        robot = self.state.get_robot(index)
        mc = robot.get("Connection")
        if not mc:
            return {"success": False, "error": "Robot not connected"}
        try:
            if mode == "joint":
                axes = ["J1", "J2", "J3", "J4", "J5", "J6"]
                joint_idx = axes.index(axis) + 1
                current = mc.get_angles()[joint_idx - 1]
                mc.send_angle(joint_idx, current + direction * step, speed)
            else:
                axes = ["X", "Y", "Z", "Rx", "Ry", "Rz"]
                coord_idx = axes.index(axis) + 1
                current = mc.get_coords()[coord_idx - 1]
                mc.send_coord(coord_idx, current + direction * step, speed)
            self._log("ok", f"[JOG] Robot {index} {axis} {'+' if direction > 0 else '-'}{step}")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def release_servos(self, index):
        robot = self.state.get_robot(index)
        mc = robot.get("Connection")
        if not mc:
            return {"success": False, "error": "Not connected"}
        try:
            mc.release_all_servos()
            self._log("warn", f"[WARN] Robot {index} servos released")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def focus_servos(self, index):
        robot = self.state.get_robot(index)
        mc = robot.get("Connection")
        if not mc:
            return {"success": False, "error": "Not connected"}
        try:
            mc.focus_all_servos()
            self._log("ok", f"[OK] Robot {index} servos enabled")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _ensure_recipes_dir(self):
        if not os.path.exists(self.recipe_path):
            os.makedirs(self.recipe_path)

    def list_recipes(self):
        self._ensure_recipes_dir()
        recipes = []
        for item in os.listdir(self.recipe_path):
            if item.endswith(".json"):
                recipes.append(item.replace(".json", ""))
        return sorted(recipes)

    def create_recipe(self, name):
        self._ensure_recipes_dir()
        filepath = os.path.join(self.recipe_path, f"{name}.json")
        if os.path.exists(filepath):
            return {"success": False, "error": "Recipe already exists"}
        default_points = {
            f"Robot {i}": [{"name": "Home", "coords": [0.0] * 6}]
            for i in range(1, 9)
        }
        with open(filepath, "w") as f:
            json.dump(default_points, f, indent=4)
        self._log("ok", f"[OK] Recipe '{name}' created")
        return {"success": True}

    def delete_recipe(self, name):
        filepath = os.path.join(self.recipe_path, f"{name}.json")
        if not os.path.exists(filepath):
            return {"success": False, "error": "Recipe not found"}
        os.remove(filepath)
        self._log("warn", f"[WARN] Recipe '{name}' deleted")
        return {"success": True}

    def get_recipe(self, name):
        filepath = os.path.join(self.recipe_path, f"{name}.json")
        if not os.path.exists(filepath):
            return None
        with open(filepath, "r") as f:
            return json.load(f)

    def save_recipe(self, name, data):
        self._ensure_recipes_dir()
        filepath = os.path.join(self.recipe_path, f"{name}.json")
        with open(filepath, "w") as f:
            json.dump(data, f, indent=4)
        self._log("ok", f"[OK] Recipe '{name}' saved")
        return {"success": True}

    def teach_point(self, robot_index, recipe_name, point_name):
        robot = self.state.get_robot(robot_index)
        mc = robot.get("Connection")
        if not mc:
            return {"success": False, "error": "Robot not connected"}
        try:
            angles = mc.get_angles()
            if not isinstance(angles, list) or len(angles) != 6:
                return {"success": False, "error": "Invalid angles from robot"}
        except Exception as e:
            return {"success": False, "error": str(e)}

        recipe = self.get_recipe(recipe_name) or {
            f"Robot {i}": [] for i in range(1, 9)
        }
        robot_key = f"Robot {robot_index}"
        points = recipe.get(robot_key, [])

        for p in points:
            if p["name"] == point_name:
                p["coords"] = angles
                break
        else:
            points.append({"name": point_name, "coords": angles})

        recipe[robot_key] = points
        filepath = os.path.join(self.recipe_path, f"{recipe_name}.json")
        with open(filepath, "w") as f:
            json.dump(recipe, f, indent=4)
        self._log("ok", f"[TEACH] Robot {robot_index} '{point_name}' saved in '{recipe_name}'")
        return {"success": True, "angles": angles}

    def move_to_point(self, robot_index, recipe_name, point_name, speed):
        robot = self.state.get_robot(robot_index)
        mc = robot.get("Connection")
        if not mc:
            return {"success": False, "error": "Robot not connected"}
        recipe = self.get_recipe(recipe_name)
        if not recipe:
            return {"success": False, "error": "Recipe not found"}
        robot_key = f"Robot {robot_index}"
        points = recipe.get(robot_key, [])
        target = next((p for p in points if p["name"] == point_name), None)
        if not target:
            return {"success": False, "error": f"Point '{point_name}' not found"}
        try:
            mc.clear_error_information()
            mc.focus_all_servos()
            mc.send_angles(target["coords"], speed)
            self._log("ok", f"[GO TO] Robot {robot_index} → '{point_name}'")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def start_sequence(self, recipe_name, speed):
        recipe = self.get_recipe(recipe_name)
        if not recipe:
            return {"success": False, "error": "Recipe not found"}
        if self.state.sequence_running:
            return {"success": False, "error": "Sequence already running"}

        self.state.sequence_running = True
        self.state.sequence_recipe = recipe_name

        connected = [
            (i, self.state.get_robot(i))
            for i in sorted(self.state.get_all_robots().keys())
            if self.state.get_robot(i).get("Connection")
        ]

        def _run():
            for robot_id, robot in connected:
                if not self.state.sequence_running:
                    break
                robot_key = f"Robot {robot_id}"
                points = recipe.get(robot_key, [])
                mc = robot.get("Connection")
                if not mc:
                    continue
                try:
                    mc.focus_all_servos()
                    for i, point in enumerate(points):
                        if not self.state.sequence_running:
                            break
                        mc.send_angles(point["coords"], speed)
                        self._emit("sequence_progress", {
                            "robot_id": robot_id, "step": i + 1,
                            "total": len(points), "status": "Moving",
                        })
                        self._log("ok", f"[SEQ] Robot {robot_id} → {point['name']}")
                        timeout = 0
                        while True:
                            try:
                                moving = mc.is_moving()
                            except Exception:
                                moving = 0
                            if moving != 1 or not self.state.sequence_running or timeout > 300:
                                break
                            time.sleep(0.05)
                            timeout += 1
                    self._emit("sequence_progress", {
                        "robot_id": robot_id, "step": len(points),
                        "total": len(points), "status": "Done",
                    })
                except Exception as e:
                    self._emit("sequence_progress", {
                        "robot_id": robot_id, "step": 0,
                        "total": len(points), "status": "Error",
                    })
                    self._log("err", f"[ERR] Robot {robot_id}: {e}")

            self.state.sequence_running = False
            self._emit("sequence_done", {"recipe": recipe_name})
            self._log("ok", f"[OK] Sequence '{recipe_name}' finished")

        threading.Thread(target=_run, daemon=True).start()
        return {"success": True}

    def stop_sequence(self):
        self.state.sequence_running = False
        for robot in self.state.get_all_robots().values():
            mc = robot.get("Connection")
            if mc:
                try:
                    mc.stop()
                except Exception:
                    pass
        self._log("warn", "[WARN] Sequence stopped by user")
        return {"success": True}

    def get_status(self):
        return {
            "sequence_running": self.state.sequence_running,
            "sequence_recipe": self.state.sequence_recipe,
            "ups_status": self.state.ups_status,
            "log": self.state.log[-50:],
        }

    def _start_ups_monitor(self):
        def _monitor():
            class SPStatus(ctypes.Structure):
                _fields_ = [
                    ("ACLineStatus", ctypes.c_byte),
                    ("BatteryFlag", ctypes.c_byte),
                    ("BatteryLifePercent", ctypes.c_byte),
                    ("Reserved1", ctypes.c_byte),
                    ("BatteryLifeTime", ctypes.c_ulong),
                    ("BatteryFullLifeTime", ctypes.c_ulong),
                ]

            status = SPStatus()
            try:
                ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(status))
            except Exception:
                return
            if status.BatteryFlag == 128:
                return

            last = None
            while True:
                try:
                    ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(status))
                    current = "battery" if status.ACLineStatus == 0 else "ac"
                    if current != last:
                        self.state.ups_status = current
                        if current == "battery":
                            self._emit("ups_alert", {"type": "lost", "battery": status.BatteryLifePercent})
                            self._log("err", f"[UPS] Power lost! Battery at {status.BatteryLifePercent}%")
                            if self.state.sequence_running:
                                self.stop_sequence()
                        else:
                            self._emit("ups_alert", {"type": "restored"})
                            self._log("ok", "[UPS] Power restored")
                        last = current
                except Exception:
                    pass
                time.sleep(1)

        threading.Thread(target=_monitor, daemon=True).start()
