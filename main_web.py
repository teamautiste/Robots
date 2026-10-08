from web.server import app, socketio, init_engine
from web.engine import JogEngine
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


PORT = 5000
HOST = "127.0.0.1"


if __name__ == "__main__":
    engine = JogEngine(recipe_path="recipes")
    init_engine(engine)

    print(f"\n  Robot Control Web Interface")
    print(f"  Running at: http://{HOST}:{PORT}")
    print(f"  Press Ctrl+C to stop\n")

    socketio.run(app, host=HOST, port=PORT, debug=False,
                 use_reloader=False, allow_unsafe_werkzeug=True)
