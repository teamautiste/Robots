"""Almacenamiento de recetas en SQLite.

Reemplaza los archivos ``recipes/*.json``. La API pública devuelve las recetas
con la misma forma que tenían los JSON, para que el servidor y los frontends
no cambien:

    {"Robot 1": [{"name": "Home", "coords": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}], ...}

Esquema:
    recipes(id, name UNIQUE, created_at, updated_at)
    points(id, recipe_id -> recipes.id ON DELETE CASCADE, robot, position,
           name, j1..j6)   UNIQUE(recipe_id, robot, position)
"""

import glob
import json
import os
import shutil
import sqlite3
import threading

ROBOT_COUNT = 8
AXES = ("j1", "j2", "j3", "j4", "j5", "j6")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS recipes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS points (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    robot       TEXT    NOT NULL,
    position    INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    j1 REAL NOT NULL DEFAULT 0, j2 REAL NOT NULL DEFAULT 0,
    j3 REAL NOT NULL DEFAULT 0, j4 REAL NOT NULL DEFAULT 0,
    j5 REAL NOT NULL DEFAULT 0, j6 REAL NOT NULL DEFAULT 0,
    UNIQUE (recipe_id, robot, position)
);

CREATE INDEX IF NOT EXISTS idx_points_recipe_robot
    ON points (recipe_id, robot, position);
