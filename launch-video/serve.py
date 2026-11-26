"""Server lokal untuk merender video launching.

Cara pakai:  python serve.py   lalu buka http://localhost:5600
Tombol "Render MP4" di halaman akan menyimpan hasilnya ke folder out/.
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "out")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5600


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if not self.path.startswith("/save"):
            self.send_error(404)
            return
        name = os.path.basename(self.path.split("name=", 1)[-1]) if "name=" in self.path else "launch.mp4"
        if not name.endswith(".mp4"):
            name += ".mp4"
        length = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(length)
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"saved {name} ({len(data)} bytes)".encode())


if __name__ == "__main__":
    print(f"http://localhost:{PORT}")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
