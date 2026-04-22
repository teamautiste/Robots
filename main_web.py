import sys
import os
import threading
import webbrowser
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from web.engine import JogEngine
from web.server import app, socketio, init_engine

PORT = 5000
HOST = "127.0.0.1"


def open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://{HOST}:{PORT}")

if __name__ == "__main__":
    engine = JogEngine(recipe_path="recipes")
    init_engine(engine)

    threading.Thread(target=open_browser, daemon=True).start()

    print(f"\n  Robot Control Web Interface")
    print(f"  Running at: http://{HOST}:{PORT}")
    print(f"  Press Ctrl+C to stop\n")

    socketio.run(app, host=HOST, port=PORT, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