"""


def robot_key(index):
    return f"Robot {index}"


def default_recipe():
    return {robot_key(i): [{"name": "Home", "coords": [0.0] * 6}]
            for i in range(1, ROBOT_COUNT + 1)}


def _coords(value):
    """Normaliza las coordenadas a una lista de 6 floats."""
    if not isinstance(value, (list, tuple)):
        raise ValueError("coords must be a list")
    if len(value) != 6:
        raise ValueError(f"coords must have 6 values, got {len(value)}")
    return [float(v) for v in value]


class RecipeStore:
    def __init__(self, db_path):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        # Una sola conexión compartida entre los hilos de Flask, protegida por
        # un lock: las recetas son pequeñas y esto evita "database is locked".
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(
            db_path, check_same_thread=False, timeout=10)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA busy_timeout = 10000")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ── helpers ─────────────────────────────────────────────────────────────

    def _recipe_id(self, name):
        row = self._conn.execute(
            "SELECT id FROM recipes WHERE name = ?", (name,)).fetchone()
        return row["id"] if row else None

    def _touch(self, recipe_id):
        self._conn.execute(
            "UPDATE recipes SET updated_at = datetime('now', 'localtime') WHERE id = ?",
            (recipe_id,))

    def _write_points(self, recipe_id, data):
        """Reemplaza todos los puntos de la receta por los de ``data``."""
        rows = []
        for robot, points in data.items():
            for position, point in enumerate(points or []):
                rows.append((recipe_id, str(robot), position,
                             str(point.get("name", f"Punto {position + 1}")),
                             *_coords(point.get("coords", [0.0] * 6))))
        self._conn.execute("DELETE FROM points WHERE recipe_id = ?", (recipe_id,))
        self._conn.executemany(
            "INSERT INTO points (recipe_id, robot, position, name, j1, j2, j3, j4, j5, j6) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)

    @staticmethod
    def _point(row):
        return {"name": row["name"], "coords": [row[a] for a in AXES]}

    # ── API pública ─────────────────────────────────────────────────────────

    def list_names(self):
        with self._lock:
            rows = self._conn.execute(
                "SELECT name FROM recipes ORDER BY name").fetchall()
        return [r["name"] for r in rows]

    def exists(self, name):
        with self._lock:
            return self._recipe_id(name) is not None

    def get(self, name):
        """Devuelve la receta en formato {"Robot N": [puntos]} o None."""
        with self._lock:
            recipe_id = self._recipe_id(name)
            if recipe_id is None:
                return None
            rows = self._conn.execute(
                "SELECT robot, name, j1, j2, j3, j4, j5, j6 FROM points "
                "WHERE recipe_id = ? ORDER BY robot, position", (recipe_id,)).fetchall()
        recipe = {robot_key(i): [] for i in range(1, ROBOT_COUNT + 1)}
        for row in rows:
            recipe.setdefault(row["robot"], []).append(self._point(row))
        return recipe

    def create(self, name, data=None):
        """Crea una receta. Devuelve False si ya existe."""
        with self._lock, self._conn:
            if self._recipe_id(name) is not None:
                return False
            cur = self._conn.execute(
                "INSERT INTO recipes (name) VALUES (?)", (name,))
            self._write_points(cur.lastrowid,
                               default_recipe() if data is None else data)
        return True

    def save(self, name, data):
        """Guarda (crea o reemplaza) la receta completa en una transacción."""
        if not isinstance(data, dict):
            raise ValueError("recipe must be an object")
        with self._lock, self._conn:
            recipe_id = self._recipe_id(name)
            if recipe_id is None:
                recipe_id = self._conn.execute(
                    "INSERT INTO recipes (name) VALUES (?)", (name,)).lastrowid
            self._write_points(recipe_id, data)
            self._touch(recipe_id)

    def delete(self, name):
        with self._lock, self._conn:
            cur = self._conn.execute(
                "DELETE FROM recipes WHERE name = ?", (name,))
        return cur.rowcount > 0

    def get_point(self, name, robot, point_name):
        with self._lock:
            row = self._conn.execute(
                "SELECT p.name, p.j1, p.j2, p.j3, p.j4, p.j5, p.j6 FROM points p "
                "JOIN recipes r ON r.id = p.recipe_id "
                "WHERE r.name = ? AND p.robot = ? AND p.name = ? "
                "ORDER BY p.position LIMIT 1", (name, robot, point_name)).fetchone()
        return self._point(row) if row else None

    def upsert_point(self, name, robot, point_name, coords):
        """Actualiza el punto si existe o lo agrega al final. Crea la receta si
        no existe (sin puntos por defecto, como hacía teach_point)."""
        coords = _coords(coords)
        with self._lock, self._conn:
            recipe_id = self._recipe_id(name)
            if recipe_id is None:
                recipe_id = self._conn.execute(
                    "INSERT INTO recipes (name) VALUES (?)", (name,)).lastrowid
            row = self._conn.execute(
                "SELECT id FROM points WHERE recipe_id = ? AND robot = ? AND name = ? "
                "ORDER BY position LIMIT 1", (recipe_id, robot, point_name)).fetchone()
            if row:
                self._conn.execute(
                    "UPDATE points SET j1=?, j2=?, j3=?, j4=?, j5=?, j6=? WHERE id = ?",
                    (*coords, row["id"]))
            else:
                (next_pos,) = self._conn.execute(
                    "SELECT COALESCE(MAX(position) + 1, 0) FROM points "
                    "WHERE recipe_id = ? AND robot = ?", (recipe_id, robot)).fetchone()
                self._conn.execute(
                    "INSERT INTO points (recipe_id, robot, position, name, j1, j2, j3, j4, j5, j6) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (recipe_id, robot, next_pos, point_name, *coords))
            self._touch(recipe_id)

    # ── migración desde JSON ────────────────────────────────────────────────

    def import_json_dir(self, json_dir, backup_dir=None, log=None):
        """Importa ``json_dir/*.json`` a la base de datos.

        Cada archivo importado se mueve a ``backup_dir`` para que no se vuelva
        a importar (ni reaparezca una receta borrada) en el siguiente arranque.
        Si la receta ya existe en la base, el JSON solo se mueve al respaldo.
        """
        if not os.path.isdir(json_dir):
            return []
        backup_dir = backup_dir or os.path.join(json_dir, "_json_backup")
        imported = []
        for path in sorted(glob.glob(os.path.join(json_dir, "*.json"))):
            name = os.path.splitext(os.path.basename(path))[0]
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if not self.exists(name):
                    self.save(name, data)
                    imported.append(name)
            except Exception as e:  # JSON corrupto: se deja en su lugar
                if log:
                    log("err", f"[ERR] Could not import recipe '{name}': {e}")
                continue
            os.makedirs(backup_dir, exist_ok=True)
            shutil.move(path, os.path.join(backup_dir, os.path.basename(path)))
        if imported and log:
            log("ok", f"[OK] Imported {len(imported)} JSON recipe(s) into SQLite: "
                + ", ".join(imported))
        return imported
