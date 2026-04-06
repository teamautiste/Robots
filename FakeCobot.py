import socket
import threading

HOST = "127.0.0.1"
PORT = 9000

def handle_client(conn, addr):
    print(f"[FAKE ROBOT] Cliente conectado: {addr}")
    while True:
        try:
            data = conn.recv(1024)
            if not data:
                break

            print("[FAKE ROBOT] RX:", data)

            # Respuesta dummy (ACK)
            conn.sendall(b"\x01")
        except:
            break

    conn.close()
    print("[FAKE ROBOT] Cliente desconectado")

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen()
    print(f"[FAKE ROBOT] Escuchando en {HOST}:{PORT}")

    while True:
        conn, addr = s.accept()
        threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()