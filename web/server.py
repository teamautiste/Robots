import os
from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="/static")
app.config["SECRET_KEY"] = "robot-control-2024"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

engine = None


def init_engine(eng):
    global engine
    engine = eng
    engine.set_socketio(socketio)


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# ── ROBOTS ──────────────────────────────────────────────────────────────────

@app.route("/api/robots", methods=["GET"])
def get_robots():
    return jsonify(engine.get_robots_status())


@app.route("/api/robots/<int:index>/connect", methods=["POST"])
def connect_robot(index):
    return jsonify(engine.connect_robot(index))


@app.route("/api/robots/<int:index>/position", methods=["GET"])
def get_position(index):
    return jsonify(engine.get_position(index))


@app.route("/api/robots/<int:index>/jog", methods=["POST"])
def jog_robot(index):
    data = request.get_json()
    return jsonify(engine.jog(
        index,
        data.get("mode", "joint"),
        data.get("axis", "J1"),
        data.get("direction", 1),
        data.get("step", 1.0),
        data.get("speed", 10),
    ))


@app.route("/api/robots/<int:index>/release", methods=["POST"])
def release_servos(index):
    return jsonify(engine.release_servos(index))


@app.route("/api/robots/<int:index>/focus", methods=["POST"])
def focus_servos(index):
    return jsonify(engine.focus_servos(index))


@app.route("/api/robots/<int:index>/teach", methods=["POST"])
def teach_point(index):
    data = request.get_json()
    return jsonify(engine.teach_point(index, data["recipe"], data["point"]))


@app.route("/api/robots/<int:index>/goto", methods=["POST"])
def goto_point(index):
    data = request.get_json()
    return jsonify(engine.move_to_point(index, data["recipe"], data["point"], data.get("speed", 25)))


# ── RECIPES ──────────────────────────────────────────────────────────────────

@app.route("/api/recipes", methods=["GET"])
def list_recipes():
    return jsonify(engine.list_recipes())


@app.route("/api/recipes", methods=["POST"])
def create_recipe():
    data = request.get_json()
    return jsonify(engine.create_recipe(data["name"]))


@app.route("/api/recipes/<string:name>", methods=["GET"])
def get_recipe(name):
    recipe = engine.get_recipe(name)
    if recipe is None:
        return jsonify({"error": "Recipe not found"}), 404
    return jsonify(recipe)


@app.route("/api/recipes/<string:name>", methods=["PUT"])
def save_recipe(name):
    return jsonify(engine.save_recipe(name, request.get_json()))


@app.route("/api/recipes/<string:name>", methods=["DELETE"])
def delete_recipe(name):
    return jsonify(engine.delete_recipe(name))


# ── SEQUENCE ─────────────────────────────────────────────────────────────────

@app.route("/api/sequence/start", methods=["POST"])
def start_sequence():
    data = request.get_json()
    return jsonify(engine.start_sequence(data["recipe"], data.get("speed", 25)))


@app.route("/api/sequence/stop", methods=["POST"])
def stop_sequence():
    return jsonify(engine.stop_sequence())


# ── CONFIG & STATUS ──────────────────────────────────────────────────────────

@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify(engine.get_full_config())


@app.route("/api/config", methods=["POST"])
def save_config():
    return jsonify(engine.save_full_config(request.get_json()))


@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify(engine.get_status())
