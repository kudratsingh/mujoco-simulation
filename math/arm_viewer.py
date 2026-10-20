#!/usr/bin/env python3
"""Open a local interactive forward-kinematics explorer in a browser.

From this checkout's root: .venv/bin/python math/arm_viewer.py
Ctrl+C stops the server. This uses the Mac venv, not the ROS container.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import webbrowser

from planar_arm import pose_payload

HTML_PATH = Path(__file__).with_suffix(".html")
ASSETS = {f"/{name}": HTML_PATH.parent / name for name in (
    "arm_viewer.js", "arm_motion.mjs", "arm_scene.js", "arm_viewer.css")}


class ArmHandler(BaseHTTPRequestHandler):
    def send_content(self, status, content, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            # A newer slider position may cancel a request already being served.
            pass

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/":
            self.send_content(200, HTML_PATH.read_bytes(), "text/html; charset=utf-8")
        elif url.path in ASSETS:
            content_type = "text/css" if url.path.endswith(".css") else "text/javascript"
            self.send_content(200, ASSETS[url.path].read_bytes(), content_type + "; charset=utf-8")
        elif url.path == "/api/pose":
            try:
                values = parse_qs(url.query, keep_blank_values=True)
                angles = []
                for key, default in (("q1", "30"), ("q2", "60")):
                    raw = values.get(key, [default])
                    if len(raw) != 1:
                        raise ValueError(f"{key} must appear once")
                    angle = float(raw[0])
                    if not math.isfinite(angle) or not -180 <= angle <= 180:
                        raise ValueError(f"{key} must be between -180 and 180 degrees")
                    angles.append(angle)
                lengths = []
                for key, default in (("l1", "1"), ("l2", "0.75")):
                    raw = values.get(key, [default])
                    if len(raw) != 1:
                        raise ValueError(f"{key} must appear once")
                    length = float(raw[0])
                    if not math.isfinite(length) or not 0.25 <= length <= 1.5:
                        raise ValueError(f"{key} must be between 0.25 and 1.5 metres")
                    lengths.append(length)
                payload = pose_payload(*angles, *lengths)
                self.send_content(200, json.dumps(payload, allow_nan=False).encode(),
                                  "application/json")
            except ValueError as error:
                self.send_content(400, json.dumps({"error": str(error)}).encode(),
                                  "application/json")
        elif url.path == "/favicon.ico":
            self.send_content(204, b"", "image/x-icon")
        else:
            self.send_content(404, b"Not found", "text/plain; charset=utf-8")

    def log_message(self, format, *args):
        # Slider updates produce many requests. Keep the user's terminal quiet.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765,
                        help="localhost port (default 8765; 0 chooses a free port)")
    parser.add_argument("--no-open", action="store_true", help="print URL without opening it")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("port must be between 0 and 65535")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), ArmHandler)
    except OSError as error:
        parser.exit(1, f"Could not start viewer: {error}. Try --port 0.\n")
    with server:
        url = f"http://127.0.0.1:{server.server_port}"
        print(f"Two-link arm: {url}\nMove the joint sliders; Ctrl+C here stops the viewer.",
              flush=True)
        if not args.no_open:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nArm viewer stopped.")


if __name__ == "__main__":
    main()
